import os
from typing import Optional
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from app.core.config import settings

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

def init_qdrant_collections(vector_size: int = 1024):
    """Ensure the target collection exists with Cosine distance metric."""
    client = get_qdrant_client()
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
    return True

if __name__ == "__main__":
    init_qdrant_collections()
    print(f"Qdrant collection '{settings.QDRANT_COLLECTION}' verified.")
