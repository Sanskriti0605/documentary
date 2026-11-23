import os
import json
import pytest
from scripts.run_golden_eval import evaluate_single_query

@pytest.fixture
def sample_golden_query():
    return {
        "id": "T01",
        "category": "temporal",
        "question": "Are foreclosure charges banned on floating rate loans to individuals?",
        "as_of": "2024-02-01",
        "expected": "No. Only a non-binding DRAFT exists (SYN_01); nothing is in force.",
        "expected_sources": ["SYN_01"],
        "feature": "temporal / draft handling"
    }

def test_evaluate_abstention_success():
    q_data = {
        "id": "A01",
        "category": "abstention",
        "question": "What is the interest rate on gold loans?",
        "as_of": "2025-02-01",
        "expected": "Abstain. The document library contains no gold loan policy.",
        "expected_sources": []
    }
    api_resp = {
        "status": "INSUFFICIENT_EVIDENCE",
        "answer": "ABSTENTION ENFORCED: Insufficient verifiable evidence found in the document library.",
        "verified_claims": [],
        "retrieved_quotes": [],
        "is_fallback": False
    }
    passed, cause, details = evaluate_single_query(q_data, api_resp, 200)
    assert passed is True
    assert cause == ""

def test_evaluate_missing_source_failure(sample_golden_query):
    api_resp = {
        "status": "VERIFIED",
        "answer": "Foreclosure charges are not banned.",
        "verified_claims": [{"citations": [{"document_name": "SYN_99_Unrelated.pdf"}]}],
        "retrieved_quotes": [{"document_name": "SYN_99_Unrelated.pdf"}],
        "is_fallback": False
    }
    passed, cause, details = evaluate_single_query(sample_golden_query, api_resp, 200)
    assert passed is False
    assert cause == "retrieval"
    assert "SYN_01" in details

def test_evaluate_temporal_violation(sample_golden_query):
    api_resp = {
        "status": "VERIFIED",
        "answer": "Yes, foreclosure charges are in force and banned on floating rate loans.",
        "verified_claims": [{"citations": [{"document_name": "SYN_01_Reg_Draft_Foreclosure_Jan2024.pdf"}]}],
        "retrieved_quotes": [{"document_name": "SYN_01_Reg_Draft_Foreclosure_Jan2024.pdf"}],
        "is_fallback": False
    }
    passed, cause, details = evaluate_single_query(sample_golden_query, api_resp, 200)
    assert passed is False
    assert cause == "temporal"
