import os
from typing import Optional, List
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse
from app.core.config import settings
from app.ingestion.renderer import render_pdf_page_image

router = APIRouter(prefix="/pdf", tags=["PDF Rendering"])

@router.get("/{document_name}/page/{page_number}")
async def get_pdf_page_image(
    document_name: str,
    page_number: int,
    bbox: Optional[str] = None # comma separated x0,y0,x1,y1
):
    """
    Renders and returns a high-resolution PNG image of the requested PDF page.
    If bbox is passed (e.g. 50,120,400,160), highlights the exact cited text passage.
    """
    file_path = os.path.join(settings.UPLOAD_DIR, document_name)
    if not os.path.exists(file_path):
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

    try:
        img_path = render_pdf_page_image(file_path, page_number, parsed_bbox)
        return FileResponse(img_path, media_type="image/png")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to render page image: {str(e)}"
        )
