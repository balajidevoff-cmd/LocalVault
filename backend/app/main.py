from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import admin, auth, files, folders, health, search, sharing, storage, users
from app.core.config import settings
from app.core.logging_config import logger, setup_logging
from app.services.storage_service import storage_engine

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    setup_logging(settings.LOG_LEVEL)
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION} [{settings.ENVIRONMENT}]")
    
    # Clean up any lingering temporary upload fragments
    cleaned = storage_engine.cleanup_abandoned_tmp_files(max_age_seconds=86400)
    if cleaned > 0:
        logger.info(f"Cleaned up {cleaned} abandoned temporary upload file(s)")

    logger.info("Storage engine initialized and verified.")
    yield
    # Shutdown actions
    logger.info(f"Shutting down {settings.APP_NAME}")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="LocalVault - Self-Hosted Personal Cloud Storage Platform",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# CORS Middleware
origins = settings.CORS_ORIGINS
if isinstance(origins, str):
    origins = [origins]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Range", "Accept-Ranges", "Content-Length"]
)

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response

# Register API v1 Routers
prefix = settings.API_V1_PREFIX
app.include_router(health.router, prefix=prefix)
app.include_router(auth.router, prefix=prefix)
app.include_router(users.router, prefix=prefix)
app.include_router(files.router, prefix=prefix)
app.include_router(folders.router, prefix=prefix)
app.include_router(search.router, prefix=prefix)
app.include_router(sharing.router, prefix=prefix)
app.include_router(storage.router, prefix=prefix)
app.include_router(admin.router, prefix=prefix)

@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "tagline": "Your files. Your storage. Your control.",
        "api_docs": "/api/docs",
        "health": f"{settings.API_V1_PREFIX}/health"
    }
