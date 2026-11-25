# VERITAS AI — Live Subsystem Status Tracker

Running status of every subsystem in Veritas AI, tracked against empirical tests and runtime evidence.

| Component | Status | Implementation Mode | Verification Evidence |
|---|---|---|---|
| **BM25 Retrieval** | Working | Real | `test_api_stage1.py::test_hybrid_retrieval_endpoint`, `BM25Okapi` in `hybrid.py` |
| **Dense Vector Retrieval** | Needs Fix (Phase 1.1) | Fallback (Lexical Overlap) | `backend/app/retrieval/hybrid.py:44-54` (`overlap = len(tokens.intersection(doc_tokens))`) |
| **Qdrant Storage & Indexing** | Needs Fix (Phase 1.1) | Partial / Stubbed | Collection init exists in `vector_store.py`, but ingestion does not generate dense embeddings or index payloads into Qdrant |
| **Reranking (Cross-Encoder)** | Missing (Phase 1.1) | Missing | No reranker currently configured in `retrieval/` pipeline |
| **PDF Text Parser (PyMuPDF)** | Working | Real | `parse_pdf()` in `parser.py`, span bounding boxes extracted in `test_verifydoc.py` |
| **Table Extraction (pdfplumber)**| Needs Improvement (Phase 1.2)| Partial | `pdfplumber.extract_tables()` called, but cells interleave with text causing malformed clauses in `Schedule-of-Charges-2025.pdf` |
| **OCR Pipeline (Tesseract)** | Missing (Phase 1.2) | Missing | Zero OCR calls in `parser.py`; scanned pages return 0 characters |
| **Clause Segmentation** | Needs Fix (Phase 1.2) | Flawed Regex | Greedy regex matches numeric table cells (e.g. `0.20`, `50`) and years (e.g. `20`) as clause numbers |
| **Fact & Scope Extraction** | Needs Fix (Phase 1.2 / 2.4) | Fallback (Regex only) | `SYNONYM_MAP` keyword lookups and regex matchers in `contradictions.py:40-70`; lacks LLM extraction and deterministic grounding check |
| **Amendment DAG & Temporal Engine**| Working | Real | 6/6 tests passing in `test_amendments_resolver.py` |
| **Contradiction Detection** | Working | Real | 3/3 tests passing in `test_conflicts_extended.py` |
| **NLI Verification Gate** | Working | Real + Fallback | 15/15 tests passing; uses `cross-encoder/nli-deberta-v3-small` with lexical heuristic fallback if unweighted |
| **Deterministic Verifier** | Working | Real | `verify_numerical_and_date_consistency` & `check_verbatim_quote` in `test_verifydoc.py` |
| **LLM Generation Engine** | Working | Real | OpenRouter (`nvidia/nemotron-3.5-lightning:free`) with schema repair and Ollama fallback support; live tested in `scripts/test_openrouter_live.py` |
| **Synthetic PDFs on Disk** | Needs Fix (Phase 1.4) | Missing Watermark Script | DB seed references 3 circulars; needs deterministic `scripts/generate_synthetic_pdfs.py` with visible "SYNTHETIC TEST DOCUMENT" marks |
| **Document Lineage Viewer** | Needs Fix (Phase 1.4) | Missing Split Pane | `AmendmentExplorer.tsx:206` calls `navigate('/viewer...')` instead of embedding reusable `PdfPageViewer` in left panel |
| **Verification Certificate** | Needs Fix (Phase 1.4) | Partial | Missing mandatory "Prototype, not an official certificate" notice |
| **Docker Compose Deployment** | Configured | Real | `docker-compose.yml` with backend, frontend, ollama, and named volumes |
| **Evaluation Harness** | Missing (Phase 3) | Missing | `eval/` directory with gold JSONL, real bootstrap confidence intervals, and metrics runner |
