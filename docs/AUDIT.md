# VERITAS AI — Subsystem Audit Report (Phase 0)

Date: 2026-11-24  
Auditor: Senior AI Engineer / Veritas AI Engineering Team  
Branch: `openrouter`  

---

## 1. Executive Summary

This comprehensive audit of **Veritas AI** (FastAPI backend, React 18 + Vite frontend, PyMuPDF/pdfplumber ingestion, BM25 + dense retrieval, NetworkX amendment DAG, verification gate, SQLite + embedded Qdrant) evaluated every subsystem by executing code and measuring actual behavior rather than inspecting comments.

### Key Audit Findings:
1. **Dense Retrieval is Fake:** `search_dense` in `backend/app/retrieval/hybrid.py` (lines 44-54) computes token intersection ratio (`len(tokens.intersection(doc_tokens)) / len(tokens)`), not BGE-M3 embeddings in Qdrant, despite `vector_store.py` having collection setup logic for Qdrant.
2. **Clause Segmentation & Ingestion Tables are Flawed:** `segment_clauses_with_bboxes` in `parser.py` uses an over-greedy regex with an optional clause prefix `(?:Clause|Section|...)?\s*([0-9]{1,2}(?:\.[0-9]{1,2})*)`. In table-heavy documents such as `Schedule-of-Charges-2025.pdf`, fee percentages like `0.20 %` or amounts `50 /-` are falsely segmented as clause numbers (`Clause 0.20`, `Clause 50`), and date years like `2024 onwards` are split into `Clause 20: 24 onwards`.
3. **OCR is Absent:** `backend/app/ingestion/parser.py` has zero calls to Tesseract, `pytesseract`, or `ocrmypdf`. Scanned or image-only pages yield 0 text characters.
4. **Subject & Value Extraction is Regex-Only:** Ingestion and conflict extraction in `backend/app/intelligence/contradictions.py` relies strictly on `SYNONYM_MAP` keyword lookups and regexes for `%` and currency values. No structured LLM extraction or verification exists during ingestion.
5. **Seeded Synthetic Documents:** The DB seed in `amendments.py` referenced 3 synthetic circulars (`RBI_Draft_Circular_Penal_Charges_Apr2023.pdf`, `RBI_Fair_Lending_Circular_Aug2023_Final.pdf`, `RBI_Extension_Circular_Dec2023.pdf`) that were initially missing from disk. Standalone generator scripts were not wired into the core seed routine with required "SYNTHETIC TEST DOCUMENT" marks.
6. **UI Lineage Viewer Navigation:** In `frontend/src/pages/AmendmentExplorer.tsx` (line 206), clicking a graph or timeline node calls `navigate('/viewer?doc=...')` rather than mounting the reusable PDF page viewer in an embedded split pane.

---

## 2. Confirmation / Refutation of 7 Suspected Issues

