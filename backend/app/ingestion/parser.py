import os
import re
from typing import List, Dict, Any, Optional, Tuple
import fitz  # PyMuPDF
try:
    import pdfplumber
except ImportError:
    pdfplumber = None

class ParsedPage:
    def __init__(self, page_number: int, text: str, spans: List[Dict[str, Any]], tables: List[Dict[str, Any]]):
        self.page_number = page_number
        self.text = text
        self.spans = spans
        self.tables = tables

class ParsedDocument:
    def __init__(self, filename: str, pages: List[ParsedPage], metadata: Dict[str, Any]):
        self.filename = filename
        self.pages = pages
        self.metadata = metadata

def parse_pdf(file_path: str) -> Tuple[List[ParsedPage], Dict[str, Any]]:
    """
    Extract text spans with (doc, page, bbox), tables as structured rows,
    and stitch multi-page sections.
    """
    doc = fitz.open(file_path)
    parsed_pages: List[ParsedPage] = []
    all_pages_text: List[str] = []

    # Optional pdfplumber for table extraction
    pdf_plumber_doc = None
    if pdfplumber is not None:
        try:
            pdf_plumber_doc = pdfplumber.open(file_path)
        except Exception:
            pdf_plumber_doc = None

    for page_idx in range(len(doc)):
        page_num = page_idx + 1
        page = doc[page_idx]

        # Extract words/spans with bounding boxes [x0, y0, x1, y1], filtering rotated watermark lines
        d = page.get_text("dict")
        spans = []
        clean_lines_text = []

        for block in d.get("blocks", []):
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                line_dir = line.get("dir", (1.0, 0.0))
                # Skip rotated text (e.g. diagonal watermark)
                if abs(line_dir[1]) > 0.01 or abs(line_dir[0] - 1.0) > 0.01:
                    continue

                line_words_text = []
                for span in line.get("spans", []):
                    span_dir = span.get("dir", line_dir) or line_dir
                    if abs(span_dir[1]) > 0.01 or abs(span_dir[0] - 1.0) > 0.01:
                        continue
                    text = span.get("text", "")
                    if not text.strip():
                        continue
                    # Filter oversized watermark keywords
                    if text.strip().lower() in ["draft", "confidential", "sample", "specimen"] and span.get("size", 0) >= 32:
                        continue

                    line_words_text.append(text)
                    bbox = span.get("bbox", [0, 0, 0, 0])
                    words = text.split()
                    char_w = (bbox[2] - bbox[0]) / max(len(text), 1)
                    curr_x = bbox[0]
                    for w in words:
                        w_len = len(w) * char_w
                        spans.append({
                            "bbox": [round(curr_x, 2), round(bbox[1], 2), round(curr_x + w_len, 2), round(bbox[3], 2)],
                            "text": w,
                            "block": block.get("number", 0),
                            "line": line.get("number", 0)
                        })
                        curr_x += (len(w) + 1) * char_w

                if line_words_text:
                    clean_lines_text.append(" ".join(line_words_text))

        full_page_text = "\n".join(clean_lines_text) if clean_lines_text else page.get_text("text")
        all_pages_text.append(full_page_text)

        # Extract structured tables using pdfplumber if available
        tables = []
        if pdf_plumber_doc is not None and page_idx < len(pdf_plumber_doc.pages):
            try:
                plumber_page = pdf_plumber_doc.pages[page_idx]
                extracted_tables = plumber_page.extract_tables()
                for t in extracted_tables:
                    # Filter empty rows
                    cleaned_rows = [[cell.strip() if cell else "" for cell in row] for row in t if any(row)]
                    if cleaned_rows:
                        headers = cleaned_rows[0]
                        data_rows = cleaned_rows[1:]
                        tables.append({
                            "headers": headers,
                            "rows": data_rows,
                            "raw": cleaned_rows
                        })
            except Exception:
                pass

        parsed_pages.append(ParsedPage(
            page_number=page_num,
            text=full_page_text,
            spans=spans,
            tables=tables
        ))

    if pdf_plumber_doc is not None:
        try:
            pdf_plumber_doc.close()
        except Exception:
            pass

    return parsed_pages, all_pages_text

