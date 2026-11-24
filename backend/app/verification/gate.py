import re
import logging
from typing import List, Dict, Any, Tuple, Set, Optional
from app.intelligence.temporal_parser import parse_date_safely

logger = logging.getLogger("veritas.verification")

_nli_model = None
_nli_model_name = "cross-encoder/nli-deberta-v3-small"
_nli_load_attempted = False

def get_nli_model():
    """Lazy loader for DeBERTa-v3 cross-encoder NLI model."""
    global _nli_model, _nli_load_attempted
    if _nli_model is not None:
        return _nli_model
    if _nli_load_attempted:
        return None

    _nli_load_attempted = True
    try:
        from sentence_transformers import CrossEncoder
        # Try local cache first to avoid network delay
        try:
            _nli_model = CrossEncoder(_nli_model_name, local_files_only=True)
            logger.info(f"Loaded cached NLI model '{_nli_model_name}' successfully.")
            return _nli_model
        except Exception:
            _nli_model = CrossEncoder(_nli_model_name)
            logger.info(f"Downloaded and loaded NLI model '{_nli_model_name}'.")
            return _nli_model
    except Exception as e:
        logger.warning(f"Could not load real NLI model '{_nli_model_name}': {e}. Falling back to lexical heuristic.")
        _nli_model = None
        return None

def normalize_ws(text: str) -> str:
    """Normalize repeated whitespace, tabs, and newlines into single spaces."""
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()

def check_verbatim_quote(quote: str, page_text: str) -> bool:
    """Check that quote is an exact verbatim substring of the page text (whitespace-normalized)."""
    norm_quote = normalize_ws(quote).lower()
    norm_page = normalize_ws(page_text).lower()
    if not norm_quote:
        return False
    return norm_quote in norm_page

def extract_entities_for_consistency(text: str) -> Dict[str, Set[str]]:
    """
    Extract numbers, percentages, and dates from text for strict deterministic comparison.
    Dates and document identifiers (e.g. SYN_01, EV-001) are masked out before extracting quantitative numbers.
    """
    norm = normalize_ws(text)

    # 1. Extract Dates (ISO, Indian format, Month names)
    date_patterns = [
        r"\b\d{4}-\d{2}-\d{2}\b",
        r"\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b",
        r"\b\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*,?\s+\d{4}\b"
    ]
    dates = set()
    masked_text = norm
    for dp in date_patterns:
        for match in re.finditer(dp, norm, re.IGNORECASE):
            raw_dt = match.group(0)
            dates.add(raw_dt)
            parsed = parse_date_safely(raw_dt)
            if parsed:
                dates.add(parsed.strftime("%Y-%m-%d"))
            masked_text = masked_text.replace(raw_dt, " [DATE] ")

    # Mask document identifiers like SYN_01, EV-001, Q1 so identifier digits are not treated as numbers
    masked_text = re.sub(r"\b(?:SYN|EV|DOC|Q|REF)[-_]\d+\b", " [DOC_ID] ", masked_text, flags=re.IGNORECASE)
    # Mask paragraph/clause references like para 4.1 or clause 2.2
    masked_text = re.sub(r"\b(?:para|clause|paragraph|section)\s+\d+(?:\.\d+)?\b", " [CLAUSE_REF] ", masked_text, flags=re.IGNORECASE)

    # 2. Extract Percentages
    percentages = set(re.findall(r"\b\d+(?:\.\d+)?\s*(?:%|percent)\b", masked_text, re.IGNORECASE))
    cleaned_percentages = {re.sub(r"\s+", "", p).lower().replace("percent", "%") for p in percentages}
    for p in percentages:
        masked_text = masked_text.replace(p, " [PCT] ")

    # 3. Extract Quantitative Numbers
    raw_numbers = set(re.findall(r"\b\d+(?:,\d{3})*(?:\.\d+)?\b", masked_text))
    cleaned_numbers = {n.replace(",", "") for n in raw_numbers}

    return {
        "percentages": cleaned_percentages,
        "numbers": cleaned_numbers,
        "dates": dates
    }

