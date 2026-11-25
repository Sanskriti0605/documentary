import os
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.config import settings
from app.database.session import get_db
from app.database.models import Document, Clause, AmendmentEdge, Conflict
from app.schemas.system import HealthResponse, AnalyticsResponse, LLMHealthResponse
from app.retrieval.vector_store import get_qdrant_client

router = APIRouter(tags=["System"])

@router.get("/health/llm", response_model=LLMHealthResponse)
async def get_llm_health(check_connectivity: bool = False):
    """
    Dedicated LLM provider health check.
    Reports configured provider, model, API key presence, and optional connectivity.
    Never exposes API keys or burns generation tokens on ordinary health checks.
    """
    from app.providers.provider_factory import get_llm_provider
    provider = get_llm_provider()
    res = await provider.check_health(check_connectivity=check_connectivity)
    return LLMHealthResponse(**res)

@router.get("/health", response_model=HealthResponse)
async def get_health(db: AsyncSession = Depends(get_db)):
    import shutil
    db_status = "connected"
    try:
        await db.execute(select(1))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    qdrant_status = "connected"
    try:
        client = get_qdrant_client()
        client.get_collections()
    except Exception as e:
        qdrant_status = f"unhealthy: {str(e)}"

    storage_writable = os.access(settings.UPLOAD_DIR, os.W_OK) and os.access(settings.RENDERED_DIR, os.W_OK)

    from app.providers.provider_factory import get_llm_provider
    provider = get_llm_provider()
    llm_info = await provider.check_health(check_connectivity=False)

    # Real BGE-M3 health
    from app.retrieval.embeddings import check_embedding_health
    bge_health = check_embedding_health()

    # Real NLI verifier health
    from app.verification.gate import get_nli_model, _nli_model_name
    nli_model = get_nli_model()
    nli_health = {
        "status": "ready" if nli_model is not None else "degraded",
        "model": _nli_model_name,
        "is_real": nli_model is not None
    }

    # Tesseract OCR availability
    tess_path = shutil.which("tesseract")
    tess_health = {
        "status": "available" if tess_path else "unavailable",
        "path": tess_path,
        "available": bool(tess_path)
    }

    fallback_modes = []
    if bge_health.get("status") != "ready":
        fallback_modes.append("bge_m3_dense_unavailable")
    if nli_health.get("status") != "ready":
        fallback_modes.append("heuristic_nli_fallback")
    if not tess_health.get("available"):
        fallback_modes.append("ocr_unavailable")
    if llm_info.get("status") not in ("configured", "ready"):
        fallback_modes.append("llm_extractive_fallback")

    degraded = len(fallback_modes) > 0 or db_status != "connected" or qdrant_status != "connected"

    return HealthResponse(
        status="degraded" if degraded else "healthy",
        degraded=degraded,
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
        database=db_status,
        vector_store=qdrant_status,
        storage_writable=storage_writable,
        bge_m3=bge_health,
        nli_verifier=nli_health,
        tesseract=tess_health,
        llm=llm_info,
        fallback_modes=fallback_modes
    )

@router.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics(db: AsyncSession = Depends(get_db)):
    total_docs = await db.scalar(select(func.count(Document.id))) or 0
    processed_docs = await db.scalar(select(func.count(Document.id)).where(Document.status == "PROCESSED")) or 0
    extracted_clauses = await db.scalar(select(func.count(Clause.id))) or 0
    active_amendments = await db.scalar(select(func.count(AmendmentEdge.id))) or 0
    detected_conflicts = await db.scalar(select(func.count(Conflict.id))) or 0
    pending_reviews = await db.scalar(select(func.count(Conflict.id)).where(Conflict.resolution_status == "PENDING_REVIEW")) or 0

    # Fetch 5 recent documents for recent activity
    recent_docs_query = select(Document).order_by(Document.created_at.desc()).limit(5)
    recent_docs_res = await db.execute(recent_docs_query)
    recent_docs = recent_docs_res.scalars().all()

    activity = [
        {
            "id": doc.id,
            "type": "DOCUMENT_INGESTION",
            "title": f"Document {doc.name}",
            "status": doc.status,
            "timestamp": doc.created_at.isoformat()
        }
        for doc in recent_docs
    ]

    return AnalyticsResponse(
        total_documents=total_docs,
        processed_documents=processed_docs,
        extracted_clauses=extracted_clauses,
        active_amendments=active_amendments,
        detected_conflicts=detected_conflicts,
        pending_reviews=pending_reviews,
        recent_activity=activity
    )

@router.post("/reindex")
async def trigger_reindex(db: AsyncSession = Depends(get_db)):
    """
    Reindex all processed clauses from SQLite database into Qdrant using BGE-M3 dense embeddings.
    """
    from app.database.models import Page
    from app.retrieval.vector_store import index_clauses_in_qdrant

    stmt = select(Clause)
    res = await db.execute(stmt)
    clauses = res.scalars().all()

    clauses_payload = []
    for c in clauses:
        doc = await db.get(Document, c.document_id)
        page = await db.get(Page, c.page_id) if c.page_id else None

        clauses_payload.append({
            "clause_id": c.id,
            "id": c.id,
            "document_id": c.document_id,
            "document_name": doc.name if doc else "Document",
            "clause_number": c.clause_number,
            "section_title": c.section_title or "General",
            "clause_text": c.clause_text or "",
            "page_number": page.page_number if page else 1,
            "bounding_box": c.bounding_box,
            "doc_type": doc.document_type if doc else "OTHER",
            "effective_from": str(c.effective_from or doc.effective_from if doc else ""),
            "status": doc.doc_status if doc else "IN_FORCE",
            "source_sha256": doc.file_hash if doc else ""
        })

    indexed_count = index_clauses_in_qdrant(clauses_payload)
    return {
        "status": "success",
        "total_clauses": len(clauses),
        "indexed_points": indexed_count,
        "collection": settings.QDRANT_COLLECTION,
        "embedding_model": settings.EMBEDDING_MODEL
    }
