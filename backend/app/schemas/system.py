from typing import Optional, Dict, Any, List
from pydantic import BaseModel

class HealthResponse(BaseModel):
    status: str = "healthy"
    degraded: bool = False
    version: str
    environment: str
    database: str
    vector_store: str
    storage_writable: bool
    bge_m3: Optional[Dict[str, Any]] = None
    nli_verifier: Optional[Dict[str, Any]] = None
    tesseract: Optional[Dict[str, Any]] = None
    llm: Optional[Dict[str, Any]] = None
    fallback_modes: List[str] = []

class LLMHealthResponse(BaseModel):
    provider: str
    model: str
    base_url: str
    api_key_configured: bool
    api_key_status: str
    status: str
    details: str
    reachable: Optional[bool] = None

class AnalyticsResponse(BaseModel):
    total_documents: int
    processed_documents: int
    extracted_clauses: int
    active_amendments: int
    detected_conflicts: int
    pending_reviews: int
    recent_activity: List[Dict[str, Any]] = []
