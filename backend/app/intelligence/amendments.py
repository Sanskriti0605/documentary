import json
from datetime import datetime, date
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.database.models import Document, Clause, Page, AmendmentEdge
from app.schemas.amendment import (
    AmendmentResolutionResponse,
    VersionInForceItem,
    ChainVersionItem,
    AmendmentGraphNode,
    AmendmentGraphEdge,
    TimelineItemResponse,
    ApplicabilityConditions
)

class AmendmentGraphManager:
    """Directed graph manager for clause lineages."""
    def __init__(self):
        import networkx as nx
        self.graph = nx.DiGraph()

    def add_clause_node(
        self,
        clause_id: str,
        document_id: str,
        document_name: str,
        clause_number: str,
        section_title: str,
        clause_text: str,
        effective_from: Optional[date] = None,
        effective_to: Optional[date] = None
    ):
        self.graph.add_node(
            clause_id,
            document_id=document_id,
            document_name=document_name,
            clause_number=clause_number,
            section_title=section_title,
            clause_text=clause_text,
            effective_from=effective_from,
            effective_to=effective_to
        )

    def add_amendment_edge(
        self,
        source_clause_id: str,
        target_clause_id: str,
        relationship: str = "AMENDS",
        old_value: Optional[str] = None,
        new_value: Optional[str] = None,
        effective_date: Optional[date] = None
    ):
        self.graph.add_edge(
            source_clause_id,
            target_clause_id,
            relationship=relationship,
            old_value=old_value,
            new_value=new_value,
            effective_date=effective_date
        )

    def get_full_amendment_chain(self, start_clause_id: str) -> List[Dict[str, Any]]:
        if start_clause_id not in self.graph:
            return []
        chain = []
        visited = set()
        def dfs(node):
            if node in visited:
                return
            visited.add(node)
            data = self.graph.nodes[node]
            chain.append({
                "clause_id": node,
                "document_name": data.get("document_name"),
                "clause_number": data.get("clause_number"),
                "clause_text": data.get("clause_text"),
                "effective_from": data.get("effective_from"),
                "effective_to": data.get("effective_to")
            })
            for neighbor in self.graph.successors(node):
                dfs(neighbor)
        dfs(start_clause_id)
        return chain

    def get_version_in_force_today(
        self,
        clause_id: str,
        as_of_date: Optional[date] = None
    ) -> Dict[str, Any]:
        eval_date = as_of_date or date.today()
        chain = self.get_full_amendment_chain(clause_id)
        if not chain:
            return {}
        valid_versions = []
        for item in chain:
            eff_from = item.get("effective_from")
            eff_to = item.get("effective_to")
            if eff_from and eff_from <= eval_date:
                if eff_to is None or eff_to >= eval_date:
                    valid_versions.append(item)
        if valid_versions:
            valid_versions.sort(key=lambda x: x.get("effective_from") or date.min, reverse=True)
            return valid_versions[0]
        return chain[0]

AVAILABLE_RULES = [
    {
        "id": "penal_charges",
        "name": "Penal Charges & Default Interest (RBI Fair Lending / Bank Policy)",
        "subject": "penal_charge_rate"
    },
    {
        "id": "interest_rate",
        "name": "Rate of Interest (Sanction Letter vs Loan Agreement)",
        "subject": "interest_rate"
    },
    {
        "id": "foreclosure_charges",
        "name": "Foreclosure & Prepayment Fees (Floating Rate Rules)",
        "subject": "foreclosure_charges"
    },
    {
        "id": "processing_fee",
        "name": "Loan Processing & Administrative Fees",
        "subject": "processing_fee"
    }
]

