from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.document import ClauseResponse

class ConflictResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    clause_a_id: str
    clause_b_id: str
    clause_a: Optional[ClauseResponse] = None
    clause_b: Optional[ClauseResponse] = None
    conflict_type: str
    severity: str
    scope_overlap: bool = True
    temporal_overlap: bool = True
    resolution_status: str
    resolution_notes: Optional[str] = None
    created_at: datetime

class ConflictReviewRequest(BaseModel):
    resolution_status: str = Field(..., description="RESOLVED_AMENDMENT, RESOLVED_SCOPE, or DISMISSED")
    resolution_notes: str = Field(..., description="Reviewer explanation and justification")

class ConflictListResponse(BaseModel):
    total: int
    conflicts: List[ConflictResponse]
