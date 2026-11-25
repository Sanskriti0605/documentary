import re
from datetime import datetime, date
from typing import Optional, Any
from dateutil import parser as date_parser

def parse_date_safely(val: Any) -> Optional[date]:
    """Parse date from string or date object, ignoring annotations like (hypothetical)."""
    if not val:
        return None
    if isinstance(val, date):
        return val
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, str):
        cleaned = re.sub(r"\(.*?\)", "", val).strip()
        cleaned = re.sub(r"(\d+)(st|nd|rd|th)", r"\1", cleaned, flags=re.IGNORECASE)
        # Try ISO first (YYYY-MM-DD)
        iso_match = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", cleaned)
        if iso_match:
            try:
                return datetime.strptime(iso_match.group(1), "%Y-%m-%d").date()
            except Exception:
                pass
        try:
            return date_parser.parse(cleaned, dayfirst=True).date()
        except Exception:
            pass
    return None

def extract_as_of_date(query: str, explicit_as_of: Optional[Any] = None) -> date:
    """
    Extract as-of date:
    1. Explicit request field wins if provided.
    2. Otherwise parse from question text (e.g. 'as of 1 March 2024', 'on 1 Dec 2024', 'effective 1 Oct 2024').
    3. If 'currently' or none found, return date.today().
    """
    # 1. Explicit request field wins
    if explicit_as_of is not None:
        parsed = parse_date_safely(explicit_as_of)
        if parsed:
            return parsed

    if not query:
        return date.today()

    from app.intelligence.multilingual import normalize_hindi_temporal_and_numbers
    query = normalize_hindi_temporal_and_numbers(query)

    q_lower = query.lower()

    # If explicit mention of 'currently', 'today', 'now', return today
    if re.search(r"\b(currently|today|now)\b", q_lower) and not re.search(r"\b(as of|on|effective|w\.e\.f)\b", q_lower):
        return date.today()

    # Search for temporal prepositions in question
    patterns = [
        r"(?:as\s+of|on|effective|w\.e\.f\.?|from)\s+([0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,?\s+[0-9]{4})",
        r"(?:as\s+of|on|effective|w\.e\.f\.?|from)\s+(\d{4}-\d{2}-\d{2})",
        r"(?:as\s+of|on|effective|w\.e\.f\.?|from)\s+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})",
        # General date mentioned anywhere in question if query starts with or contains date
        r"\b([0-9]{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*,?\s+\d{4})\b",
        r"\b(\d{4}-\d{2}-\d{2})\b"
    ]

    for p in patterns:
        m = re.search(p, query, re.IGNORECASE)
        if m:
            matched_date_str = m.group(1).strip()
            parsed = parse_date_safely(matched_date_str)
            if parsed:
                return parsed

    return date.today()