| # | Suspected Issue | Verified Status | Concrete Evidence / Code Location |
|---|---|---|---|
| **1** | `search_dense` in `hybrid.py` uses lexical token overlap, not BGE-M3 embeddings, although `vector_store.py` is configured for Qdrant. | **CONFIRMED** | `backend/app/retrieval/hybrid.py` lines 44-54: `overlap = len(tokens.intersection(doc_tokens)); score = overlap / (len(tokens) + 1e-5)`. Qdrant client is imported but never queried for dense vector similarity. |
| **2** | The NLI gate falls back to `heuristic-nli-fallback` when weights are not loaded. | **CONFIRMED** | `backend/app/verification/gate.py` lines 31-34 & 145-160: when `CrossEncoder` fails to load, `get_nli_model()` logs `"Falling back to lexical heuristic"` and `evaluate_nli_entailment` returns `"verifier": "lexical-heuristic-fallback"`. |
| **3** | Generation falls back to `extractive-fallback` when Ollama / provider is offline or model is not pulled. | **CONFIRMED** | `backend/app/generation/engine.py` lines 240-255: if the LLM provider fails, returns an error, or is unconfigured, `generation_provider = f"extractive-fallback ({error})"` and `is_fallback = True`. |
| **4** | Scanned PDFs yield empty pages because OCR is not wired in. | **CONFIRMED** | `backend/app/ingestion/parser.py` lines 23-125: only PyMuPDF `page.get_text("dict")` and optional `pdfplumber.extract_tables()` are executed. Tesseract OCR is nowhere in the codebase. |
| **5** | Ingestion extracts subjects and values with regex only. | **CONFIRMED** | `backend/app/intelligence/contradictions.py` lines 40-70: `extract_facts_from_clauses` uses `SYNONYM_MAP` keyword iteration and `re.findall(r'(\d+(?:\.\d+)?\s*%)', text)` / `re.findall(r'(?:INR\|Rs\.?\|₹)\s*([\d,]+(?:\.\d+)?)', text)`. No LLM extraction is used. |
| **6** | Three seeded circular PDFs exist in the DB but not on disk: `RBI_Draft_Circular_Penal_Charges_Apr2023.pdf`, `RBI_Fair_Lending_Circular_Aug2023_Final.pdf`, `RBI_Extension_Circular_Dec2023.pdf`. | **CONFIRMED** | `backend/app/intelligence/amendments.py` lines 252-273: `ensure_seed_penal_chain_in_db` seeds DB rows with paths `storage/uploads/<name>`, but no automated idempotent PDF generator existed in the seed workflow with the required prototype/synthetic labeling. |
| **7** | `AmendmentExplorer.tsx` opens `/viewer` in a new tab instead of showing the PDF in a left panel. | **CONFIRMED** | `frontend/src/pages/AmendmentExplorer.tsx` line 206: `navigate(`/viewer?doc=${encodeURIComponent(docName)}&page=1&quote=${encodeURIComponent(clauseText)}`)`. Reusable `PdfPageViewer` is not mounted in an embedded split view. |

---

## 3. Reproduction of Known User Problems

### Problem A: Uploaded Documents Parse Badly
* **File Under Test:** `Schedule-of-Charges-2025.pdf` (26 pages, multi-table banking fee schedule)
* **Observed Execution Output:**
  ```text
  FILE: Schedule-of-Charges-2025.pdf
  Total Pages: 26
  Total Clauses Segmented: 68
  Page 1: Text length = 99 (Low text cover page)
  First 3 clauses segmented:
    - Clause Preamble : 'Preamble / General Provisions' (Len: 3315)
    - Clause 0.20 : '%, Minimum: Tk.150/-' (Len: 77)
    - Clause 50 : '/-' (Len: 2536)
  ```
* **Root Cause Analysis:**
  In `backend/app/ingestion/parser.py`, `clause_regex = re.compile(r"^(?:Clause|Section|Article|Paragraph|Rule)?\s*([0-9]{1,2}(?:\.[0-9]{1,2})*|[0-9]{1,2}\([a-z]\))\s*[:\.\-]?\s*(.*)", re.IGNORECASE)`.
  Because the prefix prefix `(?:Clause|Section|...)?` is optional (`?`), any table line beginning with a number (e.g. `0.20 %` or fee `50 /-`) triggers a false positive clause boundary. Furthermore, multi-column tables are extracted linearly, interleaving text across column cells.

### Problem B: Queries Return Wrong Clauses
* **Query Under Test:** `"What is the penal charge rate for default on personal loans?"`
* **Expected Retrieval:** `BNB_Retail_Loan_Policy_2023.pdf` Clause 4.1 or `BNB_Loan_Policy_Amendment_2025.pdf` Clause 4.1.
* **Actual Retrieval Scores:**
  ```text
  TOP BM25:
    [BNB_Retail_Loan_Policy_2023.pdf] Clause 4.1: score=18.9077
    [BNB_Schedule_of_Charges.pdf] Clause 3.00: score=12.7625
    [BNB_Loan_Policy_Amendment_2025.pdf] Clause 4.1: score=12.6047

  TOP DENSE (LEXICAL OVERLAP FAKE):
    [Schedule-of-Charges-2025.pdf] Clause 0.50: score=0.7273
    [Schedule-of-Charges-2025.pdf] Clause 0.50: score=0.7273
    [BNB_Retail_Loan_Policy_2023.pdf] Clause 4.1: score=0.6364

  TOP HYBRID (RRF):
    [BNB_Retail_Loan_Policy_2023.pdf] Clause 4.1: RRF=0.0323
    [Schedule-of-Charges-2025.pdf] Clause 0.50: RRF=0.0309
    [BNB_Schedule_of_Charges.pdf] Clause 3.00: RRF=0.0308
  ```
