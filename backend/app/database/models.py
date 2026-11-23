import uuid
from datetime import datetime, date
from typing import Optional, List, Any, Dict
from sqlalchemy import (
    Column,
    String,
    Text,
    Integer,
    Float,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    JSON,
    Index,
    Enum as SQLEnum
)
from sqlalchemy.orm import relationship
from app.database.session import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    file_hash = Column(String(64), nullable=False, unique=True, index=True)
    file_path = Column(String(512), nullable=False)
    document_type = Column(String(64), nullable=False, default="OTHER", index=True)
    domain = Column(String(64), nullable=False, default="RETAIL_LENDING")
    issuer = Column(String(128), nullable=True)
    publication_date = Column(Date, nullable=True)
    effective_from = Column(Date, nullable=True)
    effective_to = Column(Date, nullable=True)
    version = Column(String(32), nullable=True, default="1.0")
    status = Column(String(32), nullable=False, default="UPLOADED", index=True) # UPLOADED, PROCESSING, PROCESSED, FAILED
    doc_status = Column(String(32), nullable=False, default="IN_FORCE", index=True) # IN_FORCE, SUPERSEDED, WITHDRAWN, DRAFT
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    pages = relationship("Page", back_populates="document", cascade="all, delete-orphan", order_by="Page.page_number")
    clauses = relationship("Clause", back_populates="document", cascade="all, delete-orphan")
    jobs = relationship("IngestionJob", back_populates="document", cascade="all, delete-orphan")

