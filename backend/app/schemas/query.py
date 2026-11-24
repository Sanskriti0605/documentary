from datetime import datetime, date
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field, ConfigDict

class CitationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    claim_id: str
    clause_id: str
    page_number: int
    document_id: Optional[str] = None
    document_name: Optional[str] = None
    clause_number: Optional[str] = None
    section_title: Optional[str] = None
    exact_quote: str
    quote_hash: str
    bounding_box: Optional[List[float]] = None
    support_status: str = "FULL_SUPPORT"

class ClaimResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    claim_text: str
    verification_status: str
    verification_score: float
    citations: List[CitationResponse] = []

class QueryRequest(BaseModel):
    query: str = Field(..., description="The user question to be answered with evidence")
    document_ids: Optional[List[str]] = Field(default=None, description="Optional filter of document IDs to query against")
    as_of_date: Optional[Any] = Field(default=None, description="Temporal reference date for rule applicability")
    as_of: Optional[Any] = Field(default=None, description="Alternative alias for as_of_date")

class QueryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    query: str
    answer: str
    status: str
    faithfulness_score: float
    as_of_date: Optional[date] = None
    claims: List[ClaimResponse] = []
    version_chain: Optional[List[Dict[str, Any]]] = None
    created_at: datetime

class EvidenceDetailResponse(BaseModel):
    session_id: str
    total_claims: int
    verified_claims: int
    unsupported_claims: int
    conflicted_claims: int
    faithfulness_score: float
    citations: List[CitationResponse] = []