* **Root Cause Analysis:**
  1. Because `search_dense` counts lexical token overlap instead of actual cosine similarity of BGE-M3 dense embeddings, huge broken table clauses like `Clause 0.50` (which had 2,378 characters of random fees including words "personal", "loan", "rate") scored 0.7273, outranking real governing clauses.
  2. In RRF fusion, these false dense matches push irrelevant fee tables into the top-3 retrieved context.
  3. No temporal filtering occurs prior to retrieval: queries with an `as_of_date` receive superseded documents because retrieval is agnostic to amendment graph status.

---

## 4. Subsystem Inventory & Health Summary

| Subsystem | File Location | Real / Fallback / Stubbed | Details |
|---|---|---|---|
| **BM25 Retrieval** | `backend/app/retrieval/hybrid.py` | **Real** | `BM25Okapi` on tokenized corpus. Operates correctly. |
| **Dense Retrieval** | `backend/app/retrieval/hybrid.py` | **Fallback / Fake** | Token overlap ratio; Qdrant vector search is not invoked. |
| **Vector Database** | `backend/app/retrieval/vector_store.py` | **Stubbed / Partial** | Setup code for Qdrant collection exists, but ingestion does not index vectors into Qdrant. |
| **RRF Fusion** | `backend/app/retrieval/hybrid.py` | **Real** | Standard $1 / (k + \text{rank})$ reciprocal rank fusion. |
| **Reranking** | `backend/app/retrieval/` | **Missing** | No cross-encoder reranker (BGE-reranker) implemented. |
| **PDF Text Parser** | `backend/app/ingestion/parser.py` | **Real** | PyMuPDF text span extraction with rotated-watermark filtering. |
| **Table Parser** | `backend/app/ingestion/parser.py` | **Partial** | Uses pdfplumber extract_tables, but table cells are not integrated cleanly into structured clause text. |
| **OCR Pipeline** | `backend/app/ingestion/` | **Missing** | No OCR integration for scanned or image-based pages. |
| **Clause Segmenter** | `backend/app/ingestion/parser.py` | **Partial / Flawed** | Greedy regex breaks on table rows and dates. |
| **Rule Fact Extractor** | `backend/app/intelligence/contradictions.py` | **Fallback (Regex)** | Keyword synonym mapping and regex number search. No LLM assistance. |
| **Amendment DAG** | `backend/app/intelligence/amendments.py` | **Real** | NetworkX temporal resolution with in-force, future-dated, and draft statuses. |
| **Contradiction Engine** | `backend/app/intelligence/contradictions.py` | **Real** | Compares extracted facts and checks amendment resolution status. |
| **NLI Verification Gate**| `backend/app/verification/gate.py` | **Real + Fallback** | Cross-encoder `cross-encoder/nli-deberta-v3-small` with lexical fallback. |
| **Deterministic Verifier**| `backend/app/verification/gate.py` | **Real** | Exact whitespace-normalized verbatim matching and numeric/date verification. |
| **LLM Generation** | `backend/app/generation/engine.py` | **Real + Fallback** | OpenRouter (Nemotron 3.5 Lightning) & Ollama provider architecture with extractive fallback. |
| **Evidence Viewer** | `frontend/src/pages/PdfViewerPage.tsx` | **Real** | Bounding box overlays, document switching, and quote matching. |
| **Lineage Embedded Viewer**| `frontend/src/pages/AmendmentExplorer.tsx` | **Missing** | Full-page navigation redirect instead of embedded split-view viewer. |
| **Certificate Modal** | `frontend/src/components/` | **Partial** | Missing required "Prototype, not an official certificate" notice and emblem disclaimers. |
