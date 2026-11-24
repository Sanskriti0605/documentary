from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.session import get_db
from app.database.models import Clause, Document, Page, QASession, Claim, Citation, Conflict, AmendmentEdge
from app.retrieval.hybrid import HybridRetriever
from app.generation.engine import generate_verifiable_answer
from app.verification.gate import run_verification_gate
from app.schemas.query import QueryRequest
from app.intelligence.temporal_parser import extract_as_of_date
from app.intelligence.amendments import resolve_temporal_lineage_for_query

router = APIRouter(tags=["VerifyDoc Ask"])

@router.post("/ask")
async def ask_question(
    req: QueryRequest,
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Main verifiable question answering pipeline:
    1. Resolve effective as-of date (explicit field wins, else parsed from query, default today)
    2. Hybrid retrieval (BM25 + Dense)
    3. Apply temporal DAG (amendments.py) BEFORE generation:
       - Resolve draft, future effective, extended, partial amendment, and withdrawn statuses
       - Return version chain used in the answer
    4. LLM answer generation with JSON-schema constraint
    5. Verification gate (Verbatim check + Number/Date check + NLI check)
    6. Faithfulness score calculation (N generated, M blocked)
    """
    # 0. Resolve as-of date
    eff_as_of_date = extract_as_of_date(req.query, req.as_of if req.as_of is not None else req.as_of_date)

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

        if page:
            page_texts[(c.document_id, page_num)] = page.extracted_text
            page_texts[(doc_name, page_num)] = page.extracted_text
            if page_num not in page_texts:
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

    # 2. Hybrid Retrieval with expanded candidate pool
    retriever = HybridRetriever(corpus)
    retrieved_quotes = retriever.hybrid_search(req.query, top_k=25, doc_filter=req.document_ids)

    # 3. Apply temporal DAG before generation
    filtered_quotes, version_chain, temporal_guidance = resolve_temporal_lineage_for_query(
        req.query,
        retrieved_quotes,
        eff_as_of_date
    )

    # 4. Evidence-constrained generation
    gen_result = await generate_verifiable_answer(
        req.query,
        filtered_quotes,
        str(eff_as_of_date),
        temporal_guidance=temporal_guidance,
        version_chain=version_chain
    )

    # 5. Strict verification gate
    claims_to_verify = gen_result.get("claims", [])
    query_ctx = f"{req.query} as of {eff_as_of_date}"
    gate_result = run_verification_gate(claims_to_verify, page_texts, query_context=query_ctx)

    # 6. Persist session
    answer_text = ""
    if gate_result["status"] == "INSUFFICIENT_EVIDENCE":
        answer_text = (
            f"ABSTENTION ENFORCED: Insufficient verifiable evidence found in the document library to answer: '{req.query}'. "
            f"Searched {len(filtered_quotes)} clauses, but required factual proof was missing."
        )
    else:
        ans = gen_result.get("answer") or " ".join([c["text"] for c in gate_result["verified_claims"]])
        if gen_result.get("calculation") and gen_result["calculation"]["summary"] not in ans:
            ans = f"{gen_result['calculation']['summary']} {ans}"
        answer_text = ans

    # 7. Check contextual conflict and version chain metadata
    conflict_found = False
    conflict_subject = None
    stmt_conflicts = select(Conflict).where(Conflict.resolution_status != "RESOLVED_AMENDMENT")
    res_conf = await db.execute(stmt_conflicts)
    active_conflicts = res_conf.scalars().all()
    retrieved_clause_ids = {q.get("id") for q in filtered_quotes}

    for cf in active_conflicts:
        if cf.clause_a_id in retrieved_clause_ids or cf.clause_b_id in retrieved_clause_ids:
            conflict_found = True
            conflict_subject = cf.subject or "interest_rate"
            break
        if cf.subject and cf.subject.replace("_", " ") in req.query.lower():
            conflict_found = True
            conflict_subject = cf.subject
            break

    stmt_edges = select(AmendmentEdge)
    res_edges = await db.execute(stmt_edges)
    edges = res_edges.scalars().all()
    has_version_chain = len(edges) > 0 or len(version_chain) > 0

    session = QASession(
        query_text=req.query,
        answer_text=answer_text,
        status=gate_result["status"],
        faithfulness_score=gate_result["faithfulness_score"],
        as_of_date=eff_as_of_date
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
        "as_of_date": str(eff_as_of_date),
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
        "conflict_found": conflict_found,
        "conflict_subject": conflict_subject,
        "has_version_chain": has_version_chain,
        "version_chain": version_chain,
        "temporal_guidance": temporal_guidance,
        "retrieved_quotes": filtered_quotes
    }