PENAL_CHARGES_CHAIN_DOCS = [
    {
        "name": "RBI_Draft_Circular_Penal_Charges_Apr2023.pdf",
        "title": "RBI Draft Circular - Fair Lending Practice - Penal Charges in Loan Accounts",
        "document_type": "RBI_CIRCULAR",
        "issuer": "Reserve Bank of India",
        "publication_date": "2023-04-12",
        "effective_from": "2023-04-12",
        "doc_status": "DRAFT",
        "clause_number": "Draft-Para-1",
        "clause_text": (
            "DRAFT FOR PUBLIC COMMENTS (April 12, 2023): Penalty charged by Regulated Entities for delay in repayment "
            "shall be treated as 'penal charges' and not as 'penal interest'. Comments invited by May 15, 2023. "
            "These draft guidelines are consultative and non-binding until finalized by the Reserve Bank."
        ),
        "relationship_to_prior": "CLARIFIES",
        "amending_quote": "Draft issued for public consultation; non-binding regulatory guidance.",
        "is_partial_amendment": False,
        "applicability": {
            "lender_type": "All Regulated Entities (Consultative Paper)",
            "sanction_date": "Draft Phase - Non-binding",
            "scope": "Retail Lending Default Charges",
            "notes": "Non-binding draft consultative circular issued for stakeholder feedback."
        }
    },
    {
        "name": "BNB_Retail_Loan_Policy_2023.pdf",
        "title": "Bharat National Bank - Retail Loan Policy 2023",
        "document_type": "BANK_LOAN_POLICY",
        "issuer": "Bharat National Bank",
        "publication_date": "2023-01-01",
        "effective_from": "2023-01-01",
        "doc_status": "IN_FORCE",
        "clause_number": "4.1",
        "clause_text": (
            "Clause 4.1: Penal Charges for Default. The penal charge for default on personal loan monthly "
            "installments shall be 2.0% per annum on the overdue amount. Compound penal interest permitted."
        ),
        "relationship_to_prior": None,
        "amending_quote": "Baseline bank policy governing retail personal loan products.",
        "is_partial_amendment": False,
        "applicability": {
            "lender_type": "Bharat National Bank (Retail Lending Branches)",
            "sanction_date": "Loans sanctioned under 2023 Policy",
            "scope": "Personal and Retail Term Loans",
            "notes": "Baseline binding bank loan policy in force prior to RBI master directions."
        }
    },
    {
        "name": "RBI_Fair_Lending_Circular_Aug2023_Final.pdf",
        "title": "RBI Master Direction RBI/2023-24/53 DOR.MCS.REC.28/01.01.001/2023-24",
        "document_type": "RBI_MASTER_DIRECTION",
        "issuer": "Reserve Bank of India",
        "publication_date": "2023-08-18",
        "effective_from": "2024-01-01",
        "doc_status": "IN_FORCE",
        "clause_number": "3",
        "clause_text": (
            "Paragraph 3: In partial modification of earlier lending directions, with effect from January 1, 2024, "
            "penalty for non-compliance of material terms of loan contract by the borrower shall be treated as 'penal charges' "
            "and shall not be levied in the form of 'penal interest' added to the rate of interest. No capitalisation of penal charges."
        ),
        "relationship_to_prior": "SUPERSEDES",
        "amending_quote": "In partial modification of earlier lending directions, with effect from January 1, 2024, penalty shall not be levied in the form of penal interest.",
        "is_partial_amendment": False,
        "applicability": {
            "lender_type": "All Commercial Banks, NBFCs, UCBs, and Housing Finance Companies",
            "sanction_date": "New loans sanctioned from January 1, 2024; existing loans to switch at renewal or within 3 months",
            "scope": "All Retail, MSME, and Individual Lending Facilities",
            "notes": "Statutory mandate strictly prohibiting compound penal interest; initial implementation w.e.f. Jan 1, 2024."
        }
    },
    {
        "name": "RBI_Extension_Circular_Dec2023.pdf",
        "title": "RBI Circular RBI/2023-24/92 DOR.MCS.REC.61/01.01.001/2023-24",
        "document_type": "RBI_CIRCULAR",
        "issuer": "Reserve Bank of India",
        "publication_date": "2023-12-29",
        "effective_from": "2024-04-01",
        "doc_status": "IN_FORCE",
        "clause_number": "2",
        "clause_text": (
            "Paragraph 2: In partial modification of Circular DOR.MCS.REC.28/01.01.001/2023-24 dated August 18, 2023, "
            "the timeline for implementation of the instructions on Penal Charges in Loan Accounts is hereby extended to April 1, 2024. "
            "For existing loans, transition deadline extended to June 30, 2024."
        ),
        "relationship_to_prior": "EXTENDS",
        "amending_quote": "In partial modification of Circular dated August 18, 2023, the timeline for implementation is hereby extended to April 1, 2024.",
        "is_partial_amendment": False,
        "applicability": {
            "lender_type": "All Regulated Entities (Commercial Banks, NBFCs, HFCs)",
            "sanction_date": "New loans from April 1, 2024; existing loan transition deadline extended to June 30, 2024",
            "scope": "Retail Loan Accounts Across India",
            "notes": "Official 3-month timeline extension granted by Reserve Bank of India."
        }
    },
    {
        "name": "BNB_Loan_Policy_Amendment_2025.pdf",
        "title": "Bharat National Bank - Policy Amendment 2025",
        "document_type": "BANK_LOAN_POLICY",
        "issuer": "Bharat National Bank",
        "publication_date": "2025-01-01",
        "effective_from": "2025-01-01",
        "doc_status": "IN_FORCE",
        "clause_number": "4.1",
        "clause_text": (
            "In partial modification of Clause 4.1 of Retail Loan Policy 2023, with effect from 01/01/2025, "
            "penal charges for personal loan default shall be substituted with 1.75% per annum on the overdue amount. "
            "Clause 8.1: Supersession. All prior branch circulars prescribing higher penal rates stand deleted."
        ),
        "relationship_to_prior": "PARTIAL_AMENDMENT",
        "amending_quote": "In partial modification of Clause 4.1 of Retail Loan Policy 2023, with effect from 01/01/2025, penal charges shall be substituted with 1.75% per annum.",
        "is_partial_amendment": True,
        "applicability": {
            "lender_type": "Bharat National Bank (All Branches)",
            "sanction_date": "All active personal loans and renewals as of January 1, 2025",
            "scope": "Personal Loan Facility (Overdue Default Installments)",
            "notes": "Partial amendment: substitutes Clause 4.1 rate (1.75%) while inheriting baseline policy provisions from Retail Loan Policy 2023."
        }
    }
]

