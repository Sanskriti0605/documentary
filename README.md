# VERITAS AI — Evidence-First Document Intelligence for Banking & Finance

> **Core Philosophy:** **NO EVIDENCE = NO ANSWER.**  
> Every single factual claim must carry an authentic document reference, page number, bounding box, and verbatim quote. If evidence is missing, outdated, or contradictory, the system strictly abstains and explains what proof is missing.

---

## 🎯 Executive Summary & Pitch Overview

**VERITAS AI** (VerifyDoc) is an enterprise-grade, evidence-first Document Intelligence platform engineered specifically for Indian banking, compliance, and financial regulations (RBI Master Directions, Circulars, Retail Lending Policies, Loan Agreements, and Sanction Letters).

### The Problem it Solves:
1. **The RAG Hallucination Crisis:** Standard AI systems (ChatGPT, generic RAG) invent facts, misquote regulatory clauses, and hallucinate financial numbers. In banking, a hallucinated rate or prepayment penalty leads to regulatory penalties, litigation, and audit failures.
2. **Temporal Blindness:** Regulations evolve constantly. Circular A (2023) is amended by Circular B (2024), which is extended by Circular C (2025). Standard vector search pulls the most semantically similar clause—often an obsolete or draft policy—ignoring whether it was actually in force on the loan execution date.
3. **Hidden Contradictions:** Bank internal agreements frequently conflict with statutory RBI caps or updated guidelines without compliance officers knowing.
4. **Black-Box Citations:** Most AI tools return vague citations or link to a 200-page PDF without pointing to the exact sentence or coordinates on the page.

### The VERITAS Solution:
- **3-Point Verification Gate:** Verbatim string match + Regex Number/Date entity match + DeBERTa-v3 Cross-Encoder NLI entailment. Claims that fail are blocked and labeled with explicit reasons.
- **Temporal Resolution DAG:** Directed Acyclic Graph (NetworkX) resolving amendments, extensions, and withdrawals based on the query's as-of date.
- **Automated Contradiction Engine:** Detects conflicts between bank contracts and regulator mandates (e.g., Bank charging 2.0% foreclosure when RBI mandated 0%).
- **Visual Bounding-Box Proof:** Every citation highlights the exact coordinate box on the rendered PDF page.
- **Deterministic Financial Arithmetic:** 100% exact math using Python `Decimal` (reducing balance EMI, RBI non-capitalized penal charges, GST).

---

## 📊 Presentation Deck Guide (Ready-to-Use Slides for Judges)

Use the structure below to create your slide deck (PowerPoint / Google Slides / Pitch Deck):

```
┌────────────────────────────────────────────────────────────────────────┐
│                        VERITAS AI SLIDE DECK                           │
├─────────┬──────────────────────────────────────────────────────────────┤
│ Slide 1 │ Problem: Why General LLMs & Standard RAG Fail in Banking     │
│ Slide 2 │ Solution: VERITAS AI — The Evidence-First Architecture       │
│ Slide 3 │ The Core Innovation: 3-Point Systematic Verification Gate    │
│ Slide 4 │ Temporal Graph: Solving Regulatory Amendments & Extensions   │
│ Slide 5 │ Automated Contradiction Engine & Scope Disambiguation        │
│ Slide 6 │ Interactive Proof: Bounding Boxes & Deterministic Math       │
│ Slide 7 │ Technology Stack & Architecture (No Fake Results)            │
│ Slide 8 │ Live Benchmark & Synthetic Test Pack Results                 │
│ Slide 9 │ Business Impact, Compliance ROI & Conclusion                 │
└─────────┴──────────────────────────────────────────────────────────────┘
```

---

### Slide 1: Title & The Banking Compliance Dilemma
- **Headline:** *Why Generic AI Cannot Be Trusted with Financial Regulations*
- **The Core Problem:**
  - In retail lending and compliance, a 0.5% calculation error or an outdated circular reference costs millions in RBI penalties and consumer litigation.
  - Standard RAG has 4 critical failure modes in banking:
    1. **Hallucination:** Generates plausible-sounding but non-existent circular numbers and clauses.
    2. **Temporal Confusion:** Cites a superseded 2023 rule when an effective 2024 amendment exists.
    3. **Math Errors:** LLMs cannot do reliable compound interest, GST additions, or pro-rata days calculations.
    4. **Unverifiable Output:** No pixel-level proof connecting the answer to the signed contract.
- **Speaker Note:** *"Judges, when an enterprise asks an AI 'What is the foreclosure charge on my home loan?', a standard LLM will hallucinate a number with high confidence. In banking, being confidently wrong is unacceptable. That is why we built VERITAS AI."*

---

### Slide 2: The Solution — VERITAS AI
- **Headline:** *Evidence-First Document Intelligence with Zero Hallucination Tolerance*
- **Key Tenet:** **No Evidence = No Answer.**
  - If documentary evidence does not exist, the system enforces **explicit abstention** (`INSUFFICIENT_EVIDENCE`).
  - Distinguishes **Consultative Drafts** vs. **Final RBI Notifications** vs. **Bank Policies** vs. **Loan Contracts**.
  - Respects **Authority Tiers:** Regulatory directions strictly override bank-level contracts.
