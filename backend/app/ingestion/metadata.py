import re
from datetime import datetime, date
from typing import Dict, Any, List, Optional
from dateutil import parser as date_parser

AMENDMENT_PATTERNS = [
    r"in\s+(?:partial\s+)?modification\s+of\s+([^\.,;\n]+)",
    r"shall\s+be\s+substituted\s+(?:by|with)\s+([^\.,;\n]+)",
    r"stands\s+deleted",
    r"w\.e\.f\.?\s*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4}|[0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,?\s+[0-9]{4})",
    r"with\s+effect\s+from\s+([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4}|[0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,?\s+[0-9]{4})",
    r"supersedes\s+([^\.,;\n]+)",
    r"amends\s+clause\s+([0-9A-Za-z\.\-]+)",
    r"in\s+supersession\s+of\s+([^\.,;\n]+)"
]

def extract_dates(text: str) -> List[date]:
    """Extract standard and Indian formatted dates (DD/MM/YYYY, DD-Month-YYYY)."""
    found_dates = []
    # Match patterns like 01/04/2025, 15-Jan-2026, 1st April 2025
    patterns = [
        r"\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}\b",
        r"\b\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*,?\s+\d{4}\b"
    ]
    for p in patterns:
        for match in re.finditer(p, text, re.IGNORECASE):
            raw = match.group(0).strip()
            # Clean ordinal suffixes
            raw_clean = re.sub(r"(\d+)(st|nd|rd|th)", r"\1", raw, flags=re.IGNORECASE)
            try:
                parsed = date_parser.parse(raw_clean, dayfirst=True)
                found_dates.append(parsed.date())
            except Exception:
                continue
    return found_dates

def detect_amendment_signals(text: str) -> List[Dict[str, Any]]:
    """Detect explicit amendment clauses, superseded policies, and effective dates."""
    signals = []
    for pattern in AMENDMENT_PATTERNS:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            signals.append({
                "pattern": pattern,
                "matched_text": match.group(0),
                "target_reference": match.group(1).strip() if match.groups() else None
            })
    return signals

def classify_document_type(filename: str, first_page_text: str) -> str:
    """Classify banking document into one of the 14 standard Indian lending types."""
    combined = f"{filename} {first_page_text}".lower()

    if "master direction" in combined:
        return "RBI_MASTER_DIRECTION"
    if "circular" in combined or "rbi/20" in combined or "notification" in combined:
        return "RBI_CIRCULAR"
    if "key facts statement" in combined or "kfs" in combined:
        return "KEY_FACTS_STATEMENT"
    if "sanction letter" in combined:
        return "SANCTION_LETTER"
    if "personal loan agreement" in combined:
        return "PERSONAL_LOAN_AGREEMENT"
    if "home loan agreement" in combined or "housing loan" in combined:
        return "HOME_LOAN_AGREEMENT"
    if "penal charge" in combined or "penal interest" in combined:
        return "PENAL_CHARGES_POLICY"
    if "foreclosure" in combined or "pre-payment" in combined:
        return "FORECLOSURE_POLICY"
    if "schedule of charges" in combined or "fee schedule" in combined:
        return "SCHEDULE_OF_CHARGES"
    if "amortisation" in combined or "repayment schedule" in combined:
        return "REPAYMENT_SCHEDULE"
    if "restructuring" in combined:
        return "RESTRUCTURING_LETTER"
    if "revision notice" in combined:
        return "INTEREST_REVISION_NOTICE"
    if "account statement" in combined or "statement of account" in combined:
        return "ACCOUNT_STATEMENT"
    if "loan policy" in combined or "credit policy" in combined or "lending policy" in combined:
        return "BANK_LOAN_POLICY"

    return "OTHER"

def extract_doc_status(filename: str, text: str) -> str:
    """Determine document regulatory status (DRAFT, WITHDRAWN, EXTENSION, PARTIAL_AMENDMENT, IN_FORCE)."""
    fn_lower = filename.lower()
    t_lower = text.lower()

    if "draft" in fn_lower or "draft" in t_lower and ("for public comments" in t_lower or "draft directions" in t_lower or "not binding" in t_lower or "confidential" in t_lower):
        return "DRAFT"
    if "withdrawal" in fn_lower or "withdrawal of circular" in t_lower or "hereby withdrawn" in t_lower:
        return "WITHDRAWN"
    if "extension" in fn_lower or "extension of timeline" in t_lower:
        return "EXTENSION"
    if "partialamendment" in fn_lower or "partial amendment" in t_lower or "amendment to applicability" in t_lower:
        return "PARTIAL_AMENDMENT"
    return "IN_FORCE"

def extract_metadata_from_text(filename: str, pages_text: List[str]) -> Dict[str, Any]:
    """Extract title, issuer, issue date, effective dates, domain, and doc_type."""
    first_page = pages_text[0] if pages_text else ""
    full_text_sample = "\n".join(pages_text[:3])
    all_text = "\n".join(pages_text)

    doc_type = classify_document_type(filename, first_page)
    doc_status = extract_doc_status(filename, all_text)

    # Detect Issuer (e.g. Reserve Bank of India, Bharat National Bank, etc.)
    issuer = "Bharat National Bank"
    if "reserve bank of india" in full_text_sample.lower() or "rbi" in full_text_sample.lower():
        issuer = "Reserve Bank of India"
    elif "abc bank" in full_text_sample.lower():
        issuer = "ABC Bank Ltd."
    elif "xyz finance" in full_text_sample.lower():
        issuer = "XYZ Finance Ltd."
    elif "state bank" in full_text_sample.lower():
        issuer = "State Bank of India"
    elif "hdfc" in full_text_sample.lower():
        issuer = "HDFC Bank"
    elif "icici" in full_text_sample.lower():
        issuer = "ICICI Bank"

    # Extract dates
    dates = extract_dates(full_text_sample)
    pub_date = dates[0] if dates else date.today()

    # Look for effective from date (e.g. come into effect from, effective from, extended to, w.e.f.)
    effective_from = pub_date
    eff_patterns = [
        r"(?:come\s+into\s+effect\s+from|effective\s+(?:from|date\s+is)|w\.e\.f\.?|with\s+effect\s+from|takes?\s+effect\s+from?|extended\s+(?:from\s+[^\n]+?\s+)?to)\s*([0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,?\s+[0-9]{4}|\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})",
        r"w\.e\.f\.?\s*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4}|[0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,?\s+[0-9]{4})"
    ]
    for ep in eff_patterns:
        eff_match = re.search(ep, all_text, re.IGNORECASE)
        if eff_match:
            try:
                raw_match = eff_match.group(1).strip()
                cleaned = re.sub(r"(\d+)(st|nd|rd|th)", r"\1", raw_match, flags=re.IGNORECASE)
                parsed_d = date_parser.parse(cleaned, dayfirst=True).date()
                effective_from = parsed_d
                break
            except Exception:
                pass

    # Extract Title (often the first significant uppercase line or heading)
    lines = [line.strip() for line in first_page.split("\n") if len(line.strip()) > 5]
    title = lines[0] if lines else filename

    return {
        "title": title,
        "issuer": issuer,
        "document_type": doc_type,
        "domain": "RETAIL_LENDING",
        "publication_date": pub_date,
        "effective_from": effective_from,
        "effective_to": None,
        "doc_status": doc_status,
        "version": "1.0"
    }
