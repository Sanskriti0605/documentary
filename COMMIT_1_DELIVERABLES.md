# VerifyDoc — Milestone Commit 1 Deliverables Summary

This document records all features, pipelines, tests, and deliverables completed in **Commit 1**.

---

## 1. Core Architecture & Verification Gate
- **Central Principle:** "NO EVIDENCE = NO ANSWER" — Every single factual statement is tied to a verified document quote, page number, and bounding box.
- **3-Point Verification Gate (`backend/app/verification/gate.py`):**
  1. **Verbatim Substring Check:** Checks that the cited quotation is an exact substring of the extracted page text (whitespace-normalized).
  2. **Numerical & Temporal Consistency Check:** Deterministic regex check ensuring every number, percentage, and date in the claim exists in the cited quote.
  3. **NLI Entailment Scoring:** Evaluates natural language inference entailment between quotation and claim.
- **Strict Abstention & Blocking:** Unverified claims are blocked and replaced with an explicit explanation of what was searched and what evidence is missing.
- **Faithfulness Score Meter:** Computes faithfulness percentage `(verified_claims / total_claims) * 100` and displays `N generated, M blocked`.

---

## 2. Ingestion & Document Intelligence (`backend/app/ingestion/`)
- **Text & Bounding Box Extraction (`parser.py`):** Extracts text spans with exact pixel coordinates `[x0, y0, x1, y1]` using `PyMuPDF` (`fitz`).
- **Structured Table Extraction:** Extracts tables into structured rows and columns using `pdfplumber`.
- **Multi-Page Section Stitching:** Seamlessly stitches clauses and policies that cross page boundaries.
- **Metadata & Amendment Signal Extraction (`metadata.py`):** Extracts dates, issuers, document types, and amendment signals (*"in partial modification of"*, *"shall be substituted"*, *"stands deleted"*, *"w.e.f."*).
- **Page Highlighting Renderer (`renderer.py`):** Renders high-resolution page bitmaps with semi-transparent yellow highlight overlays for citations.

---

## 3. Multi-Document Retrieval (`backend/app/retrieval/hybrid.py`)
- **BM25 Sparse Lexical Search:** Exact banking and legal term retrieval with `rank-bm25`.
- **Dense Vector Search:** Dense embeddings (`BAAI/bge-m3`) supporting English and Hindi.
- **Reciprocal Rank Fusion (RRF):** Merges dense and lexical search rankings with $k=60$.
- **Query Decomposition:** Decomposes complex multi-part questions into targeted sub-queries.
- **Context Expansion:** Dynamically retrieves parent sections and adjacent clauses.

---

## 4. Evidence-Constrained LLM Generation (`backend/app/generation/engine.py`)
- **Schema-Constrained Output:** Constrains the generation model to output strict JSON:
  `{ "claims": [{ "text": "...", "quote_ids": ["..."] }] }`.
- **Local Ollama Integration:** Connects to local models (`qwen2.5:7b`, `llama3.1:8b`) with an extractive grounded fallback.
- **Zero Hallucination Guarantee:** The model is prohibited from inventing document titles, pages, or quotes outside retrieved evidence.

---

## 5. Contradiction Detection & Reconciliations (`backend/app/intelligence/contradictions.py`)
- **Canonical Fact Normalization:** Normalizes extracted clauses into `(subject, attribute, value, unit, condition, scope)`.
- **Synonym Alignment:** Connects related financial terms via `SYNONYM_MAP` (`roi`, `interest_rate`, `penal_rate`, `foreclosure_charges`).
- **Conflict Filtering:** Automatically detects numerical and policy conflicts while excluding cases resolved by amendments.
- **Reviewer Resolution:** Endpoints supporting conflict resolution (`RESOLVED_AMENDMENT`, `RESOLVED_SCOPE`, `DISMISSED`).

---

## 6. Amendment Chains & Timeline (`backend/app/intelligence/amendments.py`)
- **Directed Amendment Graph:** Constructs a `networkx.DiGraph` representing document and clause lineages ($A \to B \to C$).
- **Version-in-Force Resolution:** Resolves the exact active version of a policy or interest rate for any given effective date.
- **Chronological Timeline:** Outputs historical amendment events with effective dates and amending document references.

---

## 7. Deterministic Financial Calculator (`backend/app/calculations/financial.py`)
- **Zero LLM Arithmetic:** LLM extracts parameters only; all arithmetic executes in Python using `decimal.Decimal`.
- **Supported Computations:**
  - Reducing-balance **EMI**.
  - **RBI Non-Capitalized Penal Charges** (charged only on overdue principal/interest, non-compounded, + 18% GST).
  - **Processing Fees** with bounds (min/max caps) and 18% GST.
- **Audit Working:** Generates step-by-step mathematical calculation steps for auditability.

---

## 8. Planted-Trap Evaluation Benchmarks (`GET /eval/run`)
- **Corpus:** 6 synthetic Bharat National Bank (BNB) PDFs generated in `datasets/synthetic/`.
- **Benchmark (`datasets/benchmark/test_questions.json`):**
  - `TC_01_SPLIT_PAGE`: Stitched prepayment condition across Page 1 & 2 $\to$ **PASSED**
  - `TC_02_NUMBER_CONFLICT`: Loan Agreement (12.5%) vs Sanction Letter (11.0%) conflict $\to$ **PASSED**
  - `TC_03_AMENDMENT_CHAIN`: 3-step circular amendment chain resolution $\to$ **PASSED**
  - `TC_04_ABSTENTION_MISSING_EVIDENCE`: Tractor loan subsidy absent $\to$ **PASSED (Abstained)**
  - `TC_05_DETERMINISTIC_CALCULATION`: Rs. 500k processing fee + 18% GST $\to$ **PASSED (Rs. 8,850)**
- **Result:** **100.0% Accuracy (5/5 Tests Passed)**.

---

## 9. Frontend Application (`frontend/src/`)
- Built with React 18, Vite, TypeScript, Tailwind CSS, Lucide React, and `@xyflow/react`.
- **Pages Implemented:**
  1. `Dashboard.tsx`: Overview cards, system status, and recent activity.
  2. `DocumentLibrary.tsx`: Drag-and-drop upload, processing statuses, and document metadata.
  3. `EvidenceChat.tsx`: Q&A interface with citation chips, faithfulness meter, blocked-claims drawer, and calculation cards.
  4. `ContradictionCentre.tsx`: Side-by-side cards comparing conflicting clauses with reviewer resolution controls.
  5. `AmendmentExplorer.tsx`: Visual directed graph and chronological policy amendment timeline.
  6. `PdfViewerPage.tsx`: High-resolution PDF page viewer with bounding box highlights.
  7. `EvaluationPage.tsx`: Interactive planted-trap runner and 5-stage verification pipeline diagram.

---

## 10. Containerization & Documentation
- `backend/Dockerfile`: Multi-stage Python 3.11 with `tesseract-ocr` and `libmupdf-dev`.
- `frontend/Dockerfile`: Multi-stage Node 18 build with Nginx reverse proxy.
- `docker-compose.yml`: Single-command orchestration for backend and frontend.
- `README.md`: Architecture flowchart, open-source model licenses, benchmark results, and setup instructions.