class Page(Base):
    __tablename__ = "pages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    page_number = Column(Integer, nullable=False)
    extracted_text = Column(Text, nullable=False, default="")
    rendered_image_path = Column(String(512), nullable=True)
    extraction_confidence = Column(Float, nullable=False, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    document = relationship("Document", back_populates="pages")
    clauses = relationship("Clause", back_populates="page", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_pages_doc_page", "document_id", "page_number", unique=True),
    )

class Clause(Base):
    __tablename__ = "clauses"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    page_id = Column(String(36), ForeignKey("pages.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_clause_id = Column(String(36), ForeignKey("clauses.id", ondelete="SET NULL"), nullable=True, index=True)
    clause_number = Column(String(64), nullable=True, index=True)
    section_title = Column(String(255), nullable=True)
    clause_text = Column(Text, nullable=False)
    subject = Column(String(128), nullable=True, index=True)
    attribute = Column(String(128), nullable=True, index=True)
    scope = Column(String(128), nullable=True)
    effective_from = Column(Date, nullable=True)
    effective_to = Column(Date, nullable=True)
    bounding_box = Column(JSON, nullable=True)  # [x0, y0, x1, y1] or polygon
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    document = relationship("Document", back_populates="clauses")
    page = relationship("Page", back_populates="clauses")
    rule_facts = relationship("RuleFact", back_populates="clause", cascade="all, delete-orphan")
    citations = relationship("Citation", back_populates="clause")

class RuleFact(Base):
    __tablename__ = "rule_facts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    clause_id = Column(String(36), ForeignKey("clauses.id", ondelete="CASCADE"), nullable=False, index=True)
    subject = Column(String(128), nullable=False, index=True)
    attribute = Column(String(128), nullable=False, index=True)
    operator = Column(String(32), nullable=True, default="EQUALS")
    value = Column(String(255), nullable=False)
    unit = Column(String(64), nullable=True)
    condition = Column(Text, nullable=True)
    extraction_status = Column(String(32), nullable=False, default="CANDIDATE") # CANDIDATE, VERIFIED, REJECTED
    verified_by_human = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    clause = relationship("Clause", back_populates="rule_facts")

class AmendmentEdge(Base):
    __tablename__ = "amendment_edges"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    source_clause_id = Column(String(36), ForeignKey("clauses.id", ondelete="CASCADE"), nullable=False, index=True) # New clause
    target_clause_id = Column(String(36), ForeignKey("clauses.id", ondelete="CASCADE"), nullable=False, index=True) # Old/amended clause
    relationship_type = Column(String(64), nullable=False, default="AMENDS") # AMENDS, SUPERSEDES, MODIFIES, REPLACES
    old_value = Column(String(255), nullable=True)
    new_value = Column(String(255), nullable=True)
    effective_date = Column(Date, nullable=True)
    verification_status = Column(String(32), nullable=False, default="UNVERIFIED") # UNVERIFIED, VERIFIED, CONTESTED
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Foreign key references
    source_clause = relationship("Clause", foreign_keys=[source_clause_id])
    target_clause = relationship("Clause", foreign_keys=[target_clause_id])

class Conflict(Base):
    __tablename__ = "conflicts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    clause_a_id = Column(String(36), ForeignKey("clauses.id", ondelete="CASCADE"), nullable=False, index=True)
    clause_b_id = Column(String(36), ForeignKey("clauses.id", ondelete="CASCADE"), nullable=False, index=True)
    conflict_type = Column(String(64), nullable=False, default="POSSIBLE_CONFLICT")
    # Types: CONFIRMED_CONFLICT, POSSIBLE_CONFLICT, SUPERSEDED, TEMPORAL_DIFFERENCE, CONDITIONAL_DIFFERENCE, NO_CONFLICT
    severity = Column(String(32), nullable=False, default="MEDIUM") # LOW, MEDIUM, HIGH, CRITICAL
    scope_overlap = Column(Boolean, default=True, nullable=False)
    temporal_overlap = Column(Boolean, default=True, nullable=False)
    resolution_status = Column(String(32), nullable=False, default="PENDING_REVIEW") # PENDING_REVIEW, RESOLVED_AMENDMENT, RESOLVED_SCOPE, DISMISSED, AUTO_RESOLVED
    resolution_notes = Column(Text, nullable=True)
    subject = Column(String(128), nullable=True, index=True)
    value_a = Column(String(255), nullable=True)
    value_b = Column(String(255), nullable=True)
    linked_document_id = Column(String(36), nullable=True)
    linked_document_name = Column(String(255), nullable=True)
    history = Column(Text, nullable=True, default="[]") # JSON string of review audit log
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    clause_a = relationship("Clause", foreign_keys=[clause_a_id])
    clause_b = relationship("Clause", foreign_keys=[clause_b_id])

class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(32), nullable=False, default="QUEUED") # QUEUED, PROCESSING, COMPLETED, FAILED
    progress = Column(Float, nullable=False, default=0.0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    document = relationship("Document", back_populates="jobs")

class QASession(Base):
    __tablename__ = "qa_sessions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    query_text = Column(Text, nullable=False)
    answer_text = Column(Text, nullable=False)
    status = Column(String(32), nullable=False, default="VERIFIED") # VERIFIED, PARTIALLY_VERIFIED, CONFLICTED, INSUFFICIENT_EVIDENCE
    faithfulness_score = Column(Float, nullable=False, default=0.0) # 0 to 100
    as_of_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    claims = relationship("Claim", back_populates="session", cascade="all, delete-orphan")

class Claim(Base):
    __tablename__ = "claims"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(String(36), ForeignKey("qa_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    claim_text = Column(Text, nullable=False)
    verification_status = Column(String(32), nullable=False, default="VERIFIED") # VERIFIED, UNSUPPORTED, CONTRADICTED
    verification_score = Column(Float, nullable=False, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    session = relationship("QASession", back_populates="claims")
    citations = relationship("Citation", back_populates="claim", cascade="all, delete-orphan")

class Citation(Base):
    __tablename__ = "citations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    claim_id = Column(String(36), ForeignKey("claims.id", ondelete="CASCADE"), nullable=False, index=True)
    clause_id = Column(String(36), ForeignKey("clauses.id", ondelete="CASCADE"), nullable=False, index=True)
    page_number = Column(Integer, nullable=False)
    exact_quote = Column(Text, nullable=False)
    quote_hash = Column(String(64), nullable=False, index=True)
    bounding_box = Column(JSON, nullable=True)
    support_status = Column(String(32), nullable=False, default="FULL_SUPPORT") # FULL_SUPPORT, PARTIAL_SUPPORT, UNSUPPORTED
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    claim = relationship("Claim", back_populates="citations")
    clause = relationship("Clause", back_populates="citations")
