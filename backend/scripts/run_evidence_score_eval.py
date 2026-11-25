import os
import sys
from app.verification.gate import run_verification_gate
from app.verification.scoring import build_evidence_score_object

PAGE_TEXT = (
    "Clause 3.1: Foreclosure Charges. No foreclosure charges or pre-payment penalties shall be "
    "levied on floating rate term loans sanctioned to individual borrowers for purposes other than business. "
    "Clause 4.1: Penal charges shall not exceed 2.0% per annum over the contracted rate."
)
PAGE_TEXTS = {("doc-1", 1): PAGE_TEXT, 1: PAGE_TEXT}

cases = [
    {
        "name": "1. Grounded LLM Answer (Foreclosure)",
        "query": "Are foreclosure charges prohibited on floating rate term loans?",
        "claims": [
            {
                "text": "No foreclosure charges shall be levied on floating rate term loans.",
                "citations": [{"quote": "No foreclosure charges or pre-payment penalties shall be levied on floating rate term loans", "page_number": 1, "document_id": "doc-1"}]
            }
        ],
        "answer": "Yes, foreclosure charges are prohibited on floating rate term loans.",
        "retrieved": [{"clause_text": PAGE_TEXT, "score": 9.5}],
        "is_fallback": False,
        "provider": "nvidia/nemotron-3.5-lightning"
    },
    {
        "name": "2. Extractive Fallback (OpenRouter failed)",
        "query": "What are the foreclosure charges for individuals?",
        "claims": [
            {
                "text": "No foreclosure charges or pre-payment penalties shall be levied on floating rate term loans",
                "citations": [{"quote": "No foreclosure charges or pre-payment penalties shall be levied on floating rate term loans", "page_number": 1, "document_id": "doc-1"}],
                "origin": "extractive"
            }
        ],
        "answer": "No foreclosure charges or pre-payment penalties shall be levied on floating rate term loans",
        "retrieved": [{"clause_text": PAGE_TEXT, "score": 9.0}],
        "is_fallback": True,
        "provider": "extractive-fallback"
    },
    {
        "name": "3. Unsupported Claim (Planted Hallucination)",
        "query": "What benefits do borrowers receive?",
        "claims": [
            {
                "text": "Borrowers receive an automatic 3.0% interest rate rebate every year.",
                "citations": [{"quote": "Penal charges shall not exceed 2.0% per annum over the contracted rate.", "page_number": 1, "document_id": "doc-1"}]
            }
        ],
        "answer": "Borrowers receive an automatic 3.0% interest rate rebate every year.",
        "retrieved": [{"clause_text": PAGE_TEXT, "score": 4.0}],
        "is_fallback": False,
        "provider": "nvidia/nemotron-3.5-lightning"
    },
    {
        "name": "4. Irrelevant Topic (Gold Loan Interest)",
        "query": "What is the interest rate on gold loans?",
        "claims": [
            {
                "text": "Foreclosure charges on floating rate term loans are prohibited.",
                "citations": [{"quote": "No foreclosure charges or pre-payment penalties shall be levied on floating rate term loans", "page_number": 1, "document_id": "doc-1"}]
            }
        ],
        "answer": "Foreclosure charges are prohibited on floating rate loans.",
        "retrieved": [{"clause_text": PAGE_TEXT, "score": 2.1, "document_name": "Personal_Loan_Agreement.pdf"}],
        "is_fallback": False,
        "provider": "nvidia/nemotron-3.5-lightning"
    },
    {
        "name": "5. Corpus Abstention (Space Travel Policy)",
        "query": "What is the interest rate on lunar travel loans?",
        "claims": [],
        "answer": "ABSTENTION ENFORCED: Insufficient verifiable documentary evidence found.",
        "retrieved": [],
        "is_fallback": True,
        "provider": "extractive-fallback"
    }
]

print("| Case | Generation Mode | Claims (Gen/Ver/Blk) | Pass Rate | Evidence Strength | Coverage | Relevance | Confidence Band |")
print("| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |")

for c in cases:
    if c["claims"]:
        gate_res = run_verification_gate(c["claims"], PAGE_TEXTS)
    else:
        gate_res = {"status": "INSUFFICIENT_EVIDENCE", "total_claims": 0, "verified_count": 0, "blocked_count": 0, "verified_claims": [], "blocked_claims": []}

    score_obj = build_evidence_score_object(
        gate_result=gate_res,
        query=c["query"],
        answer=c["answer"],
        retrieved_quotes=c["retrieved"],
        is_fallback=c["is_fallback"],
        generation_provider=c["provider"]
    )

    gen_mode = score_obj["generation_mode"]
    c_gen = score_obj["claims_generated"]
    c_ver = score_obj["claims_verified"]
    c_blk = score_obj["claims_blocked"]
    counts = f"{c_gen} / {c_ver} / {c_blk}"
    pr = score_obj["generation_pass_rate"]
    pass_rate = f"{int(pr * 100)}%" if pr is not None else ("N/A (Extractive)" if gen_mode == "extractive" else "N/A (Abstained)")

    ev_obj = score_obj.get("evidence_strength")
    if ev_obj and ev_obj.get("mean") is not None:
        ev_str = f"mean={ev_obj['mean']:.2f}"
    elif ev_obj:
        ev_str = ev_obj.get("label", "None")
    else:
        ev_str = "None"

    cov_score = score_obj["coverage"]["score"]
    cov = f"{int(cov_score * 100)}%"
    rel_score = score_obj["relevance"]["score"]
    rel_warn = score_obj["relevance"].get("warning")
    rel = f"{rel_score:.2f}" + (f" (Warn: {rel_warn[:20]}...)" if rel_warn else "")
    band = score_obj["confidence_band"]

    print(f"| {c['name']} | `{gen_mode}` | {counts} | {pass_rate} | {ev_str} | {cov} | {rel} | **{band}** |")
