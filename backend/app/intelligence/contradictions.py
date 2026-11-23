import re
import json
from typing import List, Dict, Any, Optional, Tuple, Set
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.database.models import Conflict, Clause, Document, AmendmentEdge

SYNONYM_MAP = {
    "penal_charge_rate": [
        "penal charge", "penal charges", "penal interest", "penalty rate",
        "overdue interest", "default interest", "late payment charge"
    ],
    "foreclosure_charges": [
        "foreclosure charge", "foreclosure charges", "prepayment penalty",
        "pre-closure fee", "prepayment charges", "early termination fee", "foreclosure fee"
    ],
    "processing_fee": [
        "processing fee", "upfront fee", "administrative charge", "loan processing fee"
    ],
    "interest_rate": [
        "roi", "rate of interest", "interest rate", "lending rate", "spread", "benchmark rate"
    ],
    "minimum_credit_score": [
        "cibil", "credit score", "minimum credit bureau"
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

def extract_facts_from_clauses(clause_records: List[Tuple[Clause, Document]]) -> List[Dict[str, Any]]:
    """Extract canonical facts (subject, attribute, value, scope, dates) from clauses."""
    facts = []
    for clause, doc in clause_records:
        text = clause.clause_text or ""
        text_lower = text.lower()

        for canonical_sub, synonyms in SYNONYM_MAP.items():
            matched_syn = None
            for syn in synonyms:
                if syn in text_lower:
                    matched_syn = syn
                    break

            if matched_syn:
                # Extract numeric, percentage, or currency values
                pct_matches = re.findall(r'(\d+(?:\.\d+)?\s*%)', text)
                curr_matches = re.findall(r'(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d+)?)', text)
                score_matches = re.findall(r'\b(7\d{2}|6\d{2}|8\d{2})\b', text) if "score" in canonical_sub else []

                val = None
                if pct_matches:
                    val = pct_matches[0].strip()
                elif curr_matches:
                    val = "INR " + curr_matches[0].strip()
                elif score_matches:
                    val = score_matches[0].strip()

                if val:
                    scope = "retail" if "retail" in text_lower else "personal"
                    facts.append({
                        "clause_id": clause.id,
                        "document_id": doc.id,
                        "document_name": doc.name,
                        "clause_number": clause.clause_number,
                        "subject": canonical_sub,
                        "attribute": matched_syn,
                        "value": val,
                        "exact_quote": text.strip(),
                        "effective_from": str(doc.effective_from or doc.publication_date or ""),
                        "scope": scope
                    })
    return facts

def detect_clause_conflicts(
    facts: List[Dict[str, Any]],
    amendment_edges: List[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """
    Compare extracted facts across documents.
    Flags conflicting numbers, percentages, dates or rules for the same subject with compatible scope.
    Identifies cases resolved by an amendment edge or temporal succession.
    """
    amendment_edges = amendment_edges or []
    # Build map of amendment edges: {(src_clause, tgt_clause): edge_details}
    amended_clause_pairs: Set[Tuple[str, str]] = set()
    amended_doc_pairs: Set[Tuple[str, str]] = set()

    for edge in amendment_edges:
        src_c = edge.get("source_clause_id")
        tgt_c = edge.get("target_clause_id")
        if src_c and tgt_c:
            amended_clause_pairs.add((src_c, tgt_c))
            amended_clause_pairs.add((tgt_c, src_c))
        src_d = edge.get("source_document_name")
        tgt_d = edge.get("target_document_name")
        if src_d and tgt_d:
            amended_doc_pairs.add((src_d, tgt_d))
            amended_doc_pairs.add((tgt_d, src_d))

    conflicts = []

    for i in range(len(facts)):
        for j in range(i + 1, len(facts)):
            fact_a = facts[i]
            fact_b = facts[j]

            # Same document? Internal sections usually do not contradict unless amended
            if fact_a.get("document_id") == fact_b.get("document_id"):
                continue

            sub_a = canonicalize_subject(fact_a.get("subject", ""))
            sub_b = canonicalize_subject(fact_b.get("subject", ""))

            if sub_a and sub_a == sub_b:
                val_a = fact_a.get("value", "").strip()
                val_b = fact_b.get("value", "").strip()

                if val_a != val_b:
                    clause_a_id = fact_a.get("clause_id")
                    clause_b_id = fact_b.get("clause_id")
                    doc_a_name = fact_a.get("document_name", "")
                    doc_b_name = fact_b.get("document_name", "")

                    date_a = fact_a.get("effective_from")
                    date_b = fact_b.get("effective_from")

                    # Check if directly or document-level reconciled by an amendment
                    is_amended = (
                        (clause_a_id, clause_b_id) in amended_clause_pairs or
                        (doc_a_name, doc_b_name) in amended_doc_pairs or
                        ("amendment" in doc_a_name.lower() or "amendment" in doc_b_name.lower()) or
                        ("circular" in doc_a_name.lower() and "policy" in doc_b_name.lower() and date_a != date_b)
                    )

                    if is_amended:
                        conflict_type = "SUPERSEDED"
                        resolution_status = "AUTO_RESOLVED"
                        resolution_notes = (
                            f"Auto-reconciled: Prior clause ({val_a}) in {doc_a_name} is superseded by "
                            f"subsequent policy/amendment ({val_b}) in {doc_b_name}."
                        )
                    else:
                        if date_a and date_b and date_a != date_b:
                            conflict_type = "TEMPORAL_DIFFERENCE"
                        else:
                            conflict_type = "CONFIRMED_CONFLICT"
                        resolution_status = "PENDING_REVIEW"
                        resolution_notes = None

                    conflicts.append({
                        "clause_a_id": clause_a_id,
                        "clause_b_id": clause_b_id,
                        "subject": sub_a,
                        "value_a": val_a,
                        "value_b": val_b,
                        "conflict_type": conflict_type,
                        "severity": "HIGH" if "rate" in sub_a or "charge" in sub_a else "MEDIUM",
                        "scope_overlap": True,
                        "temporal_overlap": not is_amended,
                        "resolution_status": resolution_status,
                        "resolution_notes": resolution_notes,
                        "quote_a": fact_a.get("exact_quote", ""),
                        "quote_b": fact_b.get("exact_quote", ""),
                        "doc_a": doc_a_name,
                        "doc_b": doc_b_name,
                    })

    return conflicts

async def scan_and_detect_conflicts(db: AsyncSession) -> Dict[str, Any]:
    """
    Execute full scan across all clauses, detect contradictions with amendment reconciliation,
    and persist results with strict de-duplication.
    """
    # 1. Fetch all clauses joined with documents
    stmt = (
        select(Clause, Document)
        .join(Document, Clause.document_id == Document.id)
        .order_by(Document.name, Clause.clause_number)
    )
    res = await db.execute(stmt)
    records = res.all()
    clause_records = [(r[0], r[1]) for r in records]

    # 2. Fetch existing amendment edges for reconciliation
    edges_res = await db.execute(select(AmendmentEdge))
    edges = edges_res.scalars().all()
    edge_dicts = [
        {
            "source_clause_id": e.source_clause_id,
            "target_clause_id": e.target_clause_id,
            "relationship_type": e.relationship_type
        }
        for e in edges
    ]

    # 3. Extract facts & detect conflicts
    facts = extract_facts_from_clauses(clause_records)
    detected = detect_clause_conflicts(facts, edge_dicts)

    # 4. Fetch existing conflicts for de-duplication
    existing_conflicts_res = await db.execute(select(Conflict))
    existing_conflicts = existing_conflicts_res.scalars().all()

    # Map of (min_id, max_id) -> Conflict entity
    existing_map: Dict[Tuple[str, str], Conflict] = {}
    for c in existing_conflicts:
        pair_key = (min(c.clause_a_id, c.clause_b_id), max(c.clause_a_id, c.clause_b_id))
        existing_map[pair_key] = c

    new_count = 0
    auto_resolved_count = 0
    existing_count = 0

    for det in detected:
        c_a_id = det["clause_a_id"]
        c_b_id = det["clause_b_id"]
        # Canonical order
        if c_a_id > c_b_id:
            c1_id, c2_id = c_b_id, c_a_id
            val1, val2 = det["value_b"], det["value_a"]
        else:
            c1_id, c2_id = c_a_id, c_b_id
            val1, val2 = det["value_a"], det["value_b"]

        pair_key = (c1_id, c2_id)

        if pair_key in existing_map:
            # Existing conflict: update metadata without overwriting manual review status
            existing_c = existing_map[pair_key]
            existing_c.subject = det["subject"]
            existing_c.value_a = val1
            existing_c.value_b = val2
            existing_c.severity = det["severity"]
            existing_c.updated_at = datetime.utcnow()
            existing_count += 1
        else:
            # Create new conflict
            is_auto = det["resolution_status"] == "AUTO_RESOLVED"
            history = []
            if is_auto:
                history.append({
                    "timestamp": datetime.utcnow().isoformat(),
                    "action": "AUTO_RESOLVED",
                    "previous_status": "DETECTED",
                    "new_status": "AUTO_RESOLVED",
                    "notes": det["resolution_notes"] or "Auto-reconciled by amendment rule",
                    "linked_document_name": det.get("doc_b") if "amendment" in det.get("doc_b", "").lower() else det.get("doc_a")
                })
                auto_resolved_count += 1

            new_c = Conflict(
                clause_a_id=c1_id,
                clause_b_id=c2_id,
                conflict_type=det["conflict_type"],
                severity=det["severity"],
                scope_overlap=det["scope_overlap"],
                temporal_overlap=det["temporal_overlap"],
                resolution_status=det["resolution_status"],
                resolution_notes=det["resolution_notes"],
                subject=det["subject"],
                value_a=val1,
                value_b=val2,
                history=json.dumps(history),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(new_c)
            existing_map[pair_key] = new_c
            new_count += 1

    await db.commit()

    total_conflicts = len(existing_map)

    return {
        "scanned_clauses": len(clause_records),
        "new_conflicts": new_count,
        "auto_resolved": auto_resolved_count,
        "existing_conflicts": existing_count,
        "total_conflicts": total_conflicts,
        "message": f"Scan complete: {new_count} new conflicts detected, {auto_resolved_count} auto-resolved, {existing_count} existing."
    }
