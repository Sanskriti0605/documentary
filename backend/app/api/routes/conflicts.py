import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from app.database.session import get_db
from app.database.models import Conflict, Clause, Document
from app.schemas.conflict import (
    ConflictResponse,
    ConflictListResponse,
    ConflictPatchRequest,
    ConflictReviewRequest,
    ConflictScanResponse,
    ConflictSummaryStats,
    ConflictHistoryItem
)
from app.schemas.document import ClauseResponse
from app.intelligence.contradictions import scan_and_detect_conflicts

router = APIRouter(prefix="/conflicts", tags=["Conflicts"])

VALID_RESOLUTION_STATUSES = {
    "PENDING_REVIEW",
    "RESOLVED_AMENDMENT",
    "RESOLVED_SCOPE",
    "DISMISSED",
    "AUTO_RESOLVED"
}

VALID_TRANSITIONS = {
    "PENDING_REVIEW": {"RESOLVED_AMENDMENT", "RESOLVED_SCOPE", "DISMISSED", "AUTO_RESOLVED"},
    "RESOLVED_AMENDMENT": {"RESOLVED_SCOPE", "DISMISSED", "PENDING_REVIEW"},
    "RESOLVED_SCOPE": {"RESOLVED_AMENDMENT", "DISMISSED", "PENDING_REVIEW"},
    "DISMISSED": {"RESOLVED_AMENDMENT", "RESOLVED_SCOPE", "PENDING_REVIEW"},
    "AUTO_RESOLVED": {"RESOLVED_AMENDMENT", "RESOLVED_SCOPE", "DISMISSED", "PENDING_REVIEW"}
}

async def enrich_conflict_response(c: Conflict, db: AsyncSession) -> ConflictResponse:
    clause_a = await db.get(Clause, c.clause_a_id)
    clause_b = await db.get(Clause, c.clause_b_id)

    doc_a = await db.get(Document, clause_a.document_id) if clause_a else None
    doc_b = await db.get(Document, clause_b.document_id) if clause_b else None

    # Parse history JSON safely
    history_items: List[ConflictHistoryItem] = []
    if c.history:
        try:
            raw_history = json.loads(c.history)
            if isinstance(raw_history, list):
                for h in raw_history:
                    history_items.append(ConflictHistoryItem(
                        timestamp=h.get("timestamp", datetime.utcnow().isoformat()),
                        action=h.get("action", "REVIEW"),
                        previous_status=h.get("previous_status", "UNKNOWN"),
                        new_status=h.get("new_status", "UNKNOWN"),
                        notes=h.get("notes", ""),
                        linked_document_id=h.get("linked_document_id"),
                        linked_document_name=h.get("linked_document_name")
                    ))
        except Exception:
            pass

    resp = ConflictResponse(
        id=c.id,
        clause_a_id=c.clause_a_id,
        clause_b_id=c.clause_b_id,
        clause_a=ClauseResponse.model_validate(clause_a) if clause_a else None,
        clause_b=ClauseResponse.model_validate(clause_b) if clause_b else None,
        conflict_type=c.conflict_type,
        severity=c.severity,
        scope_overlap=c.scope_overlap,
        temporal_overlap=c.temporal_overlap,
        resolution_status=c.resolution_status,
        resolution_notes=c.resolution_notes,
        subject=c.subject,
        value_a=c.value_a,
        value_b=c.value_b,
        linked_document_id=c.linked_document_id,
        linked_document_name=c.linked_document_name,
        history=history_items,
        created_at=c.created_at,
        updated_at=c.updated_at,
        doc_a_name=doc_a.name if doc_a else None,
        doc_b_name=doc_b.name if doc_b else None,
        clause_a_number=clause_a.clause_number if clause_a else None,
        clause_b_number=clause_b.clause_number if clause_b else None,
        quote_a=clause_a.clause_text if clause_a else None,
        quote_b=clause_b.clause_text if clause_b else None
    )
    return resp

