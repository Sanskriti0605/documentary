from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.session import get_db
from app.database.models import AmendmentEdge, Clause, Document
from app.schemas.amendment import (
    AmendmentGraphResponse,
    AmendmentGraphNode,
    AmendmentGraphEdge,
    TimelineItemResponse,
    AmendmentResolutionResponse
)
from app.intelligence.amendments import resolve_amendments_for_rule

router = APIRouter(prefix="/amendments", tags=["Amendments"])

@router.get("", response_model=AmendmentResolutionResponse)
async def get_amendments(
    rule: Optional[str] = Query(None, description="Rule subject or document family, e.g. 'penal_charges' or 'interest_rate'"),
    as_of: Optional[str] = Query(None, description="Evaluation As-Of date in YYYY-MM-DD format"),
    lender_type: Optional[str] = Query(None, description="Regulated Entity lender type (COMMERCIAL_BANK, NBFC, HFC)"),
    sanction_date: Optional[str] = Query(None, description="Loan sanction date in YYYY-MM-DD format"),
    db: AsyncSession = Depends(get_db)
):
    """
    Resolve amendment lineage, graph, timeline, and version in force on specified as_of date.
    Handles future effective dates, non-binding drafts, partial amendments, and withdrawn documents.
    """
    return await resolve_amendments_for_rule(
        rule=rule or "penal_charges",
        as_of=as_of,
        lender_type=lender_type,
        sanction_date=sanction_date,
        db=db
    )

@router.get("/graph", response_model=AmendmentGraphResponse)
async def get_amendment_graph(
    rule: Optional[str] = Query(None),
    as_of: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    resolution = await resolve_amendments_for_rule(
        rule=rule or "penal_charges",
        as_of=as_of,
        db=db
    )
    return AmendmentGraphResponse(nodes=resolution.nodes, edges=resolution.edges)

@router.get("/timeline", response_model=List[TimelineItemResponse])
async def get_amendment_timeline(
    rule: Optional[str] = Query(None),
    as_of: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    resolution = await resolve_amendments_for_rule(
        rule=rule or "penal_charges",
        as_of=as_of,
        db=db
    )
    return resolution.timeline
