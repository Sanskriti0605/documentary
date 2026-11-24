import os
import json
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import fitz
from app.core.config import settings
from app.database.session import get_db
from app.database.models import Document, Page, Clause
from app.ingestion.renderer import render_pdf_page_image
from app.ingestion.quote_matcher import locate_quote_with_cross_page, find_quote_boxes_on_page

router = APIRouter(prefix="/pdf", tags=["PDF Rendering"])

async def resolve_document_file_path(document_name: str, db: AsyncSession) -> tuple[Document, str]:
    """Helper to locate document model and verified disk file path."""
    stmt = select(Document).where((Document.id == document_name) | (Document.name == document_name))
    res = await db.execute(stmt)
    doc = res.scalar_one_or_none()

    file_path = os.path.join(settings.UPLOAD_DIR, document_name)
    if doc:
        if os.path.exists(doc.file_path):
            file_path = doc.file_path
        elif os.path.exists(os.path.join(settings.UPLOAD_DIR, doc.name)):
            file_path = os.path.join(settings.UPLOAD_DIR, doc.name)
    elif not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{document_name}' not found on server."
        )

    return doc, file_path


@router.get("/{document_name}/info")
async def get_pdf_info(document_name: str, db: AsyncSession = Depends(get_db)):
    """
    Returns total page count and width/height dimensions for all pages of the document.
    """
    doc, file_path = await resolve_document_file_path(document_name, db)

    try:
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
        return {
            "document_id": doc.id if doc else document_name,
            "document_name": doc.name if doc else document_name,
            "page_count": total_pages,
            "pages": pages_info
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to inspect PDF metadata: {str(e)}"
        )


@router.get("/{document_name}/quote-boxes")
async def get_quote_boxes(
    document_name: str,
    quote: str = Query(..., description="The cited quotation string"),
    page: int = Query(1, description="Target page number"),
    bbox: Optional[str] = Query(None, description="Optional bounding box hint [x0,y0,x1,y1] for occurrence disambiguation"),
    db: AsyncSession = Depends(get_db)
):
    """
    Computes exact bounding boxes for a cited quote on the target page,
    supporting multi-line line-by-line rectangles and cross-page continuation.
    Filters out rotated watermark spans when computing boxes.
    If the quote cannot be located, returns found=False with a clear descriptive warning.
    """
    doc, file_path = await resolve_document_file_path(document_name, db)

    parsed_pref_bbox: Optional[List[float]] = None
    if bbox:
        try:
            parts = [float(v.strip()) for v in bbox.split(",") if v.strip()]
            if len(parts) == 4:
                parsed_pref_bbox = parts
        except Exception:
            pass

    try:
        pdf_doc = fitz.open(file_path)
        result = locate_quote_with_cross_page(pdf_doc, target_page=page, quote=quote, preferred_bbox=parsed_pref_bbox)
        pdf_doc.close()

        result["document_id"] = doc.id if doc else document_name
        result["document_name"] = doc.name if doc else document_name
        result["quote"] = quote

        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate quote bounding boxes: {str(e)}"
        )


@router.get("/{document_name}/page/{page_number}")
async def get_pdf_page_image(
    document_name: str,
    page_number: int,
    bbox: Optional[str] = None,       # single comma-separated x0,y0,x1,y1
    bboxes: Optional[str] = None,     # semicolon-separated multi-line boxes x0,y0,x1,y1;x0,y2,x1,y3
    quote: Optional[str] = None,      # quote text for dynamic multi-line calculation
    highlight_all: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """
    Renders and returns a high-resolution PNG image of the requested PDF page.
    Overlays multi-line highlight rectangles for quotes (filtering rotated watermarks).
    If highlight_all=True, also highlights all segmented clauses on this page.
    """
    doc, file_path = await resolve_document_file_path(document_name, db)
    target_doc_id = doc.id if doc else document_name

    parsed_bboxes: List[List[float]] = []
    if bboxes:
        for b_str in bboxes.split(";"):
            parts = [float(v.strip()) for v in b_str.split(",") if v.strip()]
            if len(parts) == 4:
                parsed_bboxes.append(parts)
    elif bbox:
        try:
            parts = [float(v.strip()) for v in bbox.split(",") if v.strip()]
            if len(parts) == 4:
                parsed_bboxes.append(parts)
        except Exception:
            pass

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
            file_path,
            page_number,
            highlight_bboxes=parsed_bboxes if parsed_bboxes else None,
            quote=quote,
            all_bboxes=all_bboxes
        )

        headers = {
            "X-Page-Width": str(page_w),
            "X-Page-Height": str(page_h),
            "Access-Control-Expose-Headers": "X-Page-Width, X-Page-Height, X-Quote-Boxes",
        }
        if parsed_bboxes:
            headers["X-Quote-Boxes"] = json.dumps(parsed_bboxes)

        return FileResponse(
            img_path,
            media_type="image/png",
            headers=headers
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to render page image: {str(e)}"
        )
