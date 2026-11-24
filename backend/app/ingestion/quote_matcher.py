import re
from typing import List, Dict, Any, Optional, Tuple
import fitz  # PyMuPDF

def normalize_token(w: str) -> str:
    """Normalize a word token by lowercasing, standardizing quotes/dashes, and stripping noise."""
    w = w.lower().strip()
    w = w.replace("“", "\"").replace("”", "\"").replace("‘", "'").replace("’", "'")
    w = w.replace("–", "-").replace("—", "-")
    w = re.sub(r"[^\w\.\%\:\-\/]", "", w)
    return w

def is_line_or_span_rotated_or_watermark(line_dir: tuple, span_dir: tuple, text: str, font_size: float = 0) -> bool:
    """
    Returns True if a line or text span is rotated (non-horizontal) or a diagonal/oversized watermark.
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
        if font_size >= 24:
            return True

    return False

def extract_clean_horizontal_words(page: fitz.Page, allow_header_footer: bool = False) -> List[Dict[str, Any]]:
    """
    Extracts all horizontal words with bboxes from the page,
    explicitly filtering out rotated watermark spans and diagonal banners.
    Returns words sorted in natural visual reading order (row-major: top-to-bottom, left-to-right),
    which correctly aligns multi-column tables and text blocks.
    """
    d = page.get_text("dict")
    words_list: List[Dict[str, Any]] = []
    page_h = page.rect.height

    for block in d.get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            line_dir = line.get("dir", (1.0, 0.0))
            if abs(line_dir[1]) > 0.01 or abs(line_dir[0] - 1.0) > 0.01:
                # Rotated line (e.g. 45, 90, 270 degrees)
                continue

            for span in line.get("spans", []):
                span_dir = span.get("dir", line_dir) or line_dir
                text = span.get("text", "")
                if not text.strip():
                    continue

                if is_line_or_span_rotated_or_watermark(line_dir, span_dir, text, span.get("size", 0)):
                    continue

                span_bbox = span.get("bbox", [0, 0, 0, 0])
                clean_text = text.strip().lower()

                # Filter out standard synthetic banners / page numbers if they lie at the extreme top/bottom margins
                if not allow_header_footer:
                    if span_bbox[1] < 28 and ("synthetic test document" in clean_text or clean_text.startswith("page ")):
                        continue
                    if span_bbox[3] > page_h - 22 and (clean_text.startswith("page ") or clean_text.isdigit()):
                        continue

                span_words = text.split()
                if not span_words:
                    continue

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
                        "clean": normalize_token(w),
                        "bbox": w_box,
                        "y_mid": (span_bbox[1] + span_bbox[3]) / 2.0,
                        "x0": w_box[0],
                        "x1": w_box[2],
                        "y0": w_box[1],
                        "y1": w_box[3]
                    })
                    curr_x += (len(w) + 1) * char_w

    # Sort in natural visual reading order: row-major by y_mid (grouped within 3.5 pt), then x0
    words_list.sort(key=lambda item: (round(item["y_mid"] / 3.5) * 3.5, item["x0"]))
    return words_list

def find_quote_boxes_on_page(
    page: fitz.Page,
    quote: str,
    preferred_bbox: Optional[List[float]] = None,
    preferred_y: Optional[float] = None
) -> List[List[float]]:
    """
    Finds multi-line bounding boxes for a quote on a single PDF page.
    Matches the quote as ONE contiguous ordered word sequence.
    If the quote appears multiple times on the page, picks the single occurrence
    nearest to preferred_bbox/preferred_y or the first occurrence — never highlights all occurrences.
    Builds rectangles per line from matched words only; merges adjacent words on the same line.
    Returns a list of rectangular boxes [[x0, y0, x1, y1], ...].
    """
    if not quote or not quote.strip():
        return []

    clean_quote = quote.strip()
    is_header_search = "synthetic test document" in clean_quote.lower() or clean_quote.lower().startswith("page ")

    clean_words = extract_clean_horizontal_words(page, allow_header_footer=is_header_search)
    if not clean_words:
        return []

    # Clean target quote tokens
    q_tokens = [normalize_token(w) for w in clean_quote.split() if w.strip()]
    q_tokens = [t for t in q_tokens if t]
    if not q_tokens:
        return []

    len_q = len(q_tokens)
    c_tokens = [w["clean"] for w in clean_words]

    # 1. Find ALL exact contiguous sequence occurrences
    occurrences: List[List[Dict[str, Any]]] = []
    for i in range(len(c_tokens) - len_q + 1):
        if c_tokens[i : i + len_q] == q_tokens:
            occurrences.append(clean_words[i : i + len_q])

    # 2. If exact contiguous matches found, choose the best single occurrence
    best_slice: Optional[List[Dict[str, Any]]] = None
    if occurrences:
        if len(occurrences) == 1:
            best_slice = occurrences[0]
        else:
            # Multiple occurrences: choose nearest to preferred_bbox or preferred_y
            if preferred_bbox and len(preferred_bbox) == 4:
                pref_cx = (preferred_bbox[0] + preferred_bbox[2]) / 2.0
                pref_cy = (preferred_bbox[1] + preferred_bbox[3]) / 2.0
                best_dist = float("inf")
                for occ in occurrences:
                    occ_cx = sum((w["x0"] + w["x1"]) / 2.0 for w in occ) / len(occ)
                    occ_cy = sum(w["y_mid"] for w in occ) / len(occ)
                    dist = ((occ_cx - pref_cx) ** 2 + (occ_cy - pref_cy) ** 2) ** 0.5
                    if dist < best_dist:
                        best_dist = dist
                        best_slice = occ
            elif preferred_y is not None:
                best_dist = float("inf")
                for occ in occurrences:
                    occ_cy = sum(w["y_mid"] for w in occ) / len(occ)
                    dist = abs(occ_cy - preferred_y)
                    if dist < best_dist:
                        best_dist = dist
                        best_slice = occ
            else:
                # Default to first occurrence
                best_slice = occurrences[0]

    # 3. If exact sequence failed, attempt constrained sliding window for OCR tolerance
    if not best_slice and len_q >= 4:
        best_score = 0.0
        best_occ: Optional[List[Dict[str, Any]]] = None
        max_mismatches = max(1, len_q // 10)  # at most 1 mismatch per 10 tokens

        for win_size in [len_q, len_q + 1, len_q + 2, max(4, len_q - 1)]:
            if win_size > len(c_tokens):
                continue
            for i in range(len(c_tokens) - win_size + 1):
                window = c_tokens[i : i + win_size]
                matches = sum(1 for qt in q_tokens if qt in window)
                score = matches / len_q
                mismatches = len_q - matches
                if score > best_score and mismatches <= max_mismatches:
                    best_score = score
                    best_occ = clean_words[i : i + win_size]

        if best_score >= 0.90 and best_occ:
            best_slice = best_occ
            # Trim leading and trailing ungrounded words that do not match the start/end of the quote
            while best_slice and best_slice[0]["clean"] not in q_tokens[:2]:
                best_slice = best_slice[1:]
            while best_slice and best_slice[-1]["clean"] not in q_tokens[-2:]:
                best_slice = best_slice[:-1]

    if not best_slice:
        return []

    # 4. Group matched words by line (similar y_mid within 4.5 points)
    lines: List[List[Dict[str, Any]]] = []
    for item in best_slice:
        if not lines or abs(item["y_mid"] - lines[-1][0]["y_mid"]) > 4.5:
            lines.append([item])
        else:
            lines[-1].append(item)

    # 5. Build rectangles per line: merge adjacent words on the same line
    matched_boxes: List[List[float]] = []
    for line in lines:
        line_sorted = sorted(line, key=lambda w: w["x0"])
        # Partition words if there is a massive gap (e.g. > 40 pt across unconnected table columns)
        segments: List[List[Dict[str, Any]]] = []
        for w in line_sorted:
            if not segments:
                segments.append([w])
            else:
                prev_w = segments[-1][-1]
                gap = w["x0"] - prev_w["x1"]
                if gap > 45.0:
                    segments.append([w])
                else:
                    segments[-1].append(w)

        for seg in segments:
            # Bounding box with small 1.0 pt padding, clamped to page dimensions
            x0 = max(0.0, round(min(w["x0"] for w in seg) - 1.0, 2))
            y0 = max(0.0, round(min(w["y0"] for w in seg) - 0.5, 2))
            x1 = min(round(page.rect.width, 2), round(max(w["x1"] for w in seg) + 1.0, 2))
            y1 = min(round(page.rect.height, 2), round(max(w["y1"] for w in seg) + 0.5, 2))
            matched_boxes.append([x0, y0, x1, y1])

    return matched_boxes

def locate_quote_with_cross_page(
    doc: fitz.Document,
    target_page: int,
    quote: str,
    preferred_bbox: Optional[List[float]] = None
) -> Dict[str, Any]:
    """
    Locates quote on target_page, supporting multi-line highlights and cross-page continuation.
    If quote starts on target_page and continues to target_page + 1, returns continuation info.
    If quote cannot be found on target_page, searches adjacent pages or reports not found.
    Never returns multiple duplicate occurrences; highlights only the cited passage.
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
    boxes = find_quote_boxes_on_page(page, clean_quote, preferred_bbox=preferred_bbox)

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
    if len(q_words) >= 4:
        # Check if prefix is on target_page and suffix is on target_page + 1
        if target_page < num_pages:
            next_page = doc[target_page]
            for split_idx in range(len(q_words) - 2, 1, -1):
                prefix = " ".join(q_words[:split_idx])
                suffix = " ".join(q_words[split_idx:])

                p_boxes = find_quote_boxes_on_page(page, prefix, preferred_bbox=preferred_bbox)
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
            for split_idx in range(2, len(q_words) - 1):
                prefix = " ".join(q_words[:split_idx])
                suffix = " ".join(q_words[split_idx:])

                s_boxes = find_quote_boxes_on_page(page, suffix, preferred_bbox=preferred_bbox)
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

    # If not on target_page, check if the quote appears on any other page
    for other_p in range(1, num_pages + 1):
        if other_p == target_page:
            continue
        alt_page = doc[other_p - 1]
        alt_boxes = find_quote_boxes_on_page(alt_page, clean_quote, preferred_bbox=preferred_bbox)
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
        "warning": "Exact location could not be determined; exact bounding box coordinates cannot be found for this quote. Displaying quote text in sidebar."
    }
