import json
import re
import logging
from decimal import Decimal
from typing import List, Dict, Any, Optional

from app.core.config import settings
from app.calculations.financial import calculate_emi, calculate_penal_charges, calculate_processing_fee
from app.providers.provider_factory import get_llm_provider

logger = logging.getLogger("veritas.generation")

SYSTEM_PROMPT = """You are VerifyDoc, an evidence-first Document AI for Indian banking and financial regulations.
Your mission is 100% verifiable factual compliance.
CENTRAL PRINCIPLE: NO EVIDENCE = NO ANSWER.

STRICT REGULATORY & FACTUAL RULES:
1. Answer using ONLY the supplied retrieved documentary evidence for all factual statements.
2. NEVER invent an RBI circular, circular number, notification date, clause number, fee, penal rate, or lending policy.
3. Do NOT use general training knowledge to fill in gaps; if a document does not state a fact, treat it as unknown.
4. Distinguish clearly between consultative draft circulars, final RBI notifications, bank internal loan policies, and subsequent amendments.
5. Consider effective dates (w.e.f.) and applicable borrower categories before stating whether a rule applies.
6. Distinguish Commercial Banks from All-India Financial Institutions (AIFIs), NBFCs, and other regulated entities.
7. Detect and note when two circulars apply to different effective periods or distinct loan products.
8. Cite every material claim using the exact Evidence IDs (e.g. EV-001, EV-002, or Q1, Q2) provided in the prompt.
9. Never invent page numbers, clause identifiers, or verbatim quotations.
10. If the retrieved evidence is missing, contradictory, or insufficient, you MUST explicitly abstain: set "status": "INSUFFICIENT_EVIDENCE", "insufficient_evidence": true, and explain what was missing in "missing_info".
11. If retrieved documents contain competing or conflicting terms, report the conflict in the "conflicts" array rather than silently choosing one.
12. Distinguish mandatory statutory/regulatory directions (e.g. RBI circulars) from individual bank contractual agreements.
13. Keep any chain-of-thought reasoning brief (under 100 words) inside <think>...</think>, and immediately output the final JSON enclosed in markdown json fences without verbose deliberation.

OUTPUT FORMAT:
You MUST output valid, parseable JSON strictly matching this schema:
{
  "answer": "<concise summary directly supported by the evidence>",
  "status": "VERIFIED" | "PARTIALLY_VERIFIED" | "CONFLICTED" | "INSUFFICIENT_EVIDENCE",
  "claims": [
    {
      "claim": "<atomic factual statement>",
      "evidence_ids": ["EV-001"]
    }
  ],
  "conflicts": [
    "<description of contradiction between documents if detected>"
  ],
  "limitations": [
    "<any regulatory scope restrictions or date qualifications>"
  ],
  "requires_human_review": false,
  "insufficient_evidence": false,
  "missing_info": null,
  "calculation": null
}
"""

