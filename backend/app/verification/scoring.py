import re
from typing import Dict, Any, List, Optional, Tuple

def evaluate_answer_coverage(
    query: str,
    answer: str,
    has_version_chain: bool = False,
    as_of_date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Deterministic check of whether the answer contains the necessary elements
    required by the question type without using the LLM to grade itself.
    """
    q_lower = query.lower()
    a_lower = answer.lower()

    required_elements: List[str] = []
    present_elements: List[str] = []

    # 1. Yes / No / Legality / Prohibition questions
    is_boolean_query = any(k in q_lower for k in [
        "is it", "are ", "can a ", "is a ", "prohibited", "allowed", "permitted",
        "banned", "valid", "legal", "shall", "does ", "whether"
    ])
    if is_boolean_query:
        required_elements.append("verdict")
        verdict_terms = [
            "yes", "no", "prohibited", "permitted", "allowed", "not allowed",
            "shall not", "cannot", "subject to", "barred", "applicable", "exempted"
        ]
        if any(vt in a_lower for vt in verdict_terms):
            present_elements.append("verdict")

    # 2. As-of / Temporal / Amendment questions
    is_temporal_query = any(k in q_lower for k in ["as of", "as on", "effective", "today", "currently", "now", "amended", "version"]) or as_of_date is not None
    if is_temporal_query:
        required_elements.append("effective_date")
        date_pattern = r"\b(\d{1,2}\s+[a-z]{3,9}\s+\d{4}|\d{4}-\d{2}-\d{2}|[a-z]{3,9}\s+\d{1,2},\s*\d{4}|\d{4})\b"
        if re.search(date_pattern, a_lower) or (as_of_date and as_of_date in a_lower):
            present_elements.append("effective_date")

        if has_version_chain:
            required_elements.append("version_chain_reference")
            version_terms = ["amend", "supersed", "circular", "direction", "draft", "final", "extended", "version", "withdrawn"]
            if any(vt in a_lower for vt in version_terms):
                present_elements.append("version_chain_reference")

    # 3. Numeric / Fee / Penalty / Rate / Amount questions
    is_asking_quantity = any(k in q_lower for k in [
        "how much", "what rate", "rate of", "interest rate", "what fee", "what is the fee",
        "fee amount", "penalty rate", "percentage", "amount", "cap", "limit", "quantum", "calculate", "cost"
    ]) or (any(k in q_lower for k in ["fee", "charge", "penalty", "rate"]) and not is_boolean_query)
    if is_asking_quantity:
        required_elements.append("numeric_value")
        required_elements.append("unit_or_basis")
        if re.search(r"\b\d+(?:\.\d+)?%?\b", a_lower) or any(w in a_lower for w in ["prohibited", "nil", "zero", "none", "no charge"]):
            present_elements.append("numeric_value")
        unit_terms = ["%", "per cent", "percent", "rs", "inr", "rupees", "p.a.", "per annum", "basis points", "bps", "days", "months", "prohibited", "nil"]
        if any(ut in a_lower for ut in unit_terms):
            present_elements.append("unit_or_basis")

    # 4. Scope / Applicability questions
    is_scope_query = any(k in q_lower for k in ["apply to", "who is", "which banks", "entities", "coverage", "scope"])
    if is_scope_query:
        required_elements.append("scope_statement")
        scope_terms = ["commercial bank", "bank", "nbfc", "retail", "floating", "fixed", "borrower", "regulated", "applies to", "covered"]
        if any(st in a_lower for st in scope_terms):
            present_elements.append("scope_statement")

    # Default fallback if no specific rule matched
    if not required_elements:
        required_elements.append("substantive_response")
        if len(answer.strip()) > 20:
            present_elements.append("substantive_response")

    missing_elements = [el for el in required_elements if el not in present_elements]
    score = round(len(present_elements) / len(required_elements), 2) if required_elements else 1.0

    return {
        "score": score,
        "elements_present": present_elements,
        "elements_required": required_elements,
        "missing_elements": missing_elements
    }


def evaluate_retrieval_relevance(
    query: str,
    retrieved_quotes: List[Dict[str, Any]],
    verified_claims: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Retrieval-based signal showing how well the cited clauses match the query.
    Detects subject mismatches and low retrieval scores.
    """
    if not retrieved_quotes:
        return {
            "score": 0.0,
            "is_low_relevance": True,
            "warning": "No relevant documentary clauses retrieved from the corpus.",
            "top_clause_score": 0.0,
            "subject_match": False
        }

    q_lower = query.lower()

    # Domain subjects mapping (ordered by specificity - specific products first)
    known_subjects = {
        "gold_loan": ["gold loan", "jewel loan", "ornament"],
        "digital_lending": ["digital lending", "cooling off", "look up"],
        "leave": ["leave", "earned leave", "casual leave", "maternity"],
        "foreclosure": ["foreclosure", "prepayment", "pre-payment"],
        "penal": ["penal", "penalty", "default interest", "late payment"],
        "processing_fee": ["processing fee", "processing charge", "application fee"],
        "deposit": ["deposit", "savings account", "current account", "cheque"],
        "grievance": ["grievance", "ombudsman", "complaint", "escalation"],
        "interest_rate": ["interest rate", "roi", "floating rate", "fixed rate"]
    }

    query_subject = None
    for subj, keywords in known_subjects.items():
        if any(kw in q_lower for kw in keywords):
            query_subject = subj
            break

    # Check cited clauses' subjects and texts
    cited_texts = []
    for c in verified_claims:
        for cit in c.get("citations", []):
            q_text = cit.get("quote", "")
            doc_name = cit.get("document_name", "")
            cited_texts.append(f"{doc_name} {q_text}".lower())

    if not cited_texts:
        for q in retrieved_quotes[:2]:
            cited_texts.append(f"{q.get('document_name', '')} {q.get('clause_text', '')}".lower())

    joined_evidence = " ".join(cited_texts)

    # Subject alignment check
    subject_mismatch = False
    if query_subject and query_subject in known_subjects:
        expected_keywords = known_subjects[query_subject]
        if not any(kw in joined_evidence for kw in expected_keywords):
            subject_mismatch = True

    # Check top retrieval score (BM25 or Dense)
    top_quote = retrieved_quotes[0]
    raw_score = top_quote.get("score") or top_quote.get("bm25_score") or top_quote.get("similarity") or 0.0
    # Normalize score into a 0.0 - 1.0 interval
    if raw_score > 1.0:
        norm_score = min(1.0, round(raw_score / 15.0, 2))  # BM25 scores typically range 0-15
    else:
        norm_score = round(float(raw_score), 2)

    if subject_mismatch:
        warning = f"Cited clauses do not address the query topic '{query_subject.replace('_', ' ')}'."
        norm_score = min(norm_score, 0.35)
        is_low = True
    elif norm_score < 0.40:
        warning = "Top retrieved evidence has low keyword/semantic similarity to the question."
        is_low = True
    else:
        warning = None
        is_low = False

    return {
        "score": norm_score,
        "is_low_relevance": is_low,
        "warning": warning,
        "top_clause_score": norm_score,
        "subject_match": not subject_mismatch
    }


def compute_confidence_band(
    is_abstained: bool,
    is_extractive: bool,
    generation_pass_rate: Optional[float],
    evidence_strength_mean: Optional[float],
    coverage_score: float,
    relevance_score: float,
    relevance_warning: Optional[str]
) -> Tuple[str, str]:
    """
    Derives the answer_confidence band (High / Medium / Low / Insufficient)
    from documented rules in the scoring engine.
    Returns (band, explanation_rule).
    """
    if is_abstained:
        return "INSUFFICIENT", "Insufficient documentary evidence found to answer the query."

    if relevance_warning and ("topic" in relevance_warning.lower() or relevance_score < 0.40):
        return "LOW", f"Low: {relevance_warning}"

    if is_extractive:
        # Extractive fallback: quotes copied directly from source
        if coverage_score >= 0.75 and relevance_score >= 0.60:
            return "MEDIUM", "Medium: Answer is direct extractive quotation with good query coverage."
        return "LOW", "Low: Extractive quote provided with limited question coverage."

    # For synthesized LLM generation:
    pass_rate = generation_pass_rate if generation_pass_rate is not None else 0.0
    ev_mean = evidence_strength_mean if evidence_strength_mean is not None else 0.50

    if pass_rate >= 1.0 and ev_mean >= 0.80 and coverage_score >= 0.75 and relevance_score >= 0.50:
        return "HIGH", "High: 100% of claims verified by NLI entailment with full question coverage."

    if pass_rate >= 0.75 and ev_mean >= 0.70 and coverage_score >= 0.60 and relevance_score >= 0.45:
        return "MEDIUM", "Medium: Majority of claims verified with moderate evidence strength."

    if pass_rate < 0.60 or ev_mean < 0.60 or coverage_score < 0.50:
        return "LOW", "Low: Partial claim verification or weak entailment strength."

    return "MEDIUM", "Medium: Synthesized answer with acceptable evidence grounding."


def build_evidence_score_object(
    gate_result: Dict[str, Any],
    query: str,
    answer: str,
    retrieved_quotes: List[Dict[str, Any]],
    is_fallback: bool,
    generation_provider: str,
    has_version_chain: bool = False,
    as_of_date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Constructs the comprehensive, honest evidence grounding & confidence score object.
    Replaces the single 100% number with a multi-signal assessment.
    """
    total_claims = gate_result.get("total_claims", 0)
    verified_claims = gate_result.get("verified_claims", [])
    blocked_claims = gate_result.get("blocked_claims", [])
    status = gate_result.get("status", "INSUFFICIENT_EVIDENCE")

    is_abstained = (total_claims == 0 and not verified_claims) or (total_claims == 0 and status == "INSUFFICIENT_EVIDENCE")

    # 1. Coverage
    if is_abstained:
        coverage = {
            "score": 0.0,
            "elements_present": [],
            "elements_required": ["evidence"],
            "missing_elements": ["Verifiable documentary evidence"]
        }
    else:
        coverage = evaluate_answer_coverage(query, answer, has_version_chain=has_version_chain, as_of_date=as_of_date)

    # 2. Relevance
    relevance = evaluate_retrieval_relevance(query, retrieved_quotes, verified_claims)

    # 3. Generation mode & Grounding
    is_extractive_mode = is_fallback or ("extractive" in generation_provider.lower())

    if is_abstained:
        claims_generated = 0
        claims_verified = 0
        claims_blocked = len(blocked_claims)
        generation_pass_rate = None
        evidence_strength = None
        grounding = "none"
        mode_label = "Abstained (No Evidence)"
    elif is_extractive_mode:
        claims_generated = total_claims
        claims_verified = len(verified_claims)
        claims_blocked = len(blocked_claims)
        # For extractive fallback, do NOT reward copying with a 100% pass rate figure
        generation_pass_rate = None
        evidence_strength = None
        grounding = "by_construction"
        mode_label = "Extractive mode: quotes are copied from the source"
    else:
        claims_generated = total_claims
        claims_verified = len(verified_claims)
        claims_blocked = len(blocked_claims)
        generation_pass_rate = round(claims_verified / claims_generated, 2) if claims_generated > 0 else 0.0
        grounding = "verified_nli"
        mode_label = f"Synthesized by {generation_provider}"

        # Evidence strength from real NLI scores
        nli_scores = [c.get("nli_score") for c in verified_claims if isinstance(c.get("nli_score"), (int, float))]
        active_verifiers = list({c.get("verifier", "unknown") for c in verified_claims})
        is_heuristic = any("heuristic" in v.lower() for v in active_verifiers)

        if is_heuristic or not nli_scores:
            evidence_strength = {
                "mean": None,
                "min": None,
                "verifier": "heuristic mode",
                "label": "heuristic mode"
            }
        else:
            evidence_strength = {
                "mean": round(sum(nli_scores) / len(nli_scores), 4),
                "min": round(min(nli_scores), 4),
                "verifier": active_verifiers[0] if active_verifiers else "deberta-v3-nli",
                "label": "cross-encoder entailment probability"
            }

    # 4. Confidence Band
    ev_mean = evidence_strength.get("mean") if evidence_strength else None
    band, reason = compute_confidence_band(
        is_abstained=is_abstained,
        is_extractive=is_extractive_mode,
        generation_pass_rate=generation_pass_rate,
        evidence_strength_mean=ev_mean,
        coverage_score=coverage["score"],
        relevance_score=relevance["score"],
        relevance_warning=relevance.get("warning")
    )

    # Backward compatibility: faithfulness_score equals generation_pass_rate * 100 if available, else None
    legacy_faithfulness = round(generation_pass_rate * 100, 2) if generation_pass_rate is not None else None

    return {
        "status": status,
        "is_abstained": is_abstained,
        "generation_mode": "extractive" if is_extractive_mode else "llm",
        "mode_label": mode_label,
        "grounding": grounding,
        "claims_generated": claims_generated,
        "claims_verified": claims_verified,
        "claims_blocked": claims_blocked,
        "generation_pass_rate": generation_pass_rate,
        "evidence_strength": evidence_strength,
        "coverage": coverage,
        "relevance": relevance,
        "confidence_band": band,
        "confidence_reason": reason,
        "faithfulness_score": legacy_faithfulness
    }