def segment_clauses_with_bboxes(
    parsed_pages: List[ParsedPage]
) -> List[Dict[str, Any]]:
    """
    Segment document pages into structured clauses and preserve bounding boxes.
    Detects clause numbering schemes (e.g. 1.1, Clause 4, Section 5(a), Paragraph 2).
    Stitches continuous multi-page clauses together.
    """
    clauses: List[Dict[str, Any]] = []
    clause_regex = re.compile(
        r"^(?:Clause|Section|Article|Paragraph|Rule)?\s*([0-9]{1,2}(?:\.[0-9]{1,2})*|[0-9]{1,2}\([a-z]\))\s*[:\.\-]?\s*(.*)",
        re.IGNORECASE
    )

    current_clause = None

    for page in parsed_pages:
        lines = page.text.split("\n")
        line_cursor = 0

        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue

            match = clause_regex.match(line_str)
            if match and len(line_str) < 120 and not line_str.endswith("."):
                # Detected a new clause or section header
                if current_clause:
                    clauses.append(current_clause)

                clause_num = match.group(1)
                section_title = match.group(2) if match.group(2) else line_str

                # Find tight line-level bounding box for the header line
                norm_cnum = clause_num.strip().rstrip(".").lower()
                candidate_anchors = [
                    s for s in page.spans
                    if 40.0 < s["bbox"][1] < 780.0
                    and (s["text"].strip().rstrip(".").lower() == norm_cnum or s["text"].strip().lower().startswith(norm_cnum))
                ]
                best_anchor = None
                for a in candidate_anchors:
                    same_line_spans = [
                        s for s in page.spans
                        if abs(s["bbox"][1] - a["bbox"][1]) < 6.0
                        and s["text"].strip()
                        and s["text"].lower() in line_str.lower()
                    ]
                    line_words = " ".join(s["text"] for s in same_line_spans)
                    if norm_cnum in line_words.lower():
                        best_anchor = a
                        break

                bbox = None
                if best_anchor:
                    same_line_spans = [
                        s for s in page.spans
                        if abs(s["bbox"][1] - best_anchor["bbox"][1]) < 6.0
                        and s["text"].strip()
                        and s["text"].lower() in line_str.lower()
                    ]
                    if same_line_spans:
                        bx0 = round(min(s["bbox"][0] for s in same_line_spans), 2)
                        by0 = round(min(s["bbox"][1] for s in same_line_spans), 2)
                        bx1 = round(max(s["bbox"][2] for s in same_line_spans), 2)
                        by1 = round(max(s["bbox"][3] for s in same_line_spans), 2)
                        # Safety check: header line height <= 35 pt and area <= 8% of page
                        if (by1 - by0) <= 35.0 and (bx1 - bx0) * (by1 - by0) <= 0.08 * (595.0 * 842.0):
                            bbox = [bx0, by0, bx1, by1]

                current_clause = {
                    "page_number": page.page_number,
                    "clause_number": clause_num,
                    "section_title": section_title,
                    "clause_text": line_str,
                    "bounding_box": bbox,
                    "tables": page.tables
                }
            else:
                if current_clause:
                    current_clause["clause_text"] += " " + line_str
                else:
                    # Lead-in paragraph or header before first clause
                    lead_spans = [s["bbox"] for s in page.spans if 40.0 < s["bbox"][1] < 180.0]
                    lead_bbox = None
                    if lead_spans:
                        lx0 = round(min(s[0] for s in lead_spans), 2)
                        ly0 = round(min(s[1] for s in lead_spans), 2)
                        lx1 = round(max(s[2] for s in lead_spans), 2)
                        ly1 = round(max(s[3] for s in lead_spans), 2)
                        if (ly1 - ly0) <= 120.0:
                            lead_bbox = [lx0, ly0, lx1, ly1]
                    current_clause = {
                        "page_number": page.page_number,
                        "clause_number": "Preamble",
                        "section_title": "Preamble / General Provisions",
                        "clause_text": line_str,
                        "bounding_box": lead_bbox,
                        "tables": page.tables
                    }

    if current_clause:
        clauses.append(current_clause)

    return clauses