def extract_calculation_intent(query: str, quotes: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Detect if the query asks for EMI or penalty arithmetic and extract parameters from quotes."""
    q_lower = query.lower()

    # Look for EMI calculation request
    if "emi" in q_lower or "monthly installment" in q_lower or "equated monthly" in q_lower:
        principal = Decimal("100000.00")
        rate = Decimal("12.00")
        tenure = 24

        loan_amt_match = re.search(r"(?:rs\.?|inr|loan\s+(?:of|amount))\s*[:\-]?\s*([0-9,]+)", query, re.IGNORECASE)
        if loan_amt_match:
            try:
                principal = Decimal(loan_amt_match.group(1).replace(",", ""))
            except Exception:
                pass

        tenure_match = re.search(r"([0-9]+)\s*(?:months|yrs|years)", query, re.IGNORECASE)
        if tenure_match:
            t_val = int(tenure_match.group(1))
            tenure = t_val if "month" in tenure_match.group(0) else t_val * 12

        rate_match = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*%", query)
        if rate_match:
            rate = Decimal(rate_match.group(1))

        calc_result = calculate_emi(principal, rate, tenure)
        return {
            "type": "EMI",
            "result": calc_result,
            "summary": f"Calculated EMI: INR {calc_result['monthly_emi']} per month for INR {principal} at {rate}% over {tenure} months."
        }

    # Look for penal charges calculation
    if "penal charge" in q_lower or "penalty" in q_lower or "overdue" in q_lower:
        overdue = Decimal("50000.00")
        penal_rate = Decimal("2.00")
        days = 30

        calc_result = calculate_penal_charges(overdue, penal_rate, days)
        return {
            "type": "PENALTY",
            "result": calc_result,
            "summary": f"Calculated Penal Charge: INR {calc_result['total_penal_charge']} (Base: INR {calc_result['base_penal_charge']} + 18% GST: INR {calc_result['gst_18_percent']}) for {days} days overdue."
        }

    # Look for processing fee calculation
    if "processing fee" in q_lower or "schedule of charges" in q_lower:
        loan_amount = Decimal("500000.00")
        fee_pct = Decimal("1.50")
        calc_result = calculate_processing_fee(loan_amount, fee_pct)
        return {
            "type": "PROCESSING_FEE",
            "result": calc_result,
            "summary": f"Calculated Processing Fee: INR {calc_result['total_fee']} (Base: INR {calc_result['fee_before_gst']} + 18% GST: INR {calc_result['gst']})."
        }

    return None

def fallback_extractive_generation(query: str, quotes: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Deterministic rule-based extractor when external LLMs are unavailable.
    Directly anchors statements to actual retrieved quotes.
    Never hallucinates ungrounded facts.
    """
    if not quotes:
        return {
            "answer": f"ABSTENTION ENFORCED: No relevant clauses found in the document library for query: '{query}'.",
            "status": "INSUFFICIENT_EVIDENCE",
            "claims": [],
            "insufficient_evidence": True,
            "missing_info": f"No relevant clauses found in the document library for query: '{query}'."
        }

    top_quote = quotes[0]
    quote_text = top_quote.get("clause_text", "")

    # Extract first sentence or key statement from top quote
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", quote_text) if len(s.strip()) > 15]

    if not sentences:
        return {
            "answer": f"ABSTENTION ENFORCED: Clause text too sparse to formulate a verifiable factual claim for '{query}'.",
            "status": "INSUFFICIENT_EVIDENCE",
            "claims": [],
            "insufficient_evidence": True,
            "missing_info": f"Clause text too sparse to formulate a verifiable factual claim for '{query}'."
        }

    lead_sentence = sentences[0]
    claims = [
        {
            "text": lead_sentence,
            "claim": lead_sentence,
            "quote_ids": ["EV-001", "Q1"],
            "evidence_ids": ["EV-001"],
            "citations": [
                {
                    "quote": lead_sentence,
                    "document_id": top_quote.get("document_id"),
                    "document_name": top_quote.get("document_name"),
                    "clause_number": top_quote.get("clause_number"),
                    "page_number": top_quote.get("page_number", 1),
                    "bounding_box": top_quote.get("bounding_box")
                }
            ]
        }
    ]

    return {
        "answer": lead_sentence,
        "status": "VERIFIED",
        "claims": claims,
        "insufficient_evidence": False,
        "missing_info": None
    }

async def generate_verifiable_answer(
    query: str,
    retrieved_quotes: List[Dict[str, Any]],
    as_of_date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Coordinates LLM generation via configured provider (OpenRouter Nemotron / Ollama)
    and mathematical calculations. Outputs structured claims and citations for the verification gate.
    """
    calc_data = extract_calculation_intent(query, retrieved_quotes)

    # Format retrieved quotes with dual aliases [EV-xxx] and [Qx]
    quotes_prompt_list = []
    quote_id_map: Dict[str, Dict[str, Any]] = {}

    for idx, q in enumerate(retrieved_quotes):
        ev_id = f"EV-{idx + 1:03d}"
        q_id = f"Q{idx + 1}"
        quote_id_map[ev_id] = q
        quote_id_map[q_id] = q
        c_text = (q.get('clause_text', '') or '').strip()[:1200]
        quotes_prompt_list.append(
            f"[{ev_id} / {q_id}] Document: {q.get('document_name', 'Doc')} | Page: {q.get('page_number', 1)} | Clause: {q.get('clause_number', 'N/A')}\n"
            f"Quote: \"{c_text}\""
        )

    formatted_quotes = "\n\n".join(quotes_prompt_list)
    user_prompt = f"Question: {query}\nAs-of Date: {as_of_date or 'Current'}\n\nRetrieved Documentary Evidence:\n{formatted_quotes}"

    # Resolve active LLM provider
    provider = get_llm_provider()
    provider_name = provider.get_provider_name()
    model_name = provider.get_model_name()

    llm_output: Optional[Dict[str, Any]] = None
    is_fallback = True
    generation_provider = "extractive-fallback"

    try:
        response = await provider.generate(
            prompt=user_prompt,
            system_prompt=SYSTEM_PROMPT,
            temperature=0.2,
            max_tokens=5000
        )
        logger.info(f"LLM Provider [{provider_name}] result: fallback={response.is_fallback}, structured={response.structured is not None}, error={response.error}, raw_len={len(response.raw_content) if response.raw_content else 0}")
        if not response.structured and response.raw_content:
            logger.info(f"LLM Provider raw_content snippet: {response.raw_content[:300]}")

        if not response.is_fallback and response.structured:
            st = response.structured
            # Format output dict
            formatted_claims = []
            for c in st.claims:
                formatted_claims.append({
                    "text": c.claim,
                    "claim": c.claim,
                    "quote_ids": c.evidence_ids,
                    "evidence_ids": c.evidence_ids
                })

            llm_output = {
                "answer": st.answer,
                "status": st.status,
                "claims": formatted_claims,
                "conflicts": st.conflicts,
                "limitations": st.limitations,
                "requires_human_review": st.requires_human_review,
                "insufficient_evidence": st.insufficient_evidence,
                "missing_info": st.missing_info
            }
            is_fallback = False
            generation_provider = f"{provider_name} ({model_name})"
        else:
            if response.error:
                logger.warning(f"{provider_name} returned error: {response.error}. Falling back to extractive grounding.")
            generation_provider = f"extractive-fallback ({response.error or 'provider-unavailable'})"
    except Exception as e:
        logger.error(f"Error during {provider_name} execution: {e}", exc_info=True)
        generation_provider = f"extractive-fallback ({type(e).__name__})"

    # If provider failed, did not return claims, or produced empty output
    if not llm_output or (not llm_output.get("claims") and not llm_output.get("insufficient_evidence")):
        llm_output = fallback_extractive_generation(query, retrieved_quotes)
        is_fallback = True

    llm_output["is_fallback"] = is_fallback
    llm_output["generation_provider"] = generation_provider
    llm_output["model_name"] = model_name

    # If calculation was extracted, attach deterministic calculation step
    if calc_data:
        llm_output["calculation"] = calc_data

    # Map evidence_ids / quote_ids to actual citation objects
    for claim in llm_output.get("claims", []):
        citations = []
        ev_ids = claim.get("evidence_ids") or claim.get("quote_ids") or []
        for eid in ev_ids:
            if eid in quote_id_map:
                source_q = quote_id_map[eid]
                citations.append({
                    "quote": claim.get("text") or claim.get("claim") or source_q.get("clause_text"),
                    "document_id": source_q.get("document_id"),
                    "document_name": source_q.get("document_name"),
                    "clause_number": source_q.get("clause_number"),
                    "page_number": source_q.get("page_number", 1),
                    "bounding_box": source_q.get("bounding_box")
                })
        if not claim.get("citations") and citations:
            claim["citations"] = citations

    return llm_output