- **Speaker Note:** *"Instead of treating documents as a bag of text chunks, VERITAS AI treats documents as a legal hierarchy with authority tiers, temporal validity dates, and strict mathematical constraints."*

---

### Slide 3: The 3-Point Systematic Verification Gate
- **Headline:** *How VERITAS Proves Every Single Claim Before It Reaches the User*
- **Visual / Flow:**
  1. **Gate 1 — Verbatim Check:** Does the claim’s exact quote exist word-for-word in the source PDF page?
  2. **Gate 2 — Entity & Number Normalization:** Are all percentages, currency amounts (Rs./INR), and dates exact matches?
  3. **Gate 3 — Neural NLI Entailment (`DeBERTa-v3`):** Does the source clause logically entail the generated claim? (Probabilities calculated via cross-encoder).
- **The Outcome:**
  - **Passed:** Green verified claim chip with one-click page preview and bounding box.
  - **Failed:** Claim is immediately stripped from the answer; logged with granular reason code (`NOT_ENTAILED`, `QUOTE_MISSING`, `NUMBER_MISMATCH`, `NOT_IN_FORCE`).
- **Speaker Note:** *"We do not blindly trust the LLM. Every generated sentence is put through an adversarial 3-point gate. If the cross-encoder or regex finds a single discrepancy, the claim is blocked."*

---

### Slide 4: Temporal Reasoning & Amendment DAG
- **Headline:** *Navigating Regulatory Evolution: Effective Dates, Extensions, and Amendments*
- **The Challenge:**
  - RBI issues Circular A on Jan 2024 (Draft).
  - RBI issues Final Directions on March 2024, effective Oct 1, 2024.
  - In August 2024, RBI extends the effective date to Jan 1, 2025.
  - In March 2025, RBI partially amends clause 2.2 for MSEs up to Rs. 50 Lakh, effective June 1, 2025.
- **VERITAS Solution:**
  - Builds a **Directed Acyclic Graph (DAG)** of all circulars using NetworkX.
  - Supports queries with an **as-of date** (e.g., *"As of 1 Nov 2024, are foreclosure charges banned?"*).
  - Automatically resolves:
    - Drafts $\to$ Non-binding.
    - Future dates $\to$ Not yet in force.
    - Partial amendments $\to$ Inherits parent clauses while applying specific overrides.
- **Speaker Note:** *"If a loan was sanctioned on November 2024, our system knows the extension was in effect, meaning the old rules applied. No other RAG tool has this level of temporal graph reasoning."*

---

### Slide 5: Automated Contradiction Engine & Scope Awareness
- **Headline:** *Detecting Compliance Violations Before the Auditor Does*
- **Core Functionality:**
  - Ingests bank loan agreements and contrasts them against regulator directions.
  - **Example Real Conflict:**
    - Bank Retail Lending Policy: *"Foreclosure penalty of 2.0% applies to all floating-rate home loans."*
    - RBI Circular: *"No banks shall levy foreclosure charges on floating-rate term loans to individuals."*
    - **VERITAS Action:** Flags `CONFIRMED_CONFLICT`, displays side-by-side clauses, and alerts compliance teams.
  - **Scope Disambiguation:** Understands when rules *do not* conflict (e.g., Fixed-Rate Loans vs. Floating-Rate Loans, NBFCs vs. Commercial Banks).
- **Speaker Note:** *"It does not just find similarity; it finds legal incompatibility. It highlights the exact clauses where internal bank agreements violate RBI mandates."*

---

### Slide 6: Visual Citations & Deterministic Math
- **Headline:** *Auditable Proof Down to the Pixel and the Rupee*
- **Interactive PDF Viewer:**
  - Clicking any citation renders the high-res PDF page image on-the-fly using PyMuPDF.
  - Dynamically overlays multi-colored highlight rectangles on the exact bounding boxes `[x0, y0, x1, y1]`.
- **Deterministic Math Engine:**
  - Zero LLM arithmetic: All numerical calculations (EMI, penal charges, GST) run through Python `Decimal`.
  - Implements RBI's mandatory non-capitalization rules for penal charges.

---

### Slide 7: Complete Technical Stack
- **Architecture Diagram:**

```mermaid
flowchart LR
    PDF["PDF Ingestion\n(PyMuPDF + Tesseract OCR)"] --> CHUNK["Clause Segmentation\n& Bounding Boxes"]
    CHUNK --> VEC["Dense Indexing (Qdrant)\nBAAI/bge-m3 (1024-d)"]
    CHUNK --> BM25["Sparse Indexing\nBM25Okapi"]
    
    USER["User Query + As-Of Date"] --> HYBRID["Hybrid Search\nRRF (k=60) + Authority Boost"]
    HYBRID --> DAG["Temporal Resolver\nNetworkX Amendment DAG"]
    DAG --> LLM["Evidence-Constrained LLM\nOpenRouter (Nemotron 3.5 Lightning)"]
    
    LLM --> GATE{"3-Point Verification Gate\n(Verbatim + Regex + DeBERTa-v3)"}
    GATE -- Verified --> OUT["Verified Answer + BBox Citations\n+ Faithfulness Score"]
    GATE -- Blocked --> ABS["Abstention / Reason Codes"]
```

