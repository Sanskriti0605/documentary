# VERITAS AI — Evidence-First Document Intelligence

VERITAS AI is an enterprise document intelligence and verification platform focused initially on Indian retail lending and banking compliance.

The central principle of VERITAS AI is:
**NO EVIDENCE = NO ANSWER.**

Every factual response generated is decomposed into atomic claims, each rigorously tied to original documents, pages, clauses, and exact supporting quotations.

---

## Architecture Overview

VERITAS AI consists of:
1. **Frontend**: Modern React (Vite + TypeScript + Tailwind CSS + Lucide React + React Flow + Recharts).
2. **Backend**: FastAPI modular monolith with SQLAlchemy 2.0 async ORM, Alembic migrations, Qdrant vector database, and NetworkX graph analysis.
3. **Intelligence Pipelines**:
   - Ingestion: PDF parsing, metadata & clause segmentation, candidate fact extraction, dense embeddings.
   - Retrieval: Hybrid dense + keyword (BM25) search with Reciprocal Rank Fusion & reranking.
   - Verification: Atomic claim decomposition, exact quotation verification, NLI entailment / contradiction checks, faithfulness scoring.
   - Financial Engine: Deterministic arithmetic using `decimal.Decimal` (EMI, penal charges, interest schedules).

---

## Quickstart Guide

### Prerequisites
- Python 3.11+
- Node.js 18+ & npm
- (Optional) Docker & Docker Compose for PostgreSQL + Qdrant

### 1. Environment Setup
```bash
cp .env.example .env
```

### 2. Backend Setup
```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

Run database migrations:
```bash
cd backend
alembic upgrade head
cd ..
```

Start backend server:
```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
Swagger API documentation is available at: `http://localhost:8000/docs`

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## Testing

Run backend tests:
```bash
pytest backend/tests -v
```
