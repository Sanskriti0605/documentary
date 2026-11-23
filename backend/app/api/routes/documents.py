import os
import hashlib
from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from app.core.config import settings
from app.database.session import get_db
from app.database.models import Document, Page, Clause, IngestionJob
from app.schemas.document import (
    DocumentResponse,
    DocumentListResponse,
    ClauseResponse,
    IngestionJobResponse
)
from app.ingestion.pipeline import run_document_ingestion_pipeline

router = APIRouter(prefix="/documents", tags=["Documents"])

@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    document_type: str = Form("OTHER"),
    domain: str = Form("RETAIL_LENDING"),
    issuer: Optional[str] = Form(None),
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF documents are supported."
        )

    file_path = os.path.join(settings.UPLOAD_DIR, file.filename)
    counter = 1
    base_name, ext = os.path.splitext(file.filename)
    while os.path.exists(file_path):
        file_path = os.path.join(settings.UPLOAD_DIR, f"{base_name}_{counter}{ext}")
        counter += 1

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    file_hash = hashlib.sha256(content).hexdigest()

    existing_stmt = select(Document).where(Document.file_hash == file_hash)
    existing_res = await db.execute(existing_stmt)
    existing_doc = existing_res.scalar_one_or_none()
    if existing_doc:
        return existing_doc

    doc = Document(
        name=file.filename,
        file_hash=file_hash,
        file_path=file_path,
        document_type=document_type,
        domain=domain,
        issuer=issuer,
        status="PROCESSING"
    )
    db.add(doc)
    await db.flush()

    job = IngestionJob(
        document_id=doc.id,
        status="PROCESSING",
        progress=0.1
    )
    db.add(job)
    await db.commit()
    await db.refresh(doc)

    # Execute full pipeline synchronously or via background task
    try:
        await run_document_ingestion_pipeline(doc.id, db)
    except Exception as e:
        doc.status = "FAILED"
        job.status = "FAILED"
        job.error_message = str(e)
        await db.commit()

    await db.refresh(doc)
    return doc

@router.get("", response_model=DocumentListResponse)
async def list_documents(
    skip: int = 0,
    limit: int = 50,
    document_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(Document)
    if document_type:
        query = query.where(Document.document_type == document_type)
    query = query.order_by(Document.created_at.desc()).offset(skip).limit(limit)

    res = await db.execute(query)
    docs = res.scalars().all()

    total_query = select(func.count(Document.id))
    if document_type:
        total_query = total_query.where(Document.document_type == document_type)
    total = await db.scalar(total_query) or 0

    doc_responses = []
    for d in docs:
        page_cnt = await db.scalar(select(func.count(Page.id)).where(Page.document_id == d.id)) or 0
        clause_cnt = await db.scalar(select(func.count(Clause.id)).where(Clause.document_id == d.id)) or 0
        doc_resp = DocumentResponse.model_validate(d)
        doc_resp.page_count = page_cnt
        doc_resp.clause_count = clause_cnt
        doc_responses.append(doc_resp)

    return DocumentListResponse(total=total, documents=doc_responses)

@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: str, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    page_cnt = await db.scalar(select(func.count(Page.id)).where(Page.document_id == doc.id)) or 0
    clause_cnt = await db.scalar(select(func.count(Clause.id)).where(Clause.document_id == doc.id)) or 0
    resp = DocumentResponse.model_validate(doc)
    resp.page_count = page_cnt
    resp.clause_count = clause_cnt
    return resp

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(document_id: str, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except OSError:
            pass
    await db.delete(doc)
    await db.commit()
    return None

@router.post("/{document_id}/process", response_model=IngestionJobResponse)
async def process_document(
    document_id: str,
    db: AsyncSession = Depends(get_db)
):
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    job = IngestionJob(
        document_id=doc.id,
        status="PROCESSING",
        progress=0.5
    )
    db.add(job)
    await db.commit()

    try:
        await run_document_ingestion_pipeline(doc.id, db)
        job.status = "COMPLETED"
        job.progress = 1.0
    except Exception as e:
        job.status = "FAILED"
        job.error_message = str(e)

    await db.commit()
    await db.refresh(job)
    return job

@router.get("/{document_id}/status", response_model=IngestionJobResponse)
async def get_document_status(document_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(IngestionJob).where(IngestionJob.document_id == document_id).order_by(IngestionJob.created_at.desc())
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No ingestion job found for document")
    return job

@router.get("/{document_id}/clauses", response_model=List[ClauseResponse])
async def get_document_clauses(document_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Clause).where(Clause.document_id == document_id).order_by(Clause.clause_number)
    res = await db.execute(stmt)
    clauses = res.scalars().all()
    return [ClauseResponse.model_validate(c) for c in clauses]
