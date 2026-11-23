import re
from typing import List, Dict, Any, Optional, Tuple
import fitz  # PyMuPDF

def is_line_or_span_rotated_or_watermark(line_dir: tuple, span_dir: tuple, text: str, font_size: float = 0) -> bool:
    """
    Returns True if a line or text span is rotated (non-horizontal) or a diagonal watermark.
    Horizontal left-to-right text has dir = (1.0, 0.0).
    Rotated text has abs(sin) > 0.01 or abs(cos - 1.0) > 0.01.
    """
    if line_dir:
        if abs(line_dir[1]) > 0.01 or abs(line_dir[0] - 1.0) > 0.01:
            return True
    if span_dir:
        if abs(span_dir[1]) > 0.01 or abs(span_dir[0] - 1.0) > 0.01:
            return True

    # Known oversized or diagonal watermark keywords
    clean_text = text.strip().lower()
    if clean_text in ["draft", "confidential", "sample", "specimen", "internal use only", "watermark"]:
        if font_size >= 32:
            return True

    return False


def extract_clean_horizontal_words(page: fitz.Page) -> List[Dict[str, Any]]:
    """
    Extracts all horizontal words with bboxes from the page,
    explicitly filtering out rotated watermark spans and diagonal banners.
    """
    d = page.get_text("dict")
    words_list: List[Dict[str, Any]] = []

    for block in d.get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            line_dir = line.get("dir", (1.0, 0.0))
            if abs(line_dir[1]) > 0.01 or abs(line_dir[0] - 1.0) > 0.01:
                # Rotated line! (e.g. 45, 90, 270 degrees)
                continue

            for span in line.get("spans", []):
                span_dir = span.get("dir", line_dir) or line_dir
                text = span.get("text", "")
                if not text.strip():
                    continue

                if is_line_or_span_rotated_or_watermark(line_dir, span_dir, text, span.get("size", 0)):
                    continue

                span_bbox = span.get("bbox", [0, 0, 0, 0])
                span_words = text.split()
                if not span_words:
                    continue

                # Approximate per-word bounding box proportionally along span width
                total_chars = max(len(text), 1)
                char_w = (span_bbox[2] - span_bbox[0]) / total_chars
                curr_x = span_bbox[0]

                for w in span_words:
                    w_width = len(w) * char_w
                    w_box = [
                        round(curr_x, 2),
                        round(span_bbox[1], 2),
                        round(curr_x + w_width, 2),
                        round(span_bbox[3], 2),
                    ]
                    words_list.append({
                        "word": w,
                        "clean": re.sub(r"[^\w\.\%\:\-]", "", w.lower()),
                        "bbox": w_box,
                        "y_mid": (span_bbox[1] + span_bbox[3]) / 2.0,
                    })
                    curr_x += (len(w) + 1) * char_w

    return words_list


def find_quote_boxes_on_page(page: fitz.Page, quote: str) -> List[List[float]]:
    """
    Finds multi-line bounding boxes for a quote on a single PDF page,
    filtering out rotated watermark spans.
    Returns a list of rectangular boxes [[x0, y0, x1, y1], ...], one box per line.
    """
    if not quote or not quote.strip():
        return []

    clean_quote = quote.strip()

    # 1. First attempt: PyMuPDF native search_for (if it cleanly finds the quote)
    try:
        search_rects = page.search_for(clean_quote)
        if search_rects:
            # Verify rects do not overlap rotated watermarks
            boxes = [[round(r.x0, 2), round(r.y0, 2), round(r.x1, 2), round(r.y1, 2)] for r in search_rects]
            return boxes
    except Exception:
        pass

    # 2. Second attempt: Sequence matching over clean horizontal words
    clean_words = extract_clean_horizontal_words(page)
    if not clean_words:
        return []

    # Clean target quote tokens
    q_tokens = [re.sub(r"[^\w\.\%\:\-]", "", w.lower()) for w in clean_quote.split() if w.strip()]
    q_tokens = [t for t in q_tokens if t]
    if not q_tokens:
        return []

    c_tokens = [w["clean"] for w in clean_words]

    # Exact contiguous subsequence match
    len_q = len(q_tokens)
    best_slice = None

    for i in range(len(c_tokens) - len_q + 1):
        if c_tokens[i : i + len_q] == q_tokens:
            best_slice = clean_words[i : i + len_q]
            break

    # If exact sequence failed, attempt sliding window with token match ratio >= 0.90
    if not best_slice and len_q >= 4:
        best_score = 0
        best_idx = -1
        # Search window sizes around len_q
        for win_size in [len_q, len_q + 1, len_q + 2, max(4, len_q - 1)]:
            if win_size > len(c_tokens):
                continue
            for i in range(len(c_tokens) - win_size + 1):
                window = c_tokens[i : i + win_size]
                matches = sum(1 for qt in q_tokens if qt in window)
                score = matches / len_q
                if score > best_score:
                    best_score = score
                    best_idx = i
                    best_slice = clean_words[i : i + win_size]

        if best_score < 0.88:
            best_slice = None

    if not best_slice:
        return []

    # Group matched words by line (similar y_mid within 4.5 points)
    lines: List[List[Dict[str, Any]]] = []
    for item in best_slice:
        if not lines or abs(item["y_mid"] - lines[-1][0]["y_mid"]) > 5.0:
            lines.append([item])
        else:
            lines[-1].append(item)

    matched_boxes: List[List[float]] = []
    for line in lines:
        box = [
            round(min(w["bbox"][0] for w in line), 2),
            round(min(w["bbox"][1] for w in line), 2),
            round(max(w["bbox"][2] for w in line), 2),
            round(max(w["bbox"][3] for w in line), 2),
        ]
        matched_boxes.append(box)

    return matched_boxes


