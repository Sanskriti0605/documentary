from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.document import ClauseResponse

class AmendmentEdgeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    source_clause_id: str
    target_clause_id: str
    relationship_type: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    effective_date: Optional[date] = None
    verification_status: str = "UNVERIFIED"
    created_at: datetime

class AmendmentGraphNode(BaseModel):
    id: str
    label: str
    document_name: str
    document_type: str
    clause_number: Optional[str] = None
    section_title: Optional[str] = None
    clause_text: str
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None

class AmendmentGraphEdge(BaseModel):
    id: str
    source: str
    target: str
    relationship: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    effective_date: Optional[date] = None

class AmendmentGraphResponse(BaseModel):
    nodes: List[AmendmentGraphNode]
    edges: List[AmendmentGraphEdge]

class TimelineItemResponse(BaseModel):
    date: Optional[date]
    event_type: str
    document_name: str
    clause_number: Optional[str] = None
    description: str
    clause_id: str