- **Models & Infrastructure:**
  - **Dense Embeddings:** `BAAI/bge-m3` (1024 dimensions, high semantic fidelity).
  - **Lexical Search:** `BM25Okapi` with tokenized corpus.
  - **LLM Generation:** **OpenRouter** (`nvidia/nemotron-3.5-lightning:free`, 5000 max tokens, structured JSON enforcement).
  - **NLI Verifier:** `cross-encoder/nli-deberta-v3-small` (local Hugging Face weights).
  - **OCR Engine:** Tesseract OCR for scanned image PDFs.
  - **Backend:** FastAPI, SQLAlchemy, aiosqlite, SQLite + embedded Qdrant.
  - **Frontend:** React 18, Vite, Tailwind CSS, `@xyflow/react`.

---

### Slide 8: Rigorous Evaluation & Benchmarking
- **No Fake Results Policy:**
  - Tested against an extensive synthetic Indian banking benchmark: **28 synthetic PDFs + 33 golden test queries** spanning temporal questions, contradictions, calculations, multi-page parsing, watermark filtering, and abstention traps.
  - Reusable evaluation runner (`scripts/run_golden_eval.py`) verifies factual accuracy, citation correctness, and non-degraded execution.

---

### Slide 9: Business Value & Target Audience
- **Target Users:**
  1. **Bank Compliance Officers:** Audit loan agreements against RBI circulars in seconds instead of weeks.
  2. **Credit & Legal Underwriters:** Verify sanction letters, stamp duty, and borrower eligibility.
  3. **FinTech NBFCs & Digital Lenders:** Ensure automated digital lending policies comply with RBI Cooling-Off and KFS directions.
  4. **Retail Borrowers:** Clarify loan contracts and verify fee schedules with zero confusion.
- **ROI:** 90% reduction in manual document review time, zero hallucination liability, and continuous regulatory audit readiness.

---

## 🎤 Frequently Asked Questions by Judges (And How to Answer)

### Q1: "Why not just upload the PDF to ChatGPT or Claude?"
> **Answer:** *"Standard LLMs suffer from three critical flaws in banking: (1) They hallucinate non-existent circulars and dates; (2) They lack temporal awareness—they cannot determine which amendment was legally binding on a specific past loan sanction date; and (3) They do not give pixel-level bounding-box proof or audit trails. VERITAS AI enforces hard programmatic verification gates and temporal graph resolution that LLMs cannot do alone."*

### Q2: "What if the document is scanned or has watermarks?"
> **Answer:** *"We have integrated Tesseract OCR with automatic image pre-processing. For draft documents with watermarks (such as 'DRAFT' or 'CONFIDENTIAL'), our parser separates background watermarks from foreground regulatory text so legal clauses remain cleanly indexed."*

### Q3: "How do you guarantee that math and calculations are accurate?"
> **Answer:** *"The LLM is completely forbidden from doing arithmetic. We extract the financial parameters (principal, rate, days overdue) from verified clauses and feed them into a deterministic Python Decimal calculation engine implementing RBI's non-capitalized penal charge formulas and statutory 18% GST."*

### Q4: "How does the system scale with hundreds of regulations?"
> **Answer:** *"We use hybrid search combining BM25 keyword matching and BGE-M3 dense embeddings in Qdrant with Reciprocal Rank Fusion ($k=60$). Combined with our NetworkX temporal DAG, we quickly prune irrelevant or superseded circulars before the LLM generates a single token."*

---

## 🚀 Running the Project

### Prerequisites:
- Python 3.11+
- Node.js 18+
- Tesseract OCR (`brew install tesseract` on Mac or `apt-get install tesseract-ocr` on Linux)
- OpenRouter API Key (free tier available at [openrouter.ai](https://openrouter.ai))

### 1. Backend Setup:
```bash
# Clone the repository
git clone https://github.com/Sanskriti0605/documentary.git
cd documentary

# Create virtual environment and install dependencies
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

# Configure environment variables in .env
cat <<EOF > .env
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=nvidia/nemotron-3.5-lightning:free
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
EOF

# Start the FastAPI server
PYTHONPATH=backend uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```
API Documentation: `http://localhost:8001/docs`  
Health Check: `http://localhost:8001/api/v1/health`

### 2. Frontend Setup:
```bash
# In a new terminal:
cd frontend
npm install
npm run dev
```
Open **`http://localhost:5173`** in your browser.

### 3. Run Benchmark Evaluation:
```bash
# Run the 33 golden query evaluation suite
PYTHONPATH=. python scripts/run_golden_eval.py --output docs/baseline_results.md
```

---

## 📜 License & Compliance Notice

This system is an open-source research and engineering prototype. Synthetic test documents (`SYN_01`..`SYN_28`) are fictional test assets designed for benchmarking and do not represent official RBI documents or legal counsel.
