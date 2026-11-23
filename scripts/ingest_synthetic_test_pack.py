#!/usr/bin/env python3
"""
Ingest all synthetic test documents (SYN_01 to SYN_17, SYN_19 to SYN_28)
via the normal upload API endpoint: POST /api/v1/documents/upload.
Strictly excludes SYN_18 per test plan (SYN_18 is reserved for Phase 5 impact analysis).
"""

import os
import sys
import glob
import asyncio
import httpx

API_BASE = os.getenv("API_BASE", "http://127.0.0.1:8001")
UPLOAD_URL = f"{API_BASE}/api/v1/documents/upload"
TEST_DOCS_DIR = os.path.join(os.path.dirname(__file__), "..", "datasets", "test_pack", "test_documents")

async def upload_document(client: httpx.AsyncClient, file_path: str):
    filename = os.path.basename(file_path)
    if "SYN_18" in filename:
        print(f"[SKIP] {filename} is reserved for Phase 5 impact analysis.")
        return None

    print(f"[UPLOADING] {filename}...")
    with open(file_path, "rb") as f:
        file_bytes = f.read()

    files = {"file": (filename, file_bytes, "application/pdf")}
    data = {
        "document_type": "OTHER",
        "domain": "RETAIL_LENDING",
        "issuer": "Bharat National Bank" if "Bank" in filename else "Reserve Bank of India"
    }

    try:
        response = await client.post(UPLOAD_URL, files=files, data=data, timeout=120.0)
        if response.status_code in (200, 201):
            res_json = response.json()
            doc_id = res_json.get("id")
            doc_status = res_json.get("status")
            print(f"  [✓] {filename} -> ID: {doc_id} | Status: {doc_status}")
            return res_json
        else:
            print(f"  [✗] Failed {filename}: HTTP {response.status_code} - {response.text[:200]}")
            return None
    except Exception as e:
        print(f"  [✗] Error uploading {filename}: {e}")
        return None

async def main():
    abs_dir = os.path.abspath(TEST_DOCS_DIR)
    if not os.path.exists(abs_dir):
        print(f"Error: Directory {abs_dir} does not exist.")
        sys.exit(1)

    pdf_files = sorted(glob.glob(os.path.join(abs_dir, "SYN_*.pdf")))
    print(f"Found {len(pdf_files)} synthetic PDF files in {abs_dir}.")

    # Filter out SYN_18
    target_files = [f for f in pdf_files if "SYN_18" not in os.path.basename(f)]
    print(f"Queued {len(target_files)} synthetic files for upload (excluding SYN_18)...")

    async with httpx.AsyncClient() as client:
        # Check health first
        health_resp = await client.get(f"{API_BASE}/health", timeout=15.0)
        print("Health Check:", health_resp.json().get("status"), "| Degraded:", health_resp.json().get("degraded"))

        for fpath in target_files:
            await upload_document(client, fpath)

    # Trigger reindex to ensure all new clauses have BGE-M3 vectors in Qdrant
    print("\nTriggering vector store reindex...")
    async with httpx.AsyncClient() as client:
        reindex_resp = await client.post(f"{API_BASE}/reindex", timeout=120.0)
        print("Reindex result:", reindex_resp.json())

    print("\nAll synthetic test documents ingested successfully.")

if __name__ == "__main__":
    asyncio.run(main())
