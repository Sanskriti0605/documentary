import os
import uuid
import logging
from typing import Optional, List, Dict, Any
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from app.core.config import settings
from app.retrieval.embeddings import embed_texts, embed_query

logger = logging.getLogger("veritas.retrieval.vector_store")

_qdrant_client: Optional[QdrantClient] = None

def get_qdrant_client() -> QdrantClient:
    global _qdrant_client
    if _qdrant_client is None:
        if settings.QDRANT_URL:
            _qdrant_client = QdrantClient(url=settings.QDRANT_URL)
        else:
            os.makedirs(settings.QDRANT_STORAGE_PATH, exist_ok=True)
            _qdrant_client = QdrantClient(path=settings.QDRANT_STORAGE_PATH)
    return _qdrant_client

def init_qdrant_collections(vector_size: int = 1024) -> bool:
    """Ensure the target collection exists with Cosine distance metric."""
    client = get_qdrant_client()
    try:
        collections = client.get_collections().collections
        collection_names = [c.name for c in collections]

        if settings.QDRANT_COLLECTION not in collection_names:
            client.create_collection(
                collection_name=settings.QDRANT_COLLECTION,
                vectors_config=qmodels.VectorParams(
                    size=vector_size,
                    distance=qmodels.Distance.COSINE
                )
            )
            logger.info(f"Created Qdrant collection '{settings.QDRANT_COLLECTION}' (size={vector_size}).")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize Qdrant collections: {e}")
        raise

def get_authority_tier(doc_type: Optional[str]) -> int:
    """
    Authority tier hierarchy:
    Tier 1 (Regulator): RBI Master Directions, Circulars, Notifications -> 4
    Tier 2 (Bank Policy): Bank Loan Policies, Fair Lending, Grievance -> 3
    Tier 3 (Agreement): Sanction Letters, Loan Agreements, KFS -> 2
    Tier 4 (Drafts / Non-binding): Draft circulars -> 1
    Other: 1
    """
    if not doc_type:
        return 1
    dt = doc_type.upper()
    if "DRAFT" in dt:
        return 1
    if any(k in dt for k in ["RBI", "MASTER_DIRECTION", "CIRCULAR", "REGULAT"]):
        return 4
    if any(k in dt for k in ["POLICY", "SCHEDULE_OF_CHARGES"]):
        return 3
    if any(k in dt for k in ["AGREEMENT", "SANCTION", "KEY_FACTS", "KFS"]):
        return 2
    return 1

def index_clauses_in_qdrant(clauses_data: List[Dict[str, Any]]) -> int:
    """
    Embed and upsert clause records into Qdrant collection with full required payload:
    document_id, page, bbox, clause_id, section_path, doc_type, authority_tier,
    effective_date, status, language, source_sha256.
    """
    if not clauses_data:
        return 0

    init_qdrant_collections()
    client = get_qdrant_client()

    texts_to_embed = [c.get("clause_text", "") for c in clauses_data]
    vectors = embed_texts(texts_to_embed)

    points = []
    for c, vec in zip(clauses_data, vectors):
        clause_id = str(c.get("clause_id") or c.get("id") or uuid.uuid4())
        point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, clause_id))

        doc_type = c.get("doc_type") or c.get("document_type") or "OTHER"
        auth_tier = c.get("authority_tier") or get_authority_tier(doc_type)

        payload = {
            "document_id": c.get("document_id"),
            "document_name": c.get("document_name", "Document"),
            "page": c.get("page_number", 1),
            "page_number": c.get("page_number", 1),
            "bbox": c.get("bounding_box"),
            "bounding_box": c.get("bounding_box"),
            "clause_id": clause_id,
            "id": clause_id,
            "clause_number": c.get("clause_number", "N/A"),
            "section_path": c.get("section_title") or "General",
            "section_title": c.get("section_title") or "General",
            "clause_text": c.get("clause_text", ""),
            "doc_type": doc_type,
            "authority_tier": auth_tier,
            "effective_date": str(c.get("effective_from") or ""),
            "status": c.get("status") or "IN_FORCE",
            "language": "en",
            "source_sha256": c.get("source_sha256") or c.get("file_hash") or ""
        }

        points.append(qmodels.PointStruct(
            id=point_id,
            vector=vec,
            payload=payload
        ))

    # Batch upsert in chunks of 64
    batch_size = 64
    for i in range(0, len(points), batch_size):
        batch = points[i : i + batch_size]
        client.upsert(
            collection_name=settings.QDRANT_COLLECTION,
            points=batch
        )

    logger.info(f"Indexed {len(points)} clauses into Qdrant collection '{settings.QDRANT_COLLECTION}'.")
    return len(points)

def search_dense_qdrant(
    query: str,
    top_k: int = 10,
    doc_filter: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """
    Search Qdrant using real BGE-M3 query embeddings.
    Fails loudly if Qdrant or embedding model is unavailable.
    """
    client = get_qdrant_client()
    query_vector = embed_query(query)

    query_filter = None
    if doc_filter:
        query_filter = qmodels.Filter(
            must=[
                qmodels.FieldCondition(
                    key="document_id",
                    match=qmodels.MatchAny(any=doc_filter)
                )
            ]
        )

    try:
        # qdrant-client query_points (modern API) or search (legacy API)
        if hasattr(client, "query_points"):
            response = client.query_points(
                collection_name=settings.QDRANT_COLLECTION,
                query=query_vector,
                query_filter=query_filter,
                limit=top_k
            )
            hits = response.points
        else:
            hits = client.search(
                collection_name=settings.QDRANT_COLLECTION,
                query_vector=query_vector,
                query_filter=query_filter,
                limit=top_k
            )

        results = []
        for hit in hits:
            record = dict(hit.payload or {})
            record["dense_score"] = float(hit.score)
            record["retrieval_mode"] = "dense-bge-m3"
            results.append(record)
        return results
    except Exception as e:
        logger.error(f"Qdrant dense search failed: {e}")
        raise RuntimeError(f"Dense vector retrieval failed on Qdrant: {e}")
