import os
import json
import pytest
from app.verification.gate import run_verification_gate, evaluate_nli_entailment
from app.verification.scoring import (
    evaluate_answer_coverage,
    evaluate_retrieval_relevance,
    compute_confidence_band,
    build_evidence_score_object
)
from app.generation.engine import fallback_extractive_generation

SAMPLE_PAGE_TEXT = (
    "Clause 3.1: Foreclosure Charges. No foreclosure charges or pre-payment penalties shall be "
    "levied on floating rate term loans sanctioned to individual borrowers for purposes other than business. "
    "Clause 4.1: Penal charges shall not exceed 2.0% per annum over the contracted rate."
)

PAGE_TEXTS = {
    ("doc-1", 1): SAMPLE_PAGE_TEXT,
    1: SAMPLE_PAGE_TEXT
}

def test_planted_unsupported_claim_lowers_pass_rate():
    """
    1. A planted unsupported claim is blocked, claims_blocked increases,
       and generation_pass_rate is below 1.0.
    """
    claims = [
        {
            "text": "No foreclosure charges shall be levied on floating rate term loans.",
            "citations": [
                {
                    "quote": "No foreclosure charges or pre-payment penalties shall be levied on floating rate term loans",
                    "page_number": 1,
                    "document_id": "doc-1"
                }
            ]
        },
        {
            "text": "All borrowers receive a free holiday voucher to Switzerland.",
            "citations": [
                {
                    "quote": "All borrowers receive a free holiday voucher to Switzerland.",
                    "page_number": 1,
                    "document_id": "doc-1"
                }
            ]
        }
    ]

    gate_result = run_verification_gate(claims, PAGE_TEXTS)
    assert gate_result["total_claims"] == 2
    assert gate_result["verified_count"] == 1
    assert gate_result["blocked_count"] == 1

    score_obj = build_evidence_score_object(
        gate_result=gate_result,
        query="Are foreclosure charges levied?",
        answer="No foreclosure charges shall be levied on floating rate term loans.",
        retrieved_quotes=[{"clause_text": SAMPLE_PAGE_TEXT, "score": 8.5}],
        is_fallback=False,
        generation_provider="nvidia-nemotron"
    )

    assert score_obj["claims_blocked"] == 1
    assert score_obj["claims_verified"] == 1
    assert score_obj["generation_pass_rate"] == 0.50
    assert score_obj["generation_pass_rate"] < 1.0
    assert score_obj["faithfulness_score"] == 50.0

def test_wrong_number_blocked_number_mismatch():
    """
    2. A claim with a wrong number (for example 3% when quote says 2%)
       is blocked with reason and lowers the pass rate.
    """
    claims = [
        {
            "text": "Penal charges shall not exceed 3.0% per annum over the contracted rate.",
            "citations": [
                {
                    "quote": "Penal charges shall not exceed 2.0% per annum over the contracted rate.",
                    "page_number": 1,
                    "document_id": "doc-1"
                }
            ]
        }
    ]

    gate_result = run_verification_gate(claims, PAGE_TEXTS)
    assert gate_result["verified_count"] == 0
    assert gate_result["blocked_count"] == 1
    blocked = gate_result["blocked_claims"][0]
    failure_text = str(blocked.get("failure_reasons"))
    assert "Numerical value" in failure_text or "NUMBER_MISMATCH" in failure_text or "not found" in failure_text

    score_obj = build_evidence_score_object(
        gate_result=gate_result,
        query="What is the cap on penal charges?",
        answer="Penal charges shall not exceed 3.0% per annum.",
        retrieved_quotes=[{"clause_text": SAMPLE_PAGE_TEXT, "score": 8.0}],
        is_fallback=False,
        generation_provider="nvidia-nemotron"
    )

    assert score_obj["generation_pass_rate"] == 0.0