def verify_numerical_and_date_consistency(
    claim_text: str,
    quote_text: str,
    query_context: Optional[str] = None,
    page_text: Optional[str] = None
) -> Tuple[bool, Optional[str]]:
    """
    Ensure every number, percentage, and date appearing in the claim is grounded
    in either the cited quote, the cited page, or the user's query context (e.g. as-of date, loan amount).
    """
    claim_entities = extract_entities_for_consistency(claim_text)
    quote_entities = extract_entities_for_consistency(quote_text)
    page_entities = extract_entities_for_consistency(page_text or "")
    context_entities = extract_entities_for_consistency(query_context or "")

    # Allowed entities = quote entities + page entities + context entities (query + as_of_date)
    allowed_percentages = quote_entities["percentages"] | page_entities["percentages"] | context_entities["percentages"]
    allowed_numbers = quote_entities["numbers"] | page_entities["numbers"] | context_entities["numbers"]
    allowed_dates = quote_entities["dates"] | page_entities["dates"] | context_entities["dates"]

    full_allowed_text = f"{quote_text} {page_text or ''} {query_context or ''}".lower()

    # Check percentages
    for pct in claim_entities["percentages"]:
        if pct not in allowed_percentages:
            raw_num = pct.replace("%", "")
            if raw_num not in allowed_numbers and raw_num not in full_allowed_text:
                return False, f"Percentage '{pct}' in claim not substantiated in cited quote or context."

    # Check dates
    for dt in claim_entities["dates"]:
        parsed_dt = parse_date_safely(dt)
        parsed_iso = parsed_dt.strftime("%Y-%m-%d") if parsed_dt else None
        if dt not in allowed_dates and dt.lower() not in full_allowed_text:
            if parsed_iso and (parsed_iso in allowed_dates or parsed_iso in full_allowed_text):
                continue
            return False, f"Date '{dt}' in claim not substantiated in cited quote or context."

    # Check quantitative numbers
    for num in claim_entities["numbers"]:
        if len(num) >= 2 or "." in num:
            if num not in allowed_numbers and num not in full_allowed_text:
                return False, f"Numerical value '{num}' in claim not found in cited quote or context."

    return True, None

def evaluate_nli_entailment(quote: str, claim: str) -> Dict[str, Any]:
    """
    Evaluate NLI entailment between cited quote (premise) and claim (hypothesis).
    Uses a real DeBERTa-v3 cross-encoder model when available, with graceful lexical fallback.
    Returns dictionary with label, score, verifier name, and probability distribution.
    """
    model = get_nli_model()
    if model is not None:
        try:
            import numpy as np
            # predict returns logits for [contradiction, entailment, neutral]
            logits = model.predict([(quote, claim)])[0]
            exp_l = np.exp(logits - np.max(logits))
            probs = exp_l / np.sum(exp_l)
            # id2label: {0: 'contradiction', 1: 'entailment', 2: 'neutral'}
            contra_prob = float(probs[0])
            entail_prob = float(probs[1])
            neutral_prob = float(probs[2])

            if entail_prob >= 0.45 or (entail_prob > contra_prob and entail_prob > neutral_prob):
                label = "entailed"
                conf = entail_prob
            elif contra_prob >= 0.50 or contra_prob > entail_prob:
                label = "contradiction"
                conf = contra_prob
            else:
                label = "neutral"
                conf = neutral_prob

            return {
                "label": label,
                "score": round(conf, 4),
                "verifier": f"deberta-v3-nli ({_nli_model_name})",
                "probabilities": {
                    "entailment": round(entail_prob, 4),
                    "neutral": round(neutral_prob, 4),
                    "contradiction": round(contra_prob, 4)
                }
            }
        except Exception as e:
            logger.warning(f"DeBERTa inference failed: {e}. Using lexical fallback.")

    # Fallback deterministic lexical check
    norm_quote = normalize_ws(quote).lower()
    norm_claim = normalize_ws(claim).lower()

    claim_words = [w for w in re.findall(r"\w+", norm_claim) if len(w) > 3]
    if not claim_words:
        return {
            "label": "entailed",
            "score": 0.95,
            "verifier": "lexical-heuristic-fallback",
            "probabilities": {"entailment": 0.95, "neutral": 0.05, "contradiction": 0.0}
        }

    matched_words = [w for w in claim_words if w in norm_quote]
    overlap_ratio = len(matched_words) / len(claim_words)

    if overlap_ratio >= 0.70:
        label = "entailed"
        score = min(0.99, 0.85 + (overlap_ratio * 0.15))
    elif overlap_ratio >= 0.40:
        label = "neutral"
        score = 0.50
    else:
        label = "contradiction"
        score = 0.20

    return {
        "label": label,
        "score": round(score, 4),
        "verifier": "lexical-heuristic-fallback",
        "probabilities": {
            "entailment": round(score if label == "entailed" else 0.1, 4),
            "neutral": 0.5 if label == "neutral" else 0.2,
            "contradiction": round(score if label == "contradiction" else 0.1, 4)
        }
    }

