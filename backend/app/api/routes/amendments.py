from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.session import get_db
from app.database.models import AmendmentEdge, Clause, Document
from app.schemas.amendment import (
    AmendmentGraphResponse,
    AmendmentGraphNode,
    AmendmentGraphEdge,
    TimelineItemResponse
)

router = APIRouter(prefix="/amendments", tags=["Amendments"])

@router.get("/graph", response_model=AmendmentGraphResponse)
async def get_amendment_graph(db: AsyncSession = Depends(get_db)):
    edges_stmt = select(AmendmentEdge)
    edges_res = await db.execute(edges_stmt)
    edges_list = edges_res.scalars().all()

    node_ids = set()
    for e in edges_list:
        node_ids.add(e.source_clause_id)
        node_ids.add(e.target_clause_id)

    nodes = []
    for nid in node_ids:
        clause = await db.get(Clause, nid)
        if clause:
            doc = await db.get(Document, clause.document_id)
            nodes.append(AmendmentGraphNode(
                id=clause.id,
                label=f"{doc.name if doc else 'Doc'} (Clause {clause.clause_number or 'N/A'})",
                document_name=doc.name if doc else "Unknown",
                document_type=doc.document_type if doc else "UNKNOWN",
                clause_number=clause.clause_number,
                section_title=clause.section_title,
                clause_text=clause.clause_text[:120] + "..." if len(clause.clause_text) > 120 else clause.clause_text,
                effective_from=clause.effective_from,
                effective_to=clause.effective_to
            ))

    edges = [
        AmendmentGraphEdge(
            id=e.id,
            source=e.source_clause_id,
            target=e.target_clause_id,
            relationship=e.relationship_type,
            old_value=e.old_value,
            new_value=e.new_value,
            effective_date=e.effective_date
        )
        for e in edges_list
    ]

    return AmendmentGraphResponse(nodes=nodes, edges=edges)

@router.get("/timeline", response_model=List[TimelineItemResponse])
async def get_amendment_timeline(db: AsyncSession = Depends(get_db)):
    stmt = select(AmendmentEdge).order_by(AmendmentEdge.effective_date.asc().nulls_last())
    res = await db.execute(stmt)
    edges = res.scalars().all()

    timeline = []
    for e in edges:
        clause = await db.get(Clause, e.source_clause_id)
        doc = await db.get(Document, clause.document_id) if clause else None
        timeline.append(TimelineItemResponse(
            date=e.effective_date,
            event_type=e.relationship_type,
            document_name=doc.name if doc else "Unknown",
            clause_number=clause.clause_number if clause else None,
            description=f"Amended value from '{e.old_value or 'N/A'}' to '{e.new_value or 'N/A'}'",
            clause_id=e.source_clause_id
        ))

    return timeline
