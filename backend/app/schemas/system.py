from typing import Optional, Dict, Any, List
from pydantic import BaseModel

class HealthResponse(BaseModel):
    status: str = "healthy"
    version: str
    environment: str
    database: str
    vector_store: str
    storage_writable: bool
    llm: Optional[Dict[str, Any]] = None

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
