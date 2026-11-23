import os
import hashlib
from typing import Optional, List, Tuple
import fitz  # PyMuPDF
from app.core.config import settings

CLAUSE_COLOR_PALETTE = [
    {"stroke": (0.92, 0.55, 0.0), "fill": (1.0, 0.90, 0.35)},  # Amber / Gold
    {"stroke": (0.05, 0.65, 0.35), "fill": (0.55, 0.95, 0.70)}, # Emerald Green
    {"stroke": (0.10, 0.50, 0.92), "fill": (0.65, 0.85, 1.0)},  # Sky Blue
    {"stroke": (0.58, 0.22, 0.85), "fill": (0.85, 0.70, 1.0)},  # Purple
    {"stroke": (0.90, 0.20, 0.40), "fill": (1.0, 0.70, 0.80)},  # Rose
    {"stroke": (0.05, 0.60, 0.60), "fill": (0.55, 0.92, 0.92)}, # Teal
]

def render_pdf_page_image(
    file_path: str,
    page_number: int,
    highlight_bbox: Optional[List[float]] = None,
    all_bboxes: Optional[List[List[float]]] = None,
    dpi: int = 150
) -> Tuple[str, float, float]:
    """
    Renders a specific PDF page to a PNG image file.
    Draws multi-colored bounding boxes for different extracted clauses.
    Returns (out_path, page_width, page_height).
    """
    os.makedirs(settings.RENDERED_DIR, exist_ok=True)
    base_name = os.path.splitext(os.path.basename(file_path))[0]
    
    # Generate unique cached filename based on highlights
    hl_key = ""
    if highlight_bbox:
        hl_key += f"_hl_{'_'.join(str(int(x)) for x in highlight_bbox)}"
    if all_bboxes:
        bboxes_raw = ";".join(",".join(str(int(v)) for v in b) for b in all_bboxes)
        short_hash = hashlib.md5(bboxes_raw.encode()).hexdigest()[:8]
        hl_key += f"_all_{short_hash}"

    out_filename = f"{base_name}_page_{page_number}{hl_key}.png"
    out_path = os.path.join(settings.RENDERED_DIR, out_filename)

    doc = fitz.open(file_path)
    if page_number < 1 or page_number > len(doc):
        raise ValueError(f"Page number {page_number} out of range (1-{len(doc)})")

    page = doc[page_number - 1]
    page_width = float(page.rect.width)
    page_height = float(page.rect.height)

    if os.path.exists(out_path):
        doc.close()
        return out_path, page_width, page_height

    # 1. Draw multi-colored clause bounding boxes
    matched_primary = False
    if all_bboxes:
        for idx, b in enumerate(all_bboxes):
            if len(b) == 4:
                is_primary = highlight_bbox and all(abs(b[i] - highlight_bbox[i]) < 1.0 for i in range(4))
                if is_primary:
                    matched_primary = True
                color = CLAUSE_COLOR_PALETTE[idx % len(CLAUSE_COLOR_PALETTE)]
                rect = fitz.Rect(b[0], b[1], b[2], b[3])
                annot = page.add_rect_annot(rect)
                annot.set_colors(stroke=color["stroke"], fill=color["fill"])
                annot.set_opacity(0.55 if is_primary else 0.33)
                annot.update()

    # 2. Draw active primary highlight if not already drawn in all_bboxes
    if highlight_bbox and len(highlight_bbox) == 4 and not matched_primary:
        rect = fitz.Rect(highlight_bbox[0], highlight_bbox[1], highlight_bbox[2], highlight_bbox[3])
        annot = page.add_rect_annot(rect)
        annot.set_colors(stroke=(0.95, 0.55, 0.0), fill=(1.0, 0.88, 0.1))
        annot.set_opacity(0.55)
        annot.update()

    zoom = dpi / 72.0
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat)
    pix.save(out_path)
    doc.close()

    return out_path, page_width, page_height