@router.get("", response_model=ConflictListResponse)
async def list_conflicts(
    skip: int = 0,
    limit: int = 100,
    subject: Optional[str] = Query(None, description="Filter by subject canonical name"),
    document: Optional[str] = Query(None, description="Filter by document name pattern"),
    conflict_type: Optional[str] = Query(None, description="Filter by conflict type"),
    resolution_status: Optional[str] = Query(None, description="Filter by resolution status"),
    db: AsyncSession = Depends(get_db)
):
    query = select(Conflict)

    if resolution_status:
        query = query.where(Conflict.resolution_status == resolution_status)
    if conflict_type:
        query = query.where(Conflict.conflict_type == conflict_type)
    if subject:
        query = query.where(Conflict.subject.ilike(f"%{subject}%"))

    # For document filter, we need to join clauses & documents
    if document:
        clause_alias_a = Clause
        query = query.join(clause_alias_a, Conflict.clause_a_id == clause_alias_a.id)
        query = query.join(Document, clause_alias_a.document_id == Document.id)
        query = query.where(Document.name.ilike(f"%{document}%"))

    query = query.order_by(Conflict.created_at.desc()).offset(skip).limit(limit)

    res = await db.execute(query)
    conflicts = res.scalars().all()

    # Total matching query
    total_query = select(func.count(Conflict.id))
    if resolution_status:
        total_query = total_query.where(Conflict.resolution_status == resolution_status)
    if conflict_type:
        total_query = total_query.where(Conflict.conflict_type == conflict_type)
    if subject:
        total_query = total_query.where(Conflict.subject.ilike(f"%{subject}%"))
    total = await db.scalar(total_query) or 0

    # Summary Statistics across all conflicts
    all_conflicts_res = await db.execute(select(Conflict))
    all_conflicts = all_conflicts_res.scalars().all()

    summary = ConflictSummaryStats(
        total=len(all_conflicts),
        pending_review=sum(1 for c in all_conflicts if c.resolution_status == "PENDING_REVIEW"),
        confirmed_conflicts=sum(1 for c in all_conflicts if c.conflict_type == "CONFIRMED_CONFLICT"),
        auto_resolved=sum(1 for c in all_conflicts if c.resolution_status == "AUTO_RESOLVED"),
        resolved_by_reviewer=sum(1 for c in all_conflicts if c.resolution_status in ("RESOLVED_AMENDMENT", "RESOLVED_SCOPE", "DISMISSED"))
    )

    conflict_responses = [await enrich_conflict_response(c, db) for c in conflicts]

    return ConflictListResponse(total=total, conflicts=conflict_responses, summary=summary)

@router.post("/scan", response_model=ConflictScanResponse)
async def scan_conflicts(db: AsyncSession = Depends(get_db)):
    """Trigger contradiction detector across all documents with amendment reconciliation and de-duplication."""
    result = await scan_and_detect_conflicts(db)
    return ConflictScanResponse(**result)

@router.get("/{conflict_id}", response_model=ConflictResponse)
async def get_conflict(conflict_id: str, db: AsyncSession = Depends(get_db)):
    conflict = await db.get(Conflict, conflict_id)
    if not conflict:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conflict record not found")
    return await enrich_conflict_response(conflict, db)

@router.patch("/{conflict_id}", response_model=ConflictResponse)
async def patch_conflict(
    conflict_id: str,
    review: ConflictPatchRequest,
    db: AsyncSession = Depends(get_db)
):
    """Update conflict resolution status, reviewer notes, and linked document with status transition validation."""
    conflict = await db.get(Conflict, conflict_id)
    if not conflict:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conflict record not found")

    new_status = review.resolution_status.upper().strip()
    if new_status not in VALID_RESOLUTION_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid resolution status '{review.resolution_status}'. Allowed: {', '.join(sorted(VALID_RESOLUTION_STATUSES))}"
        )

    # Validate status transitions
    allowed_transitions = VALID_TRANSITIONS.get(conflict.resolution_status, set())
    if new_status != conflict.resolution_status and new_status not in allowed_transitions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Illegal status transition from '{conflict.resolution_status}' to '{new_status}'. Allowed: {', '.join(sorted(allowed_transitions))}"
        )

    # Load existing history
    history = []
    if conflict.history:
        try:
            history = json.loads(conflict.history)
            if not isinstance(history, list):
                history = []
        except Exception:
            history = []

    # Append new review event
    history.append({
        "timestamp": datetime.utcnow().isoformat(),
        "action": f"REVIEW_{new_status}",
        "previous_status": conflict.resolution_status,
        "new_status": new_status,
        "notes": review.resolution_notes,
        "linked_document_id": review.linked_document_id,
        "linked_document_name": review.linked_document_name
    })

    conflict.resolution_status = new_status
    conflict.resolution_notes = review.resolution_notes
    if review.linked_document_id is not None:
        conflict.linked_document_id = review.linked_document_id
    if review.linked_document_name is not None:
        conflict.linked_document_name = review.linked_document_name
    conflict.history = json.dumps(history)
    conflict.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(conflict)

    return await enrich_conflict_response(conflict, db)

@router.post("/{conflict_id}/review", response_model=ConflictResponse)
async def review_conflict(
    conflict_id: str,
    review: ConflictReviewRequest,
    db: AsyncSession = Depends(get_db)
):
    """Backward compatibility review endpoint matching PATCH semantics."""
    return await patch_conflict(conflict_id, review, db)
