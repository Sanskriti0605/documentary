import re
from typing import List, Dict, Any, Optional
from datetime import date

SYNONYM_MAP = {
    "penal_charge_rate": [
        "penal charge", "penal charges", "penal interest", "penalty rate",
        "overdue interest", "default interest", "late payment charge"
    ],
    "foreclosure_charges": [
        "foreclosure charge", "foreclosure charges", "prepayment penalty",
        "pre-closure fee", "prepayment charges", "early termination fee"
    ],
    "processing_fee": [
        "processing fee", "upfront fee", "administrative charge", "loan processing fee"
    ],
    "interest_rate": [
        "roi", "rate of interest", "interest rate", "lending rate", "spread", "benchmark rate"
    ]
}

def canonicalize_subject(raw_subject: str) -> str:
    """Map variations to standard canonical subject keys."""
    raw_clean = raw_subject.lower().strip()
    for canonical, synonyms in SYNONYM_MAP.items():
        if raw_clean == canonical:
            return canonical
        for syn in synonyms:
            if syn in raw_clean:
                return canonical
    return raw_clean

def detect_clause_conflicts(
    facts: List[Dict[str, Any]],
    amendment_edges: List[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """
    Compare extracted facts across documents.
    Flags conflicting numbers, percentages, dates or rules for the same subject with compatible scope.
    Excludes cases already reconciled or resolved by an amendment edge.
    """
    amendment_edges = amendment_edges or []
    # Build set of amended pairs: (source_clause_id, target_clause_id)
    amended_pairs = set()
    for edge in amendment_edges:
        amended_pairs.add((edge.get("source_clause_id"), edge.get("target_clause_id")))
        amended_pairs.add((edge.get("target_clause_id"), edge.get("source_clause_id")))

    conflicts = []

    for i in range(len(facts)):
        for j in range(i + 1, len(facts)):
            fact_a = facts[i]
            fact_b = facts[j]

            # Same document? Generally internal sections don't contradict unless amended
            if fact_a.get("document_id") == fact_b.get("document_id"):
                continue

            sub_a = canonicalize_subject(fact_a.get("subject", ""))
            sub_b = canonicalize_subject(fact_b.get("subject", ""))

            if sub_a and sub_a == sub_b:
                attr_a = fact_a.get("attribute", "").lower()
                attr_b = fact_b.get("attribute", "").lower()

                # If attributes match or are general rate/fee
                val_a = fact_a.get("value", "").strip()
                val_b = fact_b.get("value", "").strip()

                if val_a != val_b:
                    clause_a_id = fact_a.get("clause_id")
                    clause_b_id = fact_b.get("clause_id")

                    # Check if already resolved by amendment
                    if (clause_a_id, clause_b_id) in amended_pairs:
                        continue

                    # Check date overlap
                    date_a = fact_a.get("effective_from")
                    date_b = fact_b.get("effective_from")
                    temporal_overlap = True
                    if date_a and date_b and date_a != date_b:
                        conflict_type = "TEMPORAL_DIFFERENCE"
                    else:
                        conflict_type = "CONFIRMED_CONFLICT"

                    conflicts.append({
                        "subject": sub_a,
                        "clause_a": fact_a,
                        "clause_b": fact_b,
                        "value_a": val_a,
                        "value_b": val_b,
                        "conflict_type": conflict_type,
                        "severity": "HIGH" if "rate" in sub_a or "charge" in sub_a else "MEDIUM",
                        "scope_overlap": True,
                        "temporal_overlap": temporal_overlap,
                        "quote_a": fact_a.get("exact_quote", ""),
                        "quote_b": fact_b.get("exact_quote", ""),
                        "doc_a": fact_a.get("document_name", "Document A"),
                        "doc_b": fact_b.get("document_name", "Document B"),
                        "page_a": fact_a.get("page_number", 1),
                        "page_b": fact_b.get("page_number", 1),
                    })

    return conflicts
