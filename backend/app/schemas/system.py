from typing import Optional, Dict, Any, List
from pydantic import BaseModel

class HealthResponse(BaseModel):
    status: str = "healthy"
    version: str
    environment: str
    database: str
    vector_store: str
    storage_writable: bool

class AnalyticsResponse(BaseModel):
    total_documents: int
    processed_documents: int
    extracted_clauses: int
    active_amendments: int
    detected_conflicts: int
    pending_reviews: int
    recent_activity: List[Dict[str, Any]] = []
