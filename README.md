# VerifyDoc — Verifiable Document AI for Indian Banking

**VerifyDoc** is an open-source, evidence-first Document Intelligence platform engineered for Indian banking, compliance, and retail lending documents (Loan Agreements, Key Facts Statements [KFS], Schedule of Charges, and RBI Circulars).

The foundational principle of VerifyDoc is:
> **NO EVIDENCE = NO ANSWER.**  
> Every single factual claim must carry an authentic document name, page number, and verbatim quote. If proof is missing or contradicted, the system strictly abstains and explains exactly what evidence is missing.

---

## 1. Architectural Verification Pipeline

```mermaid
flowchart TD
    A["PDF Ingestion (PyMuPDF + pdfplumber)"] --> B["Span Extraction (doc, page, bbox) & Structured Tables"]
    B --> C["Metadata & Amendment Signals ('in partial modification of', 'w.e.f.')"]
    C --> D["Database (SQLite / SQLAlchemy) & Vector Store"]
    
    E["User Query (English / Hindi)"] --> F["Query Decomposition & Temporal Resolution"]
    F --> G["Multi-Document Hybrid Retrieval"]
    G --> H["BM25 (rank_bm25 v0.2.2) + Dense Overlap"]
    H --> I["Reciprocal Rank Fusion (RRF, k=60) & Context Expansion"]
    
    I --> J["Evidence-Constrained Generation (Local Ollama / Fallback)"]
    J --> K["Structured JSON: {claims: [{text, quote_ids}]}"]
    
    K --> L{"3-Point Verification Gate"}
    L -- "Gate 1: Verbatim Substring" --> M{"Pass?"}
    L -- "Gate 2: Numbers, Pct, Dates Regex" --> M
    L -- "Gate 3: DeBERTa-v3 Cross-Encoder NLI" --> M
    
    M -- "ALL CHECKS PASSED" --> N["Verified Claim + Citation Chip + Verifier Label"]
    M -- "ANY CHECK FAILED" --> O["BLOCKED CLAIM + Explicit Missing Evidence Notice"]
    
    N --> P["Faithfulness Score Meter (N generated, M blocked)"]
    O --> P
    P --> Q["Interactive UI (Answer, BBox Highlighting, Calculations)"]
```

---

## 2. Component Implementation & Runtime Specifications

| Component | Technology & Model | Version | Mode | Fallback Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Parsing** | `PyMuPDF` (`fitz`) + `pdfplumber` | `1.23.26` / `0.11.0` | **Real** | Extracts text spans with pixel bounding boxes `[x0, y0, x1, y1]`, tables as structured rows |
| **Keyword Search** | `BM25Okapi` (`rank-bm25`) | `0.2.2` | **Real** | Sparse lexical keyword scoring on tokenized clause corpus |
| **Dense Retrieval** | Dense Token Intersect / `Qdrant` | `qdrant-client 1.8.0` | **Hybrid** | In-memory token overlap merged via Reciprocal Rank Fusion ($k=60$) |
| **Generation** | Ollama (`qwen2.5:1.5b` / `qwen2.5:7b`) | `0.3.x` | **Real** | When Ollama is offline, switches to deterministic extractive grounding and labels `is_fallback: true` |
| **NLI Verification Gate** | `cross-encoder/nli-deberta-v3-small` | Hugging Face Hub | **Real** | Evaluates premise-hypothesis entailment; reports active verifier and probabilities per claim |
| **Calculations** | Python `decimal.Decimal` | PSF | **Real** | Deterministic reducing-balance EMI, RBI non-capitalized penal charges, and fees + 18% GST |
| **PDF Rendering** | `PyMuPDF` | `1.23.26` | **Real** | Dynamic high-res PNG page rendering with semi-transparent yellow highlight overlays |
| **Backend** | `FastAPI`, `SQLAlchemy`, `aiosqlite` | `0.110.0` / `2.0.28` | **Real** | Async REST APIs, database persistence, planted-trap test runner |
| **Frontend** | React 18, `Vite`, `Tailwind CSS`, `@xyflow/react` | `18.2` / `6.4.6` | **Real** | Dashboard, Library, Ask VerifyDoc, Contradictions, Amendments, PDF Viewer, Evaluation |

