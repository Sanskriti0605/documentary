import networkx as nx
from datetime import date
from typing import List, Dict, Any, Optional

class AmendmentGraphManager:
    def __init__(self):
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
        source_clause_id: str,  # Newer / revised clause
        target_clause_id: str,  # Older / amended clause
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
        """
        Traverse the graph and return the full linear amendment history A -> B -> C.
        """
        if start_clause_id not in self.graph:
            return []

        # Find ancestors (clauses amended by this one) and descendants (clauses amending this one)
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
        """
        Given a clause, traverses the amendment chain to find which version is legally in force
        as of the specified date (defaults to today).
        """
        eval_date = as_of_date or date.today()
        chain = self.get_full_amendment_chain(clause_id)
        if not chain:
            return {}

        # Sort by effective_from descending
        valid_versions = []
        for item in chain:
            eff_from = item.get("effective_from")
            eff_to = item.get("effective_to")
            if eff_from and eff_from <= eval_date:
                if eff_to is None or eff_to >= eval_date:
                    valid_versions.append(item)

        if valid_versions:
            # Pick the most recent effective version
            valid_versions.sort(key=lambda x: x.get("effective_from") or date.min, reverse=True)
            return valid_versions[0]

        return chain[0]
