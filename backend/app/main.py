import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.database.init_db import init_db
from app.retrieval.vector_store import init_qdrant_collections
from app.api.routes import documents, query, conflicts, amendments, rules, system

logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("veritas")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing VERITAS AI database schema and collections...")
    try:
        await init_db()
        init_qdrant_collections()
        logger.info("VERITAS AI initialization completed successfully.")
    except Exception as e:
        logger.error(f"Startup initialization error: {e}", exc_info=True)
    yield
    logger.info("Shutting down VERITAS AI.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="VERITAS AI — Evidence-First Document Intelligence Platform for Indian Retail Lending & Banking",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes with prefix /api/v1
api_prefix = settings.API_V1_PREFIX
app.include_router(system.router, prefix=api_prefix)
app.include_router(documents.router, prefix=api_prefix)
app.include_router(query.router, prefix=api_prefix)
app.include_router(conflicts.router, prefix=api_prefix)
app.include_router(amendments.router, prefix=api_prefix)
app.include_router(rules.router, prefix=api_prefix)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception at {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error occurred.", "path": str(request.url.path)}
    )

@app.get("/")
async def root():
    return {
        "platform": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs_url": "/docs",
        "health_check": f"{settings.API_V1_PREFIX}/health"
    }