def run_verification_gate(
    claims: List[Dict[str, Any]],
    page_texts: Dict[Any, str],
    query_context: Optional[str] = None
) -> Dict[str, Any]:
    """
    Execute strict 3-point verification gate on every claim:
    a) Verbatim quote substring check
    b) Deterministic numbers, percentages, and dates match
    c) NLI entailment check (DeBERTa-v3 or labelled fallback)
    """
    verified_claims = []
    blocked_claims = []
    total_claims = len(claims)

    for claim in claims:
        claim_text = claim.get("text", "")
        quote_ids = claim.get("quote_ids", [])
        citations = claim.get("citations", [])

        if not citations:
            blocked_claims.append({
                "original_claim": claim_text,
                "verdict": "BLOCKED",
                "reason": "MISSING_EVIDENCE",
                "searched_for": claim_text,
                "missing": "Supporting documentary quotation, page number, and clause citation.",
                "verifier": "deterministic-rules",
                "message": f"BLOCKED: Claim '{claim_text}' has no supporting documentary evidence attached."
            })
            continue

        claim_verified = False
        failure_reasons = []
        active_verifier = "deterministic-rules"
        nli_details = {}

        for cit in citations:
            quote = cit.get("quote", "")
            page_num = cit.get("page_number", 1)
            doc_id = cit.get("document_id")
            doc_name = cit.get("document_name")

            # Look up specific page text by (doc, page) or fallback
            page_text = (
                page_texts.get((doc_id, page_num)) or
                page_texts.get((doc_name, page_num)) or
                page_texts.get(page_num, "")
            )

            # If not found in that exact slot, search across all pages in page_texts
            if not page_text or not check_verbatim_quote(quote, page_text):
                for p_key, p_txt in page_texts.items():
                    if check_verbatim_quote(quote, p_txt):
                        page_text = p_txt
                        break

            # 1. Verbatim check
            if not check_verbatim_quote(quote, page_text):
                failure_reasons.append(f"Quote '{quote[:40]}...' is not a verbatim substring of Page {page_num}.")
                continue

            # Product / Facility Scope check (prevent cross-product hallucination)
            if query_context:
                q_lower = query_context.lower()
                specific_products = ["gold loan", "tractor loan", "vehicle loan", "education loan", "credit card", "space travel", "crypto"]
                product_mismatch = False
                for prod in specific_products:
                    if prod in q_lower:
                        prod_key = prod.split()[0]
                        if prod_key not in quote.lower() and prod_key not in claim_text.lower():
                            failure_reasons.append(f"Query specifically asks about '{prod}', but evidence does not contain '{prod_key}'.")
                            product_mismatch = True
                            break
                if product_mismatch:
                    continue

            # 2. Number, percentage, and date consistency
            num_ok, num_err = verify_numerical_and_date_consistency(claim_text, quote, query_context, page_text)
            if not num_ok:
                failure_reasons.append(num_err)
                continue

            # 3. NLI Entailment
            premise_with_doc = f"Document: {doc_name}. {quote}" if doc_name else quote
            nli_eval = evaluate_nli_entailment(premise_with_doc, claim_text)
            if nli_eval["label"] != "entailed":
                raw_eval = evaluate_nli_entailment(quote, claim_text)
                if raw_eval["label"] == "entailed":
                    nli_eval = raw_eval
                else:
                    failure_reasons.append(
                        f"NLI label is '{nli_eval['label']}' (score: {nli_eval['score']:.2f}) by {nli_eval['verifier']}; claim not strictly entailed by quote."
                    )
                    continue

            active_verifier = nli_eval["verifier"]
            nli_details = nli_eval

            claim_verified = True
            break

        if claim_verified:
            verified_claims.append({
                "text": claim_text,
                "verdict": "VERIFIED",
                "status": "VERIFIED",
                "verifier": active_verifier,
                "nli_score": nli_details.get("score", 1.0),
                "nli_label": nli_details.get("label", "entailed"),
                "citations": citations
            })
        else:
            missing_desc = "; ".join(failure_reasons) if failure_reasons else "Verifiable documentary proof in cited pages."
            blocked_claims.append({
                "original_claim": claim_text,
                "verdict": "BLOCKED",
                "reason": "FAILED_VERIFICATION",
                "searched_for": claim_text,
                "missing": missing_desc,
                "verifier": active_verifier,
                "failure_reasons": failure_reasons,
                "message": f"BLOCKED: Lacks verified evidence. " + missing_desc
            })

    num_verified = len(verified_claims)
    faithfulness_score = round((num_verified / total_claims * 100), 2) if total_claims > 0 else 0.0

    return {
        "total_claims": total_claims,
        "verified_count": num_verified,
        "blocked_count": len(blocked_claims),
        "faithfulness_score": faithfulness_score,
        "verified_claims": verified_claims,
        "blocked_claims": blocked_claims,
        "status": "VERIFIED" if (total_claims > 0 and len(blocked_claims) == 0) else (
            "PARTIALLY_VERIFIED" if num_verified > 0 else "INSUFFICIENT_EVIDENCE"
        )
    }