def test_weak_entailment_blocked():
    """
    3. A paraphrase with weak entailment is blocked.
    """
    claims = [
        {
            "text": "Banks are fully permitted to levy high foreclosure charges on all loans unconditionally.",
            "citations": [
                {
                    "quote": "No foreclosure charges or pre-payment penalties shall be levied on floating rate term loans",
                    "page_number": 1,
                    "document_id": "doc-1"
                }
            ]
        }
    ]

    gate_result = run_verification_gate(claims, PAGE_TEXTS)
    assert gate_result["verified_count"] == 0
    assert gate_result["blocked_count"] == 1

def test_extractive_fallback_scoring():
    """
    4. Extractive fallback answers show origin 'extractive', grounding 'by_construction',
       generation_pass_rate as None (no artificial 100%), and mode_label 'Extractive mode'.
    """
    retrieved = [{
        "clause_text": SAMPLE_PAGE_TEXT,
        "document_id": "doc-1",
        "document_name": "Policy.pdf",
        "clause_number": "3.1",
        "page_number": 1,
        "score": 6.5
    }]

    extractive_ans = fallback_extractive_generation("Are foreclosure charges prohibited?", retrieved)
    assert extractive_ans["claims"][0]["origin"] == "extractive"

    gate_result = run_verification_gate(extractive_ans["claims"], PAGE_TEXTS)
    score_obj = build_evidence_score_object(
        gate_result=gate_result,
        query="Are foreclosure charges prohibited?",
        answer=extractive_ans["answer"],
        retrieved_quotes=retrieved,
        is_fallback=True,
        generation_provider="extractive-fallback"
    )

    assert score_obj["generation_mode"] == "extractive"
    assert score_obj["grounding"] == "by_construction"
    assert score_obj["generation_pass_rate"] is None
    assert score_obj["faithfulness_score"] is None
    assert "Extractive mode: quotes are copied from the source" in score_obj["mode_label"]

def test_abstention_returns_null_scores():
    """
    5. Abstention returns null scores and status insufficient_evidence.
    """
    gate_result = {
        "status": "INSUFFICIENT_EVIDENCE",
        "total_claims": 0,
        "verified_count": 0,
        "blocked_count": 0,
        "verified_claims": [],
        "blocked_claims": []
    }

    score_obj = build_evidence_score_object(
        gate_result=gate_result,
        query="What is the space travel interest rate?",
        answer="ABSTENTION ENFORCED: Insufficient verifiable evidence found.",
        retrieved_quotes=[],
        is_fallback=True,
        generation_provider="extractive-fallback"
    )

    assert score_obj["status"] == "INSUFFICIENT_EVIDENCE"
    assert score_obj["is_abstained"] is True
    assert score_obj["generation_pass_rate"] is None
    assert score_obj["evidence_strength"] is None
    assert score_obj["faithfulness_score"] is None
    assert score_obj["confidence_band"] == "INSUFFICIENT"

def test_irrelevant_top_clause_warning_and_band():
    """
    6. Irrelevant top clause (e.g. gold loan against personal loan agreement)
       shows a relevance warning and band Low or Insufficient.
    """
    retrieved = [{
        "clause_text": SAMPLE_PAGE_TEXT,  # mentions foreclosure and penal charges, not gold loans
        "document_name": "Personal_Loan_Agreement.pdf",
        "score": 2.1
    }]

    relevance = evaluate_retrieval_relevance(
        query="What is the interest rate on gold loans?",
        retrieved_quotes=retrieved,
        verified_claims=[]
    )

    assert relevance["is_low_relevance"] is True
    assert relevance["warning"] is not None
    assert "gold loan" in relevance["warning"]

    band, reason = compute_confidence_band(
        is_abstained=False,
        is_extractive=True,
        generation_pass_rate=None,
        evidence_strength_mean=None,
        coverage_score=0.5,
        relevance_score=relevance["score"],
        relevance_warning=relevance["warning"]
    )
    assert band in ["LOW", "INSUFFICIENT"]

