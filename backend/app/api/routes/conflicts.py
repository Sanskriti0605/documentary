from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database.session import get_db
from app.database.models import Conflict, Clause
from app.schemas.conflict import (
    ConflictResponse,
    ConflictListResponse,
    ConflictReviewRequest
)
from app.schemas.document import ClauseResponse

router = APIRouter(prefix="/conflicts", tags=["Conflicts"])

@router.get("", response_model=ConflictListResponse)
async def list_conflicts(
    skip: int = 0,
    limit: int = 50,
    resolution_status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(Conflict)
    if resolution_status:
        query = query.where(Conflict.resolution_status == resolution_status)
    query = query.order_by(Conflict.created_at.desc()).offset(skip).limit(limit)

    res = await db.execute(query)
    conflicts = res.scalars().all()

    total_query = select(func.count(Conflict.id))
    if resolution_status:
        total_query = total_query.where(Conflict.resolution_status == resolution_status)
    total = await db.scalar(total_query) or 0

    conflict_responses = []
    for c in conflicts:
        clause_a = await db.get(Clause, c.clause_a_id)
        clause_b = await db.get(Clause, c.clause_b_id)
        resp = ConflictResponse.model_validate(c)
        if clause_a:
            resp.clause_a = ClauseResponse.model_validate(clause_a)
        if clause_b:
            resp.clause_b = ClauseResponse.model_validate(clause_b)
        conflict_responses.append(resp)

    return ConflictListResponse(total=total, conflicts=conflict_responses)

@router.get("/{conflict_id}", response_model=ConflictResponse)
async def get_conflict(conflict_id: str, db: AsyncSession = Depends(get_db)):
    conflict = await db.get(Conflict, conflict_id)
    if not conflict:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conflict record not found")

    clause_a = await db.get(Clause, conflict.clause_a_id)
    clause_b = await db.get(Clause, conflict.clause_b_id)
    resp = ConflictResponse.model_validate(conflict)
    if clause_a:
        resp.clause_a = ClauseResponse.model_validate(clause_a)
    if clause_b:
        resp.clause_b = ClauseResponse.model_validate(clause_b)
    return resp

@router.post("/{conflict_id}/review", response_model=ConflictResponse)
async def review_conflict(
    conflict_id: str,
    review: ConflictReviewRequest,
    db: AsyncSession = Depends(get_db)
):
    conflict = await db.get(Conflict, conflict_id)
    if not conflict:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conflict record not found")

    conflict.resolution_status = review.resolution_status
    conflict.resolution_notes = review.resolution_notes
    await db.commit()
    await db.refresh(conflict)

    clause_a = await db.get(Clause, conflict.clause_a_id)
    clause_b = await db.get(Clause, conflict.clause_b_id)
    resp = ConflictResponse.model_validate(conflict)
    if clause_a:
        resp.clause_a = ClauseResponse.model_validate(clause_a)
    if clause_b:
        resp.clause_b = ClauseResponse.model_validate(clause_b)
    return resp