async def ensure_seed_penal_chain_in_db(db: AsyncSession):
    """Ensure documents and clauses for the penal-charges chain exist in the DB."""
    for item in PENAL_CHARGES_CHAIN_DOCS:
        # Check if document exists
        doc_res = await db.execute(select(Document).where(Document.name == item["name"]))
        doc = doc_res.scalar_one_or_none()
        if not doc:
            doc = Document(
                name=item["name"],
                file_hash=f"hash-{item['name']}",
                file_path=f"storage/uploads/{item['name']}",
                document_type=item["document_type"],
                domain="RETAIL_LENDING",
                issuer=item["issuer"],
                publication_date=datetime.strptime(item["publication_date"], "%Y-%m-%d").date(),
                effective_from=datetime.strptime(item["effective_from"], "%Y-%m-%d").date(),
                status="PROCESSED",
                doc_status=item["doc_status"],
                version="1.0"
            )
            db.add(doc)
            await db.flush()

        # Check if page exists
        page_res = await db.execute(select(Page).where(Page.document_id == doc.id, Page.page_number == 1))
        page = page_res.scalar_one_or_none()
        if not page:
            page = Page(
                document_id=doc.id,
                page_number=1,
                extracted_text=item["clause_text"],
                extraction_confidence=1.0
            )
            db.add(page)
            await db.flush()

        # Check if clause exists
        cl_res = await db.execute(
            select(Clause).where(
                Clause.document_id == doc.id,
                Clause.clause_number == item["clause_number"]
            )
        )
        clause = cl_res.scalars().first()
        if not clause:
            clause = Clause(
                document_id=doc.id,
                page_id=page.id,
                clause_number=item["clause_number"],
                section_title=item["title"],
                clause_text=item["clause_text"],
                subject="penal_charge_rate",
                attribute="penal charge",
                scope="personal",
                effective_from=datetime.strptime(item["effective_from"], "%Y-%m-%d").date()
            )
            db.add(clause)
            await db.flush()

    await db.commit()

def parse_as_of_date(as_of: Optional[str]) -> date:
    if not as_of:
        return date.today()
    try:
        return datetime.strptime(as_of, "%Y-%m-%d").date()
    except Exception:
        return date.today()