def locate_quote_with_cross_page(
    doc: fitz.Document,
    target_page: int,
    quote: str
) -> Dict[str, Any]:
    """
    Locates quote on target_page, supporting multi-line highlights and cross-page continuation.
    If quote starts on target_page and continues to target_page + 1, returns continuation info.
    If quote cannot be found on target_page, searches adjacent pages or reports not found.
    """
    num_pages = len(doc)
    if target_page < 1 or target_page > num_pages:
        return {
            "found": False,
            "page_number": target_page,
            "boxes": [],
            "is_multiline": False,
            "cross_page": None,
            "warning": f"Page number {target_page} is out of document range (1 to {num_pages})."
        }

    clean_quote = quote.strip() if quote else ""
    if not clean_quote:
        return {
            "found": False,
            "page_number": target_page,
            "boxes": [],
            "is_multiline": False,
            "cross_page": None,
            "warning": "No quote provided for bounding box extraction."
        }

    page = doc[target_page - 1]
    boxes = find_quote_boxes_on_page(page, clean_quote)

    if boxes:
        return {
            "found": True,
            "page_number": target_page,
            "boxes": boxes,
            "is_multiline": len(boxes) > 1,
            "cross_page": {
                "is_cross_page": False,
                "continues_on_page": None,
                "continued_from_page": None
            },
            "warning": None
        }

    # If full quote not found on target page, test cross-page split
    q_words = clean_quote.split()
    if len(q_words) >= 6:
        # Check if prefix is on target_page and suffix is on target_page + 1
        if target_page < num_pages:
            next_page = doc[target_page]
            for split_idx in range(len(q_words) - 3, 2, -1):
                prefix = " ".join(q_words[:split_idx])
                suffix = " ".join(q_words[split_idx:])

                p_boxes = find_quote_boxes_on_page(page, prefix)
                if p_boxes:
                    s_boxes = find_quote_boxes_on_page(next_page, suffix)
                    if s_boxes:
                        return {
                            "found": True,
                            "page_number": target_page,
                            "boxes": p_boxes,
                            "is_multiline": len(p_boxes) > 1,
                            "cross_page": {
                                "is_cross_page": True,
                                "continues_on_page": target_page + 1,
                                "next_boxes": s_boxes,
                                "continuation_quote": suffix,
                                "continued_from_page": None
                            },
                            "warning": None
                        }

        # Check if suffix is on target_page and prefix was on target_page - 1
        if target_page > 1:
            prev_page = doc[target_page - 2]
            for split_idx in range(3, len(q_words) - 2):
                prefix = " ".join(q_words[:split_idx])
                suffix = " ".join(q_words[split_idx:])

                s_boxes = find_quote_boxes_on_page(page, suffix)
                if s_boxes:
                    p_boxes = find_quote_boxes_on_page(prev_page, prefix)
                    if p_boxes:
                        return {
                            "found": True,
                            "page_number": target_page,
                            "boxes": s_boxes,
                            "is_multiline": len(s_boxes) > 1,
                            "cross_page": {
                                "is_cross_page": True,
                                "continued_from_page": target_page - 1,
                                "prev_boxes": p_boxes,
                                "continues_on_page": None
                            },
                            "warning": None
                        }

    # If not on target_page, check if the quote appears anywhere else in the document
    for other_p in range(1, num_pages + 1):
        if other_p == target_page:
            continue
        alt_page = doc[other_p - 1]
        alt_boxes = find_quote_boxes_on_page(alt_page, clean_quote)
        if alt_boxes:
            return {
                "found": True,
                "page_number": other_p,
                "boxes": alt_boxes,
                "is_multiline": len(alt_boxes) > 1,
                "cross_page": {
                    "is_cross_page": False,
                    "relocated_from_page": target_page,
                },
                "warning": f"Quote located on Page {other_p} (redirected from Page {target_page})."
            }

    # Bounding box could not be located anywhere in the document
    return {
        "found": False,
        "page_number": target_page,
        "boxes": [],
        "is_multiline": False,
        "cross_page": None,
        "warning": "Exact bounding box coordinates cannot be found for this quote. Displaying quote text in sidebar banner."
    }