def test_coverage_scoring_as_of():
    """
    7. Coverage: an 'as of' question answered without the date or version chain gets
       coverage below 1.0 with the missing element named; a complete answer gets 1.0.
    """
    incomplete_ans = "Foreclosure charges on floating rate term loans are prohibited."
    cov_incomplete = evaluate_answer_coverage(
        query="What are the foreclosure charges as of 1 November 2024?",
        answer=incomplete_ans,
        has_version_chain=True,
        as_of_date="2024-11-01"
    )
    assert cov_incomplete["score"] < 1.0
    assert "effective_date" in cov_incomplete["missing_elements"]

    complete_ans = "As of 1 November 2024, under the amended RBI circular, foreclosure charges are prohibited."
    cov_complete = evaluate_answer_coverage(
        query="What are the foreclosure charges as of 1 November 2024?",
        answer=complete_ans,
        has_version_chain=True,
        as_of_date="2024-11-01"
    )
    assert cov_complete["score"] == 1.0
    assert len(cov_complete["missing_elements"]) == 0

def test_score_distribution_not_all_identical():
    """
    8. Verifies that the multi-signal score object produces variable, honest measurements
       across distinct scenario classes (min, mean, max are not identical).
    """
    scores = []
    # Scenario A: Perfect LLM answer
    s_a = build_evidence_score_object(
        gate_result={
            "total_claims": 2, "verified_count": 2, "blocked_count": 0, "status": "VERIFIED",
            "verified_claims": [{"nli_score": 0.95, "verifier": "deberta-v3-nli"}, {"nli_score": 0.91, "verifier": "deberta-v3-nli"}],
            "blocked_claims": []
        },
        query="Are foreclosure charges prohibited?",
        answer="Yes, foreclosure charges are strictly prohibited on floating rate term loans.",
        retrieved_quotes=[{"clause_text": SAMPLE_PAGE_TEXT, "score": 9.0}],
        is_fallback=False,
        generation_provider="nvidia-nemotron"
    )
    scores.append(s_a)

    # Scenario B: Partial verification (50% pass rate)
    s_b = build_evidence_score_object(
        gate_result={
            "total_claims": 2, "verified_count": 1, "blocked_count": 1, "status": "PARTIALLY_VERIFIED",
            "verified_claims": [{"nli_score": 0.78, "verifier": "deberta-v3-nli"}],
            "blocked_claims": [{"original_claim": "unsupported claim"}]
        },
        query="What are the penal charges and bonuses?",
        answer="Penal charges shall not exceed 2.0% per annum.",
        retrieved_quotes=[{"clause_text": SAMPLE_PAGE_TEXT, "score": 5.0}],
        is_fallback=False,
        generation_provider="nvidia-nemotron"
    )
    scores.append(s_b)

    # Scenario C: Extractive fallback
    s_c = build_evidence_score_object(
        gate_result={
            "total_claims": 1, "verified_count": 1, "blocked_count": 0, "status": "VERIFIED",
            "verified_claims": [{"nli_score": None, "verifier": "extractive-verbatim", "origin": "extractive"}],
            "blocked_claims": []
        },
        query="Are foreclosure charges prohibited?",
        answer=SAMPLE_PAGE_TEXT[:100],
        retrieved_quotes=[{"clause_text": SAMPLE_PAGE_TEXT, "score": 7.0}],
        is_fallback=True,
        generation_provider="extractive-fallback"
    )
    scores.append(s_c)

    # Scenario D: Abstention
    s_d = build_evidence_score_object(
        gate_result={
            "total_claims": 0, "verified_count": 0, "blocked_count": 0, "status": "INSUFFICIENT_EVIDENCE",
            "verified_claims": [], "blocked_claims": []
        },
        query="What is the space travel interest rate?",
        answer="ABSTENTION ENFORCED",
        retrieved_quotes=[],
        is_fallback=True,
        generation_provider="extractive-fallback"
    )
    scores.append(s_d)

    pass_rates = [s["generation_pass_rate"] for s in scores if s["generation_pass_rate"] is not None]
    confidence_bands = [s["confidence_band"] for s in scores]

    assert len(set(pass_rates)) > 1, f"Pass rates must not all be identical: {pass_rates}"
    assert len(set(confidence_bands)) > 1, f"Confidence bands must not all be identical: {confidence_bands}"
    assert "HIGH" in confidence_bands
    assert "INSUFFICIENT" in confidence_bands
