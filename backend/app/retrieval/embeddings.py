import logging
from typing import List, Dict, Any, Optional
import numpy as np

logger = logging.getLogger("veritas.retrieval.embeddings")

_embedding_model = None
_model_name = "BAAI/bge-m3"
_load_attempted = False

def get_embedding_model():
    """Lazy loader for BAAI/bge-m3 embedding model."""
    global _embedding_model, _load_attempted
    if _embedding_model is not None:
        return _embedding_model
    if _load_attempted:
        return None

    _load_attempted = True
    try:
        from sentence_transformers import SentenceTransformer
        # Try local cache first to avoid network calls
        try:
            _embedding_model = SentenceTransformer(_model_name, local_files_only=True)
            logger.info(f"Loaded cached BGE-M3 model '{_model_name}' successfully.")
        except Exception:
            _embedding_model = SentenceTransformer(_model_name)
            logger.info(f"Loaded BGE-M3 model '{_model_name}'.")
        return _embedding_model
    except Exception as e:
        logger.error(f"Failed to load BGE-M3 embedding model '{_model_name}': {e}")
        _embedding_model = None
        return None

def embed_texts(texts: List[str]) -> List[List[float]]:
    """Generate 1024-dimensional normalized dense vectors for a batch of texts."""
    model = get_embedding_model()
    if model is None:
        raise RuntimeError("BGE-M3 embedding model is unavailable. Real dense embeddings required.")
    
    if not texts:
        return []
        
    embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    if isinstance(embeddings, np.ndarray):
        return embeddings.tolist()
    return [list(map(float, e)) for e in embeddings]

def embed_query(query: str) -> List[float]:
    """Generate 1024-dimensional normalized dense vector for a query string."""
    results = embed_texts([query])
    if not results:
        raise RuntimeError("Empty embedding returned for query.")
    return results[0]

def check_embedding_health() -> Dict[str, Any]:
    """Report real status of BGE-M3 model."""
    model = get_embedding_model()
    if model is not None:
        return {
            "status": "ready",
            "model": _model_name,
            "dimension": 1024,
            "is_real": True
        }
    return {
        "status": "unavailable",
        "model": _model_name,
        "dimension": 1024,
        "is_real": False,
        "error": "Model weights not found or failed to initialize."
    }
