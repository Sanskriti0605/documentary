from typing import Optional, List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database.session import get_db
from app.database.models import RuleFact
from app.schemas.rule import RuleFactResponse, RuleListResponse

router = APIRouter(prefix="/rules", tags=["Rules"])

@router.get("/current", response_model=RuleListResponse)
async def get_current_rules(
    subject: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    query = select(RuleFact)
    if subject:
        query = query.where(RuleFact.subject.ilike(f"%{subject}%"))
    query = query.order_by(RuleFact.created_at.desc()).offset(skip).limit(limit)

    res = await db.execute(query)
    rules = res.scalars().all()

    total_query = select(func.count(RuleFact.id))
    if subject:
        total_query = total_query.where(RuleFact.subject.ilike(f"%{subject}%"))
    total = await db.scalar(total_query) or 0

    return RuleListResponse(
        total=total,
        rules=[RuleFactResponse.model_validate(r) for r in rules]
    )
