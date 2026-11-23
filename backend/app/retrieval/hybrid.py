import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from rank_bm25 import BM25Okapi
from app.core.config import settings
from app.retrieval.vector_store import get_authority_tier, search_dense_qdrant

logger = logging.getLogger("veritas.retrieval.hybrid")

def tokenize(text: str) -> List[str]:
    return [w.lower() for w in re.findall(r"\w+", text) if len(w) > 1]

def decompose_query(query: str) -> List[str]:
    """
    Decompose multi-part complex questions into focused sub-queries.
    Handles conjunctions like 'and', 'also', 'as well as', 'versus', 'compared to'.
    """
    sub_queries = [query]
    parts = re.split(r"\b(?:and|also|as well as|along with)\b", query, flags=re.IGNORECASE)
    cleaned = [p.strip() for p in parts if len(p.strip()) > 10]
    if len(cleaned) > 1:
        sub_queries.extend(cleaned)
    return sub_queries

class HybridRetriever:
    def __init__(self, corpus: List[Dict[str, Any]]):
        """
        corpus is a list of clause dictionaries with keys:
        'id', 'document_id', 'document_name', 'clause_number', 'section_title',
        'clause_text', 'page_number', 'bounding_box', 'effective_from'
        """
        self.corpus = corpus
        tokenized_corpus = [tokenize(doc.get("clause_text", "")) for doc in corpus]
        if tokenized_corpus and any(tokenized_corpus):
            self.bm25 = BM25Okapi(tokenized_corpus)
        else:
            self.bm25 = None

        self.clause_id_to_idx: Dict[str, int] = {}
        for idx, doc in enumerate(corpus):
            cid = str(doc.get("clause_id") or doc.get("id") or "")
            if cid:
                self.clause_id_to_idx[cid] = idx

    def search_bm25(self, query: str, top_k: int = 10) -> List[Tuple[int, float]]:
        if not self.bm25 or not self.corpus:
            return []
        tokens = tokenize(query)
        scores = self.bm25.get_scores(tokens)
        ranked = sorted(enumerate(scores), key=lambda x: x[1], reverse=True)[:top_k]
        return ranked

    def search_dense(
        self,
        query: str,
        top_k: int = 10,
        doc_filter: Optional[List[str]] = None
    ) -> List[Tuple[int, float]]:
        """
        Real dense vector search using BGE-M3 embeddings in Qdrant.
        Never silently falls back to lexical token overlap.
        """
        try:
            hits = search_dense_qdrant(query=query, top_k=top_k, doc_filter=doc_filter)
            ranked = []
            for hit in hits:
                cid = str(hit.get("clause_id") or hit.get("id") or "")
                idx = self.clause_id_to_idx.get(cid)
                if idx is not None:
                    ranked.append((idx, hit.get("dense_score", 0.0)))
            return ranked
        except Exception as e:
            logger.error(f"Real dense search via Qdrant/BGE-M3 failed: {e}")
            raise RuntimeError(f"Dense vector search failed: {e}")

    def hybrid_search(
        self,
        query: str,
        top_k: int = 5,
        rrf_k: int = 60,
        doc_filter: Optional[List[str]] = None,
        as_of_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Executes Reciprocal Rank Fusion (RRF) between Dense (BGE-M3) and BM25 retrievers.
        Applies authority tier ranking and expands parent-section context.
        """
        if not self.corpus:
            return []

        sub_queries = decompose_query(query)
        rrf_scores: Dict[int, float] = {}
        dense_hits_map: Dict[int, float] = {}
        bm25_hits_map: Dict[int, float] = {}
        retrieval_mode = "hybrid (BGE-M3 dense + BM25 lexical)"

        for sq in sub_queries:
            bm25_results = self.search_bm25(sq, top_k=top_k * 3)
            for rank, (idx, score) in enumerate(bm25_results):
                bm25_hits_map[idx] = max(bm25_hits_map.get(idx, 0.0), score)
                rrf_scores[idx] = rrf_scores.get(idx, 0.0) + (1.0 / (rrf_k + rank + 1))

            try:
                dense_results = self.search_dense(sq, top_k=top_k * 3, doc_filter=doc_filter)
                for rank, (idx, score) in enumerate(dense_results):
                    dense_hits_map[idx] = max(dense_hits_map.get(idx, 0.0), score)
                    rrf_scores[idx] = rrf_scores.get(idx, 0.0) + (1.0 / (rrf_k + rank + 1))
            except Exception as e:
                logger.warning(f"Dense search unavailable during hybrid retrieval: {e}. Degrading to BM25-only.")
                retrieval_mode = "degraded (BM25-only, BGE-M3 dense unavailable)"

        # Sort by base RRF score
        sorted_indices = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)

        results = []
        for idx, rrf_score in sorted_indices:
            doc = self.corpus[idx]
            if doc_filter and doc.get("document_id") not in doc_filter:
                continue

            # Authority tier & in-force weighting
            doc_type = doc.get("doc_type") or doc.get("document_type")
            auth_tier = get_authority_tier(doc_type)

            # Boost authority: regulator (4) > bank policy (3) > agreement (2) > draft (1)
            tier_multiplier = 1.0 + (0.05 * auth_tier)

            # Drafts and withdrawn documents penalized when in-force alternatives exist
            status = str(doc.get("status") or doc.get("doc_status") or "").upper()
            if "DRAFT" in status or "WITHDRAWN" in status:
                tier_multiplier *= 0.7

            final_score = round(rrf_score * tier_multiplier, 4)

            clause_record = dict(doc)
            clause_record["retrieval_score"] = final_score
            clause_record["rrf_score"] = round(rrf_score, 4)
            clause_record["dense_score"] = round(dense_hits_map.get(idx, 0.0), 4)
            clause_record["bm25_score"] = round(bm25_hits_map.get(idx, 0.0), 4)
            clause_record["authority_tier"] = auth_tier
            clause_record["retrieval_mode"] = retrieval_mode
            clause_record["expanded_context"] = (
                f"[{doc.get('document_name', 'Doc')} | Section: {doc.get('section_title', 'General')} | Clause {doc.get('clause_number', '')}]\n"
                f"{doc.get('clause_text', '')}"
            )
            results.append(clause_record)
            if len(results) >= top_k:
                break

        return results
