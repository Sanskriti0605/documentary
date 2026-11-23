from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.session import get_db
from app.database.models import Clause, Document, Page, QASession, Claim, Citation
from app.retrieval.hybrid import HybridRetriever
from app.generation.engine import generate_verifiable_answer
from app.verification.gate import run_verification_gate
from app.schemas.query import QueryRequest

router = APIRouter(tags=["VerifyDoc Ask"])

@router.post("/ask")
async def ask_question(
    req: QueryRequest,
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Main verifiable question answering pipeline:
    1. Hybrid retrieval (BM25 + Dense)
    2. Context expansion
    3. LLM answer generation with JSON-schema constraint
    4. Verification gate (Verbatim check + Number/Date check + NLI check)
    5. Faithfulness score calculation (N generated, M blocked)
    """
    # 1. Fetch all processed clauses from the database
    stmt = select(Clause)
    res = await db.execute(stmt)
    clauses = res.scalars().all()

    corpus = []
    page_texts: Dict[int, str] = {}

    for c in clauses:
        doc = await db.get(Document, c.document_id)
        page = await db.get(Page, c.page_id) if c.page_id else None

        doc_name = doc.name if doc else "Document"
        page_num = page.page_number if page else 1

        if page_num not in page_texts and page:
            page_texts[page_num] = page.extracted_text

        corpus.append({
            "id": c.id,
            "clause_id": c.id,
            "document_id": c.document_id,
            "document_name": doc_name,
            "clause_number": c.clause_number,
            "section_title": c.section_title,
            "clause_text": c.clause_text,
            "page_number": page_num,
            "bounding_box": c.bounding_box,
            "effective_from": c.effective_from
        })

    # 2. Hybrid Retrieval
    retriever = HybridRetriever(corpus)
    retrieved_quotes = retriever.hybrid_search(req.query, top_k=5, doc_filter=req.document_ids)

    # 3. Evidence-constrained generation
    gen_result = await generate_verifiable_answer(req.query, retrieved_quotes, str(req.as_of_date) if req.as_of_date else None)

    # 4. Strict verification gate
    claims_to_verify = gen_result.get("claims", [])
    gate_result = run_verification_gate(claims_to_verify, page_texts)

    # 5. Persist session
    answer_text = ""
    if gate_result["status"] == "INSUFFICIENT_EVIDENCE":
        answer_text = (
            f"ABSTENTION ENFORCED: Insufficient verifiable evidence found in the document library to answer: '{req.query}'. "
            f"Searched {len(retrieved_quotes)} clauses, but required factual proof was missing."
        )
    else:
        verified_texts = [c["text"] for c in gate_result["verified_claims"]]
        answer_text = " ".join(verified_texts)

    session = QASession(
        query_text=req.query,
        answer_text=answer_text,
        status=gate_result["status"],
        faithfulness_score=gate_result["faithfulness_score"],
        as_of_date=req.as_of_date
    )
    db.add(session)
    await db.flush()

    # Save verified claims
    for vc in gate_result["verified_claims"]:
        db_claim = Claim(
            session_id=session.id,
            claim_text=vc["text"],
            verification_status="VERIFIED",
            verification_score=1.0
        )
        db.add(db_claim)
        await db.flush()

        for cit in vc.get("citations", []):
            db_cit = Citation(
                claim_id=db_claim.id,
                clause_id=cit.get("clause_id", clauses[0].id if clauses else "C1"),
                page_number=cit.get("page_number", 1),
                exact_quote=cit.get("quote", ""),
                quote_hash=str(hash(cit.get("quote", ""))),
                bounding_box=cit.get("bounding_box"),
                support_status="FULL_SUPPORT"
            )
            db.add(db_cit)

    await db.commit()

    return {
        "session_id": session.id,
        "query": req.query,
        "answer": answer_text,
        "status": gate_result["status"],
        "faithfulness_score": gate_result["faithfulness_score"],
        "generated_count": gate_result["total_claims"],
        "verified_count": gate_result["verified_count"],
        "blocked_count": gate_result["blocked_count"],
        "verified_claims": gate_result["verified_claims"],
        "blocked_claims": gate_result["blocked_claims"],
        "calculation": gen_result.get("calculation"),
        "generation_provider": gen_result.get("generation_provider", "extractive-fallback"),
        "is_fallback": gen_result.get("is_fallback", True),
        "model_name": gen_result.get("model_name", "none"),
        "retrieved_quotes": retrieved_quotes
    }
