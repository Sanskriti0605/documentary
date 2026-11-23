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

        # Extract words/spans with bounding boxes [x0, y0, x1, y1]
        text_page = page.get_text("words")  # (x0, y0, x1, y1, word, block_no, line_no, word_no)
        spans = []
        for item in text_page:
            spans.append({
                "bbox": [round(item[0], 2), round(item[1], 2), round(item[2], 2), round(item[3], 2)],
                "text": item[4],
                "block": item[5],
                "line": item[6]
            })

        full_page_text = page.get_text("text")
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

                # Find approximate bounding box from spans
                matching_spans = [s["bbox"] for s in page.spans if s["text"].lower() in line_str.lower()]
                bbox = None
                if matching_spans:
                    bbox = [
                        min(s[0] for s in matching_spans),
                        min(s[1] for s in matching_spans),
                        max(s[2] for s in matching_spans),
                        max(s[3] for s in matching_spans),
                    ]

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
                    current_clause = {
                        "page_number": page.page_number,
                        "clause_number": "Preamble",
                        "section_title": "Preamble / General Provisions",
                        "clause_text": line_str,
                        "bounding_box": None,
                        "tables": page.tables
                    }

    if current_clause:
        clauses.append(current_clause)

    return clauses
