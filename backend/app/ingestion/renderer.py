import os
from typing import Optional, List
import fitz  # PyMuPDF
from app.core.config import settings

def render_pdf_page_image(
    file_path: str,
    page_number: int,
    highlight_bbox: Optional[List[float]] = None,
    dpi: int = 150
) -> str:
    """
    Renders a specific PDF page to a PNG image file.
    If highlight_bbox [x0, y0, x1, y1] is provided, draws a semi-transparent yellow highlight.
    Returns the absolute path to the rendered image.
    """
    os.makedirs(settings.RENDERED_DIR, exist_ok=True)
    base_name = os.path.splitext(os.path.basename(file_path))[0]
    out_filename = f"{base_name}_page_{page_number}.png"
    if highlight_bbox:
        bbox_str = "_".join(str(int(x)) for x in highlight_bbox)
        out_filename = f"{base_name}_page_{page_number}_hl_{bbox_str}.png"

    out_path = os.path.join(settings.RENDERED_DIR, out_filename)
    if os.path.exists(out_path):
        return out_path

    doc = fitz.open(file_path)
    if page_number < 1 or page_number > len(doc):
        raise ValueError(f"Page number {page_number} out of range (1-{len(doc)})")

    page = doc[page_number - 1]

    # Draw highlight if requested
    if highlight_bbox and len(highlight_bbox) == 4:
        rect = fitz.Rect(highlight_bbox[0], highlight_bbox[1], highlight_bbox[2], highlight_bbox[3])
        annot = page.add_rect_annot(rect)
        annot.set_colors(stroke=(1, 0.8, 0), fill=(1, 0.95, 0.4))
        annot.set_opacity(0.4)
        annot.update()

    zoom = dpi / 72.0
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat)
    pix.save(out_path)
    doc.close()

    return out_path
