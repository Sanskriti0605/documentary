from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.document import ClauseResponse

class ConflictHistoryItem(BaseModel):
    timestamp: str
    action: str
    previous_status: str
    new_status: str
    notes: str
    linked_document_id: Optional[str] = None
    linked_document_name: Optional[str] = None

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
    subject: Optional[str] = None
    value_a: Optional[str] = None
    value_b: Optional[str] = None
    linked_document_id: Optional[str] = None
    linked_document_name: Optional[str] = None
    history: List[ConflictHistoryItem] = Field(default_factory=list)
    created_at: datetime
    updated_at: Optional[datetime] = None

    # Enriched convenience fields
    doc_a_name: Optional[str] = None
    doc_b_name: Optional[str] = None
    clause_a_number: Optional[str] = None
    clause_b_number: Optional[str] = None
    quote_a: Optional[str] = None
    quote_b: Optional[str] = None

class ConflictPatchRequest(BaseModel):
    resolution_status: str = Field(..., description="RESOLVED_AMENDMENT, RESOLVED_SCOPE, DISMISSED, or PENDING_REVIEW")
    resolution_notes: str = Field(..., min_length=3, description="Reviewer justification note")
    linked_document_id: Optional[str] = None
    linked_document_name: Optional[str] = None

class ConflictReviewRequest(ConflictPatchRequest):
    """Backward compatibility alias for review requests."""
    pass

class ConflictSummaryStats(BaseModel):
    total: int
    pending_review: int
    confirmed_conflicts: int
    auto_resolved: int
    resolved_by_reviewer: int

class ConflictListResponse(BaseModel):
    total: int
    conflicts: List[ConflictResponse]
    summary: Optional[ConflictSummaryStats] = None

class ConflictScanResponse(BaseModel):
    scanned_clauses: int
    new_conflicts: int
    auto_resolved: int
    existing_conflicts: int
    total_conflicts: int
    message: str
