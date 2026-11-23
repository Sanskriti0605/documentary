#!/bin/bash
set -e

echo "=== Initializing VerifyDoc Backend ==="

# Create storage directories
mkdir -p /app/storage/uploads /app/storage/rendered /app/storage/db /app/storage/qdrant

# Check if synthetic documents need to be generated and seeded
if [ ! -f "/app/storage/db/veritas.db" ] || [ ! -f "/app/storage/uploads/BNB_Retail_Loan_Policy_2023.pdf" ]; then
    echo "First-time startup detected: Generating synthetic Indian banking documents..."
    python /app/datasets/synthetic/generator.py || true
    echo "Seeding synthetic documents and clause boundaries into database..."
    PYTHONPATH=/app/backend python /app/scripts/seed_synthetic_docs.py || true
fi

echo "=== Starting VerifyDoc API on port 8001 ==="
exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8001
