from datetime import datetime, date
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, ConfigDict

class PageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    page_number: int
    extracted_text: str
    rendered_image_path: Optional[str] = None
    extraction_confidence: float = 1.0

class ClauseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_id: str
    page_id: str
    parent_clause_id: Optional[str] = None
    clause_number: Optional[str] = None
    section_title: Optional[str] = None
    clause_text: str
    subject: Optional[str] = None
    attribute: Optional[str] = None
    scope: Optional[str] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    bounding_box: Optional[List[float]] = None
    page_number: Optional[int] = 1

class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    file_hash: str
    document_type: str
    domain: str
    issuer: Optional[str] = None
    publication_date: Optional[date] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    version: Optional[str] = "1.0"
    status: str
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    page_count: Optional[int] = 0
    clause_count: Optional[int] = 0

class DocumentListResponse(BaseModel):
    total: int
    documents: List[DocumentResponse]

class IngestionJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_id: str
    status: str
    progress: float
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
