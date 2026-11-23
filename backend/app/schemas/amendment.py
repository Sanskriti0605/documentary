from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

class ApplicabilityConditions(BaseModel):
    sanction_date: Optional[str] = None
    lender_type: Optional[str] = None
    scope: Optional[str] = None
    notes: Optional[str] = None

class VersionInForceItem(BaseModel):
    document_id: str
    document_name: str
    document_type: str
    clause_id: Optional[str] = None
    clause_number: Optional[str] = None
    effective_from: Optional[str] = None
    effective_to: Optional[str] = None
    status: str = Field(..., description="IN_FORCE, FUTURE_EFFECTIVE, DRAFT_NON_BINDING, SUPERSEDED, WITHDRAWN")
    value: Optional[str] = None
    quote: str
    amending_quote: Optional[str] = None
    is_partial_amendment: bool = False
    inherited_from_document: Optional[str] = None
    applicability_conditions: Optional[ApplicabilityConditions] = None

class ChainVersionItem(BaseModel):
    id: str
    document_id: str
    document_name: str
    document_type: str
    clause_id: Optional[str] = None
    clause_number: Optional[str] = None
    publication_date: Optional[str] = None
    effective_from: Optional[str] = None
    effective_to: Optional[str] = None
    status: str = Field(..., description="IN_FORCE, FUTURE_EFFECTIVE, DRAFT_NON_BINDING, SUPERSEDED, WITHDRAWN")
    relationship_to_prior: Optional[str] = None
    quote: str
    amending_quote: Optional[str] = None
    is_partial_amendment: bool = False
    applicability_conditions: Optional[ApplicabilityConditions] = None

class AmendmentGraphNode(BaseModel):
    id: str
    label: str
    document_name: str
    document_type: str
    clause_number: Optional[str] = None
    section_title: Optional[str] = None
    clause_text: str
    effective_from: Optional[Any] = None
    effective_to: Optional[Any] = None
    status: Optional[str] = "IN_FORCE"

class AmendmentGraphEdge(BaseModel):
    id: str
    source: str
    target: str
    relationship: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    effective_date: Optional[str] = None

class AmendmentGraphResponse(BaseModel):
    nodes: List[AmendmentGraphNode]
    edges: List[AmendmentGraphEdge]

class TimelineItemResponse(BaseModel):
    date: Optional[str]
    event_type: str
    document_name: str
    clause_number: Optional[str] = None
    description: str
    clause_id: str
    status: Optional[str] = None
    quote: Optional[str] = None

class AmendmentResolutionResponse(BaseModel):
    rule: str
    as_of: str
    version_in_force: Optional[VersionInForceItem] = None
    chain: List[ChainVersionItem]
    nodes: List[AmendmentGraphNode]
    edges: List[AmendmentGraphEdge]
    timeline: List[TimelineItemResponse]
    available_rules: List[Dict[str, str]]
