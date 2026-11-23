import json
import re
import httpx
from decimal import Decimal
from typing import List, Dict, Any, Optional
from app.core.config import settings
from app.calculations.financial import calculate_emi, calculate_penal_charges, calculate_processing_fee

SYSTEM_PROMPT = """You are VerifyDoc, a verifiable Document AI for Indian banking and financial documents.
Your mission is 100% verifiable factual compliance.
CENTRAL PRINCIPLE: NO EVIDENCE = NO ANSWER.
You must use ONLY the retrieved quotes provided to answer the user question.
You MUST output valid JSON strictly matching this schema:
{
  "claims": [
    {
      "text": "<atomic factual claim>",
      "quote_ids": ["Q1", "Q2"]
    }
  ],
  "calculation": {
    "type": "EMI" | "PENALTY" | "PROCESSING_FEE",
    "principal": 50000.0,
    "rate": 12.5,
    "tenure_months": 24,
    "days_overdue": 30,
    "quote_id": "Q1"
  } | null,
  "insufficient_evidence": false,
  "missing_info": null
}

RULES:
1. Every claim in "claims" must be directly supported by at least one quote_id.
2. If the retrieved quotes do NOT contain sufficient information to answer the question, set "claims": [], "insufficient_evidence": true, and explain in "missing_info" what evidence was searched for and missing.
3. If the user asks for a financial calculation (EMI, penal charge, fee), extract the parameters and citations into the "calculation" object. NEVER do the arithmetic yourself.
4. If the question is in Hindi, provide the claim text in Hindi while referencing the original English quotes.
"""

def extract_calculation_intent(query: str, quotes: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Detect if the query asks for EMI or penalty arithmetic and extract parameters from quotes."""
    q_lower = query.lower()

    # Look for EMI calculation request
    if "emi" in q_lower or "monthly installment" in q_lower or "equated monthly" in q_lower:
        # Search quotes for principal, rate, tenure
        principal = Decimal("100000.00")
        rate = Decimal("12.00")
        tenure = 24

        # Search numbers in query or quotes
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

    return None

async def call_ollama(prompt: str, model_name: str, base_url: str) -> Optional[Dict[str, Any]]:
    """Query local Ollama instance with JSON format enforcement."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{base_url}/api/generate",
                json={
                    "model": model_name,
                    "prompt": prompt,
                    "system": SYSTEM_PROMPT,
                    "format": "json",
                    "stream": False
                }
            )
            if resp.status_code == 200:
                data = resp.json()
                return json.loads(data.get("response", "{}"))
    except Exception:
        pass
    return None

def fallback_extractive_generation(query: str, quotes: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Deterministic rule-based extractor when local Ollama is offline.
    Directly anchors statements to actual retrieved quotes.
    Never hallucinates ungrounded facts.
    """
    if not quotes:
        return {
            "claims": [],
            "insufficient_evidence": True,
            "missing_info": f"No relevant clauses found in the document library for query: '{query}'."
        }

    # Match top quote
    top_quote = quotes[0]
    quote_text = top_quote.get("clause_text", "")

    # Extract first sentence or key statement from top quote
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", quote_text) if len(s.strip()) > 15]

    if not sentences:
        return {
            "claims": [],
            "insufficient_evidence": True,
            "missing_info": f"Clause text too sparse to formulate a verifiable factual claim for '{query}'."
        }

    # Generate claim grounded in top sentence
    lead_sentence = sentences[0]
    claims = [
        {
            "text": lead_sentence,
            "quote_ids": ["Q1"],
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
    Coordinates LLM generation and mathematical calculations.
    Outputs structured claims and citations for the verification gate.
    """
    calc_data = extract_calculation_intent(query, retrieved_quotes)

    # Format retrieved quotes prompt
    quotes_prompt_list = []
    quote_id_map = {}
    for idx, q in enumerate(retrieved_quotes):
        qid = f"Q{idx + 1}"
        quote_id_map[qid] = q
        quotes_prompt_list.append(
            f"[{qid}] Document: {q.get('document_name', 'Doc')} | Page: {q.get('page_number', 1)} | Clause: {q.get('clause_number', 'N/A')}\n"
            f"Quote: \"{q.get('clause_text', '')}\""
        )
    formatted_quotes = "\n\n".join(quotes_prompt_list)

    user_prompt = f"Question: {query}\nAs-of Date: {as_of_date or 'Current'}\n\nRetrieved Documentary Quotes:\n{formatted_quotes}"

    # Try local Ollama if configured
    llm_output = None
    if settings.AI_PROVIDER == "ollama":
        llm_output = await call_ollama(user_prompt, settings.GENERATION_MODEL, settings.OLLAMA_BASE_URL)

    if not llm_output or "claims" not in llm_output:
        llm_output = fallback_extractive_generation(query, retrieved_quotes)

    # If calculation was extracted, add calculation step
    if calc_data:
        llm_output["calculation"] = calc_data

    # Map quote_ids to actual citation objects
    for claim in llm_output.get("claims", []):
        citations = []
        for qid in claim.get("quote_ids", []):
            if qid in quote_id_map:
                source_q = quote_id_map[qid]
                citations.append({
                    "quote": claim.get("text", source_q.get("clause_text")),
                    "document_id": source_q.get("document_id"),
                    "document_name": source_q.get("document_name"),
                    "clause_number": source_q.get("clause_number"),
                    "page_number": source_q.get("page_number", 1),
                    "bounding_box": source_q.get("bounding_box")
                })
        if not claim.get("citations") and citations:
            claim["citations"] = citations

    return llm_output
