import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "VERITAS AI"
    VERSION: str = "0.1.0"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./storage/db/veritas.db"
    SYNC_DATABASE_URL: str = "sqlite:///./storage/db/veritas.db"

    # Qdrant Vector Storage
    QDRANT_URL: str = ""
    QDRANT_STORAGE_PATH: str = "./storage/qdrant"
    QDRANT_COLLECTION: str = "veritas_clauses"

    # Storage Paths
    STORAGE_DIR: str = "./storage"
    UPLOAD_DIR: str = "./storage/uploads"
    RENDERED_DIR: str = "./storage/rendered"

    # AI Model Providers
    AI_PROVIDER: str = "local"  # local, ollama, colab, mock
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    COLAB_WORKER_URL: str = ""
    EMBEDDING_MODEL: str = "Qwen3-Embedding-0.6B"
    GENERATION_MODEL: str = "Qwen3-4B-Instruct-2507"
    NLI_MODEL: str = "mDeBERTa-v3-base-mnli-xnli"

settings = Settings()

# Ensure storage directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.RENDERED_DIR, exist_ok=True)
os.makedirs(settings.QDRANT_STORAGE_PATH, exist_ok=True)
os.makedirs(os.path.dirname(settings.SYNC_DATABASE_URL.replace("sqlite:///", "")), exist_ok=True)
