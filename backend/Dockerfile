FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for PyMuPDF and tesseract OCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    tesseract-ocr \
    tesseract-ocr-hin \
    libmupdf-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend /app/backend
COPY datasets /app/datasets
COPY scripts /app/scripts

RUN chmod +x /app/backend/entrypoint.sh

# Create necessary directories
RUN mkdir -p /app/storage/uploads /app/storage/rendered /app/storage/db /app/storage/qdrant /root/.cache/huggingface

ENV PYTHONPATH=/app/backend
ENV VERITAS_PORT=8001
ENV VERITAS_HOST=0.0.0.0

EXPOSE 8001

ENTRYPOINT ["/app/backend/entrypoint.sh"]