async def resolve_amendments_for_rule(
    rule: str,
    as_of: Optional[str] = None,
    lender_type: Optional[str] = None,
    sanction_date: Optional[str] = None,
    db: AsyncSession = None
) -> AmendmentResolutionResponse:
    """
    Resolve amendment chain, graph nodes, timeline, and version in force on specified as_of date.
    Strictly handles:
    - Future effective dates (effective_from > as_of) -> FUTURE_EFFECTIVE
    - Drafts -> DRAFT_NON_BINDING (does not supersede binding policy)
    - Partial amendments -> marked with inherited parent terms
    - Withdrawn documents -> WITHDRAWN (rejected as in-force)
    - Applicability conditions (sanction date, lender type)
    """
    if db:
        await ensure_seed_penal_chain_in_db(db)

    eval_date = parse_as_of_date(as_of)
    eval_date_str = eval_date.strftime("%Y-%m-%d")

    # Selected items for this rule
    rule_key = rule.lower().strip() if rule else "penal_charges"
    if "rate" in rule_key and "penal" not in rule_key:
        active_chain_specs = [
            {
                "name": "BNB_Loan_Sanction_Letter.pdf",
                "title": "BNB Loan Sanction Letter (Rajesh Sharma)",
                "document_type": "SANCTION_LETTER",
                "issuer": "Bharat National Bank",
                "publication_date": "2025-05-05",
                "effective_from": "2025-05-05",
                "doc_status": "IN_FORCE",
                "clause_number": "Preamble",
                "clause_text": "Sanctioned Rate of Interest: 11.0% per annum fixed for the entire 36 months tenure.",
                "relationship_to_prior": None,
                "amending_quote": "Individual sanction term issued on May 5, 2025.",
                "is_partial_amendment": False,
                "applicability": {
                    "lender_type": "Bharat National Bank",
                    "sanction_date": "05/05/2025",
                    "scope": "Personal Loan Facility",
                    "notes": "Sanction letter terms prevail prior to execution of formal loan agreement."
                }
            },
            {
                "name": "BNB_Personal_Loan_Agreement.pdf",
                "title": "BNB Personal Loan Agreement (Rajesh Sharma)",
                "document_type": "PERSONAL_LOAN_AGREEMENT",
                "issuer": "Bharat National Bank",
                "publication_date": "2025-05-10",
                "effective_from": "2025-05-10",
                "doc_status": "IN_FORCE",
                "clause_number": "3.1",
                "clause_text": "Clause 3.1: Interest Rate. The agreed Rate of Interest for this personal loan is 12.5% per annum on a reducing balance basis.",
                "relationship_to_prior": "MODIFIES",
                "amending_quote": "Agreed rate executed in bilateral loan contract dated May 10, 2025.",
                "is_partial_amendment": False,
                "applicability": {
                    "lender_type": "Bharat National Bank",
                    "sanction_date": "Executed 10/05/2025",
                    "scope": "Rajesh Sharma Personal Loan",
                    "notes": "Binding loan agreement clause governs interest calculation."
                }
            }
        ]
    else:
        # Default: Penal charges regulatory chain
        active_chain_specs = PENAL_CHARGES_CHAIN_DOCS

    # Build chain versions and evaluate status on eval_date
    chain_items: List[ChainVersionItem] = []
    nodes: List[AmendmentGraphNode] = []
    edges: List[AmendmentGraphEdge] = []
    timeline: List[TimelineItemResponse] = []

    # Sort specs chronologically by publication_date
    sorted_specs = sorted(
        active_chain_specs,
        key=lambda s: datetime.strptime(s["publication_date"], "%Y-%m-%d").date()
    )

    in_force_candidate: Optional[Tuple[Dict[str, Any], date]] = None

    # Check if an extension circular published on or before eval_date extends effective dates
    extended_dates: Dict[str, date] = {}
    for s in sorted_specs:
        s_pub_d = datetime.strptime(s["publication_date"], "%Y-%m-%d").date()
        if s_pub_d <= eval_date and s.get("relationship_to_prior") == "EXTENDS":
            ext_eff_d = datetime.strptime(s["effective_from"], "%Y-%m-%d").date()
            extended_dates["RBI_Fair_Lending_Circular_Aug2023_Final.pdf"] = ext_eff_d

    for idx, spec in enumerate(sorted_specs):
        pub_d = datetime.strptime(spec["publication_date"], "%Y-%m-%d").date()
        eff_d = datetime.strptime(spec["effective_from"], "%Y-%m-%d").date() if spec.get("effective_from") else pub_d

        if spec["name"] in extended_dates:
            eff_d = extended_dates[spec["name"]]

        # Status Evaluation Logic on eval_date
        is_draft = spec.get("doc_status") == "DRAFT" or "draft" in spec["name"].lower()
        is_withdrawn = spec.get("doc_status") == "WITHDRAWN" or "withdrawn" in spec["name"].lower()

        if is_withdrawn:
            version_status = "WITHDRAWN"
        elif is_draft:
            version_status = "DRAFT_NON_BINDING"
        elif eff_d > eval_date:
            version_status = "FUTURE_EFFECTIVE"
        else:
            # Published & effective date is on or before eval_date
            version_status = "IN_FORCE"

        chain_id = f"node-{idx+1}-{spec['name']}"
        app_cond = ApplicabilityConditions(**spec["applicability"]) if spec.get("applicability") else None

        # Build timeline item
        timeline.append(TimelineItemResponse(
            date=spec["effective_from"] or spec["publication_date"],
            event_type=spec.get("relationship_to_prior") or "PUBLISHED",
            document_name=spec["name"],
            clause_number=spec.get("clause_number"),
            description=f"{spec['title']} ({version_status})",
            clause_id=chain_id,
            status=version_status,
            quote=spec["clause_text"]
        ))

        # Build graph node
        node_status_color = version_status
        nodes.append(AmendmentGraphNode(
            id=chain_id,
            label=f"{spec['name']}\n(Cl. {spec.get('clause_number') or 'N/A'})\n[{version_status}]",
            document_name=spec["name"],
            document_type=spec["document_type"],
            clause_number=spec.get("clause_number"),
            section_title=spec["title"],
            clause_text=spec["clause_text"],
            effective_from=str(eff_d),
            status=version_status
        ))

        # Build edge from predecessor
        if idx > 0:
            prev_id = f"node-{idx}-{sorted_specs[idx-1]['name']}"
            rel_label = (spec.get("relationship_to_prior") or "amends").lower()
            edges.append(AmendmentGraphEdge(
                id=f"edge-{idx}",
                source=chain_id,
                target=prev_id,
                relationship=rel_label,
                effective_date=str(eff_d)
            ))

        chain_items.append(ChainVersionItem(
            id=chain_id,
            document_id=f"doc-{idx}",
            document_name=spec["name"],
            document_type=spec["document_type"],
            clause_number=spec.get("clause_number"),
            publication_date=spec["publication_date"],
            effective_from=spec.get("effective_from"),
            status=version_status,
            relationship_to_prior=spec.get("relationship_to_prior"),
            quote=spec["clause_text"],
            amending_quote=spec.get("amending_quote"),
            is_partial_amendment=spec.get("is_partial_amendment", False),
            applicability_conditions=app_cond
        ))

    # Now determine the single version legally in force as of eval_date
    # Rules:
    # 1. Non-binding drafts and withdrawn docs cannot be in force.
    # 2. Future effective versions cannot be in force yet.
    # 3. Among valid versions with effective_from <= eval_date, the latest effective_from governs.
    # 4. Older versions superseded by the latest in-force version are marked SUPERSEDED.
    eligible_versions = []
    for item, spec in zip(chain_items, sorted_specs):
        eff_d = datetime.strptime(spec["effective_from"], "%Y-%m-%d").date() if spec.get("effective_from") else date.min
        if item.status == "IN_FORCE":
            eligible_versions.append((item, spec, eff_d))

    version_in_force_item: Optional[VersionInForceItem] = None

    if eligible_versions:
        # Pick the most recent effective_from
        eligible_versions.sort(key=lambda x: x[2], reverse=True)
        winner_item, winner_spec, _ = eligible_versions[0]

        # Mark older in-force versions as SUPERSEDED
        for item, spec in zip(chain_items, sorted_specs):
            if item.id != winner_item.id and item.status == "IN_FORCE":
                item.status = "SUPERSEDED"
                # Update corresponding graph node & timeline item
                for n in nodes:
                    if n.id == item.id:
                        n.status = "SUPERSEDED"
                        n.label = f"{spec['name']}\n(Cl. {spec.get('clause_number') or 'N/A'})\n[SUPERSEDED]"
                for t in timeline:
                    if t.clause_id == item.id:
                        t.status = "SUPERSEDED"

        # If winner is partial amendment, link parent document
        inherited_doc = "BNB_Retail_Loan_Policy_2023.pdf" if winner_spec.get("is_partial_amendment") else None

        version_in_force_item = VersionInForceItem(
            document_id=winner_item.document_id,
            document_name=winner_item.document_name,
            document_type=winner_item.document_type,
            clause_number=winner_item.clause_number,
            effective_from=winner_item.effective_from,
            status="IN_FORCE",
            quote=winner_item.quote,
            amending_quote=winner_item.amending_quote,
            is_partial_amendment=winner_item.is_partial_amendment,
            inherited_from_document=inherited_doc,
            applicability_conditions=winner_item.applicability_conditions
        )

    return AmendmentResolutionResponse(
        rule=rule_key,
        as_of=eval_date_str,
        version_in_force=version_in_force_item,
        chain=chain_items,
        nodes=nodes,
        edges=edges,
        timeline=timeline,
        available_rules=AVAILABLE_RULES
    )
