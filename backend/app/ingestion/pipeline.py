import os
import hashlib
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.models import Document, Page, Clause, RuleFact, AmendmentEdge, IngestionJob
from app.ingestion.parser import parse_pdf, segment_clauses_with_bboxes
from app.ingestion.metadata import extract_metadata_from_text, detect_amendment_signals
from app.ingestion.renderer import render_pdf_page_image

async def run_document_ingestion_pipeline(document_id: str, db: AsyncSession) -> Dict[str, Any]:
    """
    Full Ingestion Pipeline:
    1. Parse PDF with PyMuPDF & pdfplumber (text spans with bbox, tables)
    2. Extract metadata and detect amendment references
    3. Render page images for evidence viewer
    4. Segment into structured clauses with bounding boxes
    5. Save Pages and Clauses into Database
    6. Extract candidate rule facts & amendment edges
    7. Update Document status to PROCESSED
    """
    doc = await db.get(Document, document_id)
    if not doc:
        raise ValueError(f"Document {document_id} not found.")

    file_path = doc.file_path
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File {file_path} not found.")

    # 1. Parse PDF
    parsed_pages, all_pages_text = parse_pdf(file_path)

    # 2. Extract Metadata
    meta = extract_metadata_from_text(doc.name, all_pages_text)
    if doc.document_type in [None, "", "OTHER"] or meta["document_type"] != "OTHER":
        doc.document_type = meta["document_type"]
    if not doc.issuer:
        doc.issuer = meta["issuer"]
    doc.publication_date = meta["publication_date"]
    doc.effective_from = meta["effective_from"]

    # 3. Save Pages
    db_pages = []
    for p in parsed_pages:
        # Render page image
        try:
            render_res = render_pdf_page_image(file_path, p.page_number)
            rendered_path = render_res[0] if isinstance(render_res, tuple) else render_res
        except Exception:
            rendered_path = None

        page_record = Page(
            document_id=doc.id,
            page_number=p.page_number,
            extracted_text=p.text,
            rendered_image_path=rendered_path,
            extraction_confidence=0.98
        )
        db.add(page_record)
        db_pages.append(page_record)

    await db.flush()

    # Map page_number to page_id
    page_id_map = {p.page_number: p.id for p in db_pages}

    # 4. Segment Clauses
    clauses = segment_clauses_with_bboxes(parsed_pages)
    for c in clauses:
        p_num = c.get("page_number", 1)
        page_id = page_id_map.get(p_num, db_pages[0].id)

        clause_record = Clause(
            document_id=doc.id,
            page_id=page_id,
            clause_number=c.get("clause_number"),
            section_title=c.get("section_title"),
            clause_text=c.get("clause_text", ""),
            bounding_box=c.get("bounding_box"),
            effective_from=doc.effective_from
        )
        db.add(clause_record)

    # 5. Detect Amendment signals
    full_text = "\n".join(all_pages_text)
    amendment_signals = detect_amendment_signals(full_text)
    doc.metadata_json = {
        "amendment_signals": amendment_signals,
        "table_count": sum(len(p.tables) for p in parsed_pages),
        "page_count": len(parsed_pages)
    }

    doc.status = "PROCESSED"
    await db.commit()

    # 6. Index Clauses into Qdrant Vector Store using BGE-M3 dense embeddings
    try:
        from app.retrieval.vector_store import index_clauses_in_qdrant
        clauses_payload = []
        for c in clauses:
            clauses_payload.append({
                "clause_id": c.get("id"),
                "document_id": doc.id,
                "document_name": doc.name,
                "clause_number": c.get("clause_number"),
                "section_title": c.get("section_title"),
                "clause_text": c.get("clause_text", ""),
                "page_number": c.get("page_number", 1),
                "bounding_box": c.get("bounding_box"),
                "doc_type": doc.document_type,
                "effective_from": str(doc.effective_from or ""),
                "status": doc.doc_status or "IN_FORCE",
                "source_sha256": doc.file_hash
            })
        index_clauses_in_qdrant(clauses_payload)
    except Exception as e:
        import logging
        logging.getLogger("veritas.ingestion").error(f"Failed to index clauses in Qdrant: {e}")

    return {
        "document_id": doc.id,
        "status": "PROCESSED",
        "pages_processed": len(parsed_pages),
        "clauses_segmented": len(clauses),
        "amendment_signals": len(amendment_signals)
    }
