import asyncio
import os
import hashlib
from app.database.session import AsyncSessionLocal
from app.database.models import Document, IngestionJob
from app.ingestion.pipeline import run_document_ingestion_pipeline
from app.database.init_db import init_db

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "storage", "uploads")

async def seed_documents():
    await init_db()
    async with AsyncSessionLocal() as db:
        if not os.path.exists(UPLOADS_DIR):
            print("Uploads directory not found.")
            return

        pdf_files = [f for f in os.listdir(UPLOADS_DIR) if f.endswith(".pdf")]
        print(f"Found {len(pdf_files)} PDF files to seed...")

        for filename in pdf_files:
            file_path = os.path.join(UPLOADS_DIR, filename)
            with open(file_path, "rb") as f:
                content = f.read()
            file_hash = hashlib.sha256(content).hexdigest()

            doc = Document(
                name=filename,
                file_hash=file_hash,
                file_path=file_path,
                document_type="OTHER",
                domain="RETAIL_LENDING",
                status="PROCESSING"
            )
            db.add(doc)
            await db.flush()

            job = IngestionJob(document_id=doc.id, status="PROCESSING", progress=0.1)
            db.add(job)
            await db.commit()

            print(f"Ingesting {filename} (id={doc.id})...")
            try:
                res = await run_document_ingestion_pipeline(doc.id, db)
                print(f"  -> Success: {res['pages_processed']} pages, {res['clauses_segmented']} clauses.")
            except Exception as e:
                print(f"  -> Error: {e}")

    print("Seeding completed successfully.")

if __name__ == "__main__":
    asyncio.run(seed_documents())
