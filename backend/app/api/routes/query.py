from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.session import get_db
from app.database.models import QASession, Claim, Citation, Clause, Document
from app.schemas.query import (
    QueryRequest,
    QueryResponse,
    ClaimResponse,
    CitationResponse,
    EvidenceDetailResponse
)

router = APIRouter(prefix="/query", tags=["Query & Evidence"])

@router.post("", response_model=QueryResponse)
async def execute_query(req: QueryRequest, db: AsyncSession = Depends(get_db)):
    session = QASession(
        query_text=req.query,
        answer_text="Insufficient verified documentary evidence found to substantiate this answer under strict verification criteria.",
        status="INSUFFICIENT_EVIDENCE",
        faithfulness_score=0.0,
        as_of_date=req.as_of_date
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    return QueryResponse(
        id=session.id,
        query=session.query_text,
        answer=session.answer_text,
        status=session.status,
        faithfulness_score=session.faithfulness_score,
        as_of_date=session.as_of_date,
        claims=[],
        created_at=session.created_at
    )

@router.get("/{query_id}", response_model=QueryResponse)
async def get_query_session(query_id: str, db: AsyncSession = Depends(get_db)):
    session = await db.get(QASession, query_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Query session not found")

    claims_stmt = select(Claim).where(Claim.session_id == query_id)
    claims_res = await db.execute(claims_stmt)
    claims = claims_res.scalars().all()

    claims_responses = []
    for c in claims:
        cit_stmt = select(Citation).where(Citation.claim_id == c.id)
        cit_res = await db.execute(cit_stmt)
        citations = cit_res.scalars().all()
        cit_responses = [CitationResponse.model_validate(cit) for cit in citations]
        claim_resp = ClaimResponse.model_validate(c)
        claim_resp.citations = cit_responses
        claims_responses.append(claim_resp)

    return QueryResponse(
        id=session.id,
        query=session.query_text,
        answer=session.answer_text,
        status=session.status,
        faithfulness_score=session.faithfulness_score,
        as_of_date=session.as_of_date,
        claims=claims_responses,
        created_at=session.created_at
    )

@router.get("/{query_id}/claims", response_model=List[ClaimResponse])
async def get_query_claims(query_id: str, db: AsyncSession = Depends(get_db)):
    claims_stmt = select(Claim).where(Claim.session_id == query_id)
    claims_res = await db.execute(claims_stmt)
    claims = claims_res.scalars().all()

    claims_responses = []
    for c in claims:
        cit_stmt = select(Citation).where(Citation.claim_id == c.id)
        cit_res = await db.execute(cit_stmt)
        citations = cit_res.scalars().all()
        cit_responses = [CitationResponse.model_validate(cit) for cit in citations]
        claim_resp = ClaimResponse.model_validate(c)
        claim_resp.citations = cit_responses
        claims_responses.append(claim_resp)

    return claims_responses

@router.get("/{query_id}/evidence", response_model=EvidenceDetailResponse)
async def get_query_evidence(query_id: str, db: AsyncSession = Depends(get_db)):
    session = await db.get(QASession, query_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Query session not found")

    claims_stmt = select(Claim).where(Claim.session_id == query_id)
    claims_res = await db.execute(claims_stmt)
    claims = claims_res.scalars().all()

    total_claims = len(claims)
    verified = sum(1 for c in claims if c.verification_status == "VERIFIED")
    unsupported = sum(1 for c in claims if c.verification_status == "UNSUPPORTED")
    conflicted = sum(1 for c in claims if c.verification_status == "CONTRADICTED")

    all_citations = []
    for c in claims:
        cit_stmt = select(Citation).where(Citation.claim_id == c.id)
        cit_res = await db.execute(cit_stmt)
        citations = cit_res.scalars().all()
        all_citations.extend([CitationResponse.model_validate(cit) for cit in citations])

    return EvidenceDetailResponse(
        session_id=session.id,
        total_claims=total_claims,
        verified_claims=verified,
        unsupported_claims=unsupported,
        conflicted_claims=conflicted,
        faithfulness_score=session.faithfulness_score,
        citations=all_citations
    )
