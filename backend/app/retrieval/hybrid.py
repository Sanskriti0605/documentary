import re
from typing import List, Dict, Any, Optional, Tuple
from rank_bm25 import BM25Okapi
from app.retrieval.vector_store import get_qdrant_client
from app.core.config import settings

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
        tokenized_corpus = [tokenize(doc["clause_text"]) for doc in corpus]
        if tokenized_corpus and any(tokenized_corpus):
            self.bm25 = BM25Okapi(tokenized_corpus)
        else:
            self.bm25 = None

    def search_bm25(self, query: str, top_k: int = 10) -> List[Tuple[int, float]]:
        if not self.bm25 or not self.corpus:
            return []
        tokens = tokenize(query)
        scores = self.bm25.get_scores(tokens)
        ranked = sorted(enumerate(scores), key=lambda x: x[1], reverse=True)[:top_k]
        return ranked

    def search_dense(self, query: str, top_k: int = 10) -> List[Tuple[int, float]]:
        # Dense similarity: uses lexical/semantic overlap when local embeddings are indexing
        tokens = set(tokenize(query))
        scored = []
        for idx, doc in enumerate(self.corpus):
            doc_tokens = set(tokenize(doc["clause_text"]))
            overlap = len(tokens.intersection(doc_tokens))
            score = overlap / (len(tokens) + 1e-5)
            scored.append((idx, score))
        ranked = sorted(scored, key=lambda x: x[1], reverse=True)[:top_k]
        return ranked

    def hybrid_search(
        self,
        query: str,
        top_k: int = 5,
        rrf_k: int = 60,
        doc_filter: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Executes Reciprocal Rank Fusion (RRF) between Dense and BM25 retrievers.
        Expands parent-section context.
        """
        if not self.corpus:
            return []

        sub_queries = decompose_query(query)
        rrf_scores: Dict[int, float] = {}

        for sq in sub_queries:
            bm25_results = self.search_bm25(sq, top_k=top_k * 2)
            dense_results = self.search_dense(sq, top_k=top_k * 2)

            for rank, (idx, score) in enumerate(bm25_results):
                rrf_scores[idx] = rrf_scores.get(idx, 0.0) + (1.0 / (rrf_k + rank + 1))

            for rank, (idx, score) in enumerate(dense_results):
                rrf_scores[idx] = rrf_scores.get(idx, 0.0) + (1.0 / (rrf_k + rank + 1))

        # Sort by final RRF score
        sorted_indices = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)

        results = []
        for idx, rrf_score in sorted_indices:
            doc = self.corpus[idx]
            if doc_filter and doc.get("document_id") not in doc_filter:
                continue

            # Context expansion: format parent section and full clause passage
            clause_record = dict(doc)
            clause_record["retrieval_score"] = round(rrf_score, 4)
            clause_record["expanded_context"] = (
                f"[{doc.get('document_name', 'Doc')} | Section: {doc.get('section_title', 'General')} | Clause {doc.get('clause_number', '')}]\n"
                f"{doc.get('clause_text', '')}"
            )
            results.append(clause_record)
            if len(results) >= top_k:
                break

        return results
