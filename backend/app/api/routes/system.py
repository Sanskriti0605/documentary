import os
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.config import settings
from app.database.session import get_db
from app.database.models import Document, Clause, AmendmentEdge, Conflict
from app.schemas.system import HealthResponse, AnalyticsResponse
from app.retrieval.vector_store import get_qdrant_client

router = APIRouter(tags=["System"])

@router.get("/health", response_model=HealthResponse)
async def get_health(db: AsyncSession = Depends(get_db)):
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

    return HealthResponse(
        status="healthy" if db_status == "connected" else "degraded",
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
        database=db_status,
        vector_store=qdrant_status,
        storage_writable=storage_writable
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