---

## 3. Planted-Trap Evaluation Benchmarks (`GET /eval/run`)

VerifyDoc includes a synthetic Indian banking test suite (`datasets/benchmark/test_questions.json`) targeting 5 planted edge-case traps across **Bharat National Bank (BNB)** policies:

| Test ID | Category | Planted Trap Description | Expected Behavior | VerifyDoc Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **TC_01** | `SPLIT_PAGE_STITCHING` | Prepayment condition begins on Page 1 and concludes with `3.0%` fee on Page 2 | Multi-page clause stitching across page boundaries | **PASSED (100% verified)** |
| **TC_02** | `CONTRADICTION_DETECTION` | Loan Agreement specifies `12.5%` ROI while Sanction Letter specifies `11.0%` | Flag `CONFIRMED_CONFLICT` with side-by-side quotes | **PASSED (Detected)** |
| **TC_03** | `AMENDMENT_TRACKING` | 3-step amendment chain: 2023 (`2.0%`) $\to$ 2024 RBI cap (`2.5%`) $\to$ 2025 (`1.75%`) | Traverse graph and return `1.75%` as active version today | **PASSED (Resolved)** |
| **TC_04** | `EVIDENCE_ABSTENTION` | Question asks about agricultural tractor loan subsidy (absent from retail docs) | Enforce strict abstention: `INSUFFICIENT_EVIDENCE` | **PASSED (Abstained)** |
| **TC_05** | `FINANCIAL_CALCULATION` | Compute 1.5% fee on Rs. 500,000 + 18% GST from Schedule of Charges | Python Decimal math: Rs. 7,500 + Rs. 1,350 = Rs. 8,850 | **PASSED (Deterministic)** |

**Benchmark Accuracy:** `100.0% (5/5 Passed)`

---

## 4. Quickstart Guide

### Option A: Docker Compose (Zero-Config from Clean Clone)

Run the entire stack with Ollama, automated model pre-download, database initialization, backend, and frontend:

```bash
# Clone the repository
git clone https://github.com/Sanskriti0605/documentary.git
cd documentary

# Start all services with automated seeding and model download
docker compose up --build
```

* **Web UI:** `http://localhost:5173`
* **FastAPI Docs:** `http://localhost:8001/docs`
* **Ollama Service:** `http://localhost:11434`

---

### Option B: Native Local Setup

#### 1. Backend Setup
```bash
# Clone and enter repo
git clone https://github.com/Sanskriti0605/documentary.git
cd documentary

# Create virtual environment and install dependencies
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

# Seed the synthetic Indian banking documents
python datasets/synthetic/generator.py
PYTHONPATH=backend python scripts/seed_synthetic_docs.py

# Start the FastAPI backend server
PYTHONPATH=backend uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```
Interactive API docs: `http://localhost:8001/docs`

#### 2. Frontend Setup
```bash
# In another terminal:
cd frontend
npm install
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## 5. REST API Reference

- `POST /documents/upload`: Upload PDF documents with automatic parsing, bounding box extraction, and table detection.
- `GET /documents`: List ingested documents with page counts, clause counts, and processing status.
- `POST /ask`: Execute evidence-constrained question answering with verification gating, faithfulness scores, and model provenance (`generation_provider`, `is_fallback`, `verifier`).
- `GET /conflicts`: List detected contradictory clauses across documents with side-by-side quotes.
- `POST /conflicts/{id}/review`: Review and reconcile conflicts (`RESOLVED_AMENDMENT`, `RESOLVED_SCOPE`, `DISMISSED`).
- `GET /amendments/graph`: Return directed amendment relationship graph (`@xyflow/react` compatible).
- `GET /amendments/timeline`: Return chronological policy amendment events.
- `GET /pdf/{doc}/page/{n}`: Render high-resolution PNG page image with optional passage highlight (`?bbox=x0,y0,x1,y1`).
- `GET /eval/run`: Run automated evaluation benchmark against planted-trap scenarios.
