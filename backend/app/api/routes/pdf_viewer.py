import os
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.database.session import get_db
from app.database.models import Document, Page, Clause
from app.ingestion.renderer import render_pdf_page_image

router = APIRouter(prefix="/pdf", tags=["PDF Rendering"])

@router.get("/{document_name}/info")
async def get_pdf_info(document_name: str, db: AsyncSession = Depends(get_db)):
    """
    Returns total page count and width/height dimensions for all pages of the document.
    """
    file_path = os.path.join(settings.UPLOAD_DIR, document_name)
    if not os.path.exists(file_path):
        stmt = select(Document).where((Document.id == document_name) | (Document.name == document_name))
        res = await db.execute(stmt)
        doc = res.scalar_one_or_none()
        if doc and os.path.exists(doc.file_path):
            file_path = doc.file_path
        elif doc and os.path.exists(os.path.join(settings.UPLOAD_DIR, doc.name)):
            file_path = os.path.join(settings.UPLOAD_DIR, doc.name)
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document '{document_name}' not found on server."
            )

    try:
        import fitz
        pdf_doc = fitz.open(file_path)
        pages_info = [
            {
                "page_number": i + 1,
                "width": round(float(pdf_doc[i].rect.width), 2),
                "height": round(float(pdf_doc[i].rect.height), 2)
            }
            for i in range(len(pdf_doc))
        ]
        total_pages = len(pdf_doc)
        pdf_doc.close()
        return {"page_count": total_pages, "pages": pages_info}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to inspect PDF metadata: {str(e)}"
        )

@router.get("/{document_name}/page/{page_number}")
async def get_pdf_page_image(
    document_name: str,
    page_number: int,
    bbox: Optional[str] = None, # comma separated x0,y0,x1,y1
    highlight_all: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """
    Renders and returns a high-resolution PNG image of the requested PDF page.
    If bbox is passed (e.g. 50,120,400,160), highlights the exact cited text passage in vibrant yellow.
    If highlight_all=True, also highlights all extracted clauses on this page.
    Supports document lookup by both filename and document UUID.
    """
    file_path = os.path.join(settings.UPLOAD_DIR, document_name)
    target_doc_id = document_name

    stmt = select(Document).where((Document.id == document_name) | (Document.name == document_name))
    res = await db.execute(stmt)
    doc = res.scalar_one_or_none()
    if doc:
        target_doc_id = doc.id
        if os.path.exists(doc.file_path):
            file_path = doc.file_path
        elif os.path.exists(os.path.join(settings.UPLOAD_DIR, doc.name)):
            file_path = os.path.join(settings.UPLOAD_DIR, doc.name)
    elif not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{document_name}' not found on server."
        )

    parsed_bbox = None
    if bbox:
        try:
            parsed_bbox = [float(v.strip()) for v in bbox.split(",")]
        except Exception:
            parsed_bbox = None

    all_bboxes = None
    if highlight_all and target_doc_id:
        clause_stmt = (
            select(Clause.bounding_box)
            .join(Page, Clause.page_id == Page.id)
            .where((Clause.document_id == target_doc_id) & (Page.page_number == page_number))
        )
        c_res = await db.execute(clause_stmt)
        raw_bboxes = c_res.scalars().all()
        all_bboxes = [b for b in raw_bboxes if b and isinstance(b, list) and len(b) == 4]

    try:
        img_path, page_w, page_h = render_pdf_page_image(
            file_path, page_number, highlight_bbox=parsed_bbox, all_bboxes=all_bboxes
        )
        return FileResponse(
            img_path,
            media_type="image/png",
            headers={
                "X-Page-Width": str(page_w),
                "X-Page-Height": str(page_h),
                "Access-Control-Expose-Headers": "X-Page-Width, X-Page-Height",
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to render page image: {str(e)}"
        )
