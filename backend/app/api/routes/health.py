from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.models.user import User
from app.services.storage_service import storage_engine

router = APIRouter(tags=["Health"])

class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str
    database: str
    disk_healthy: bool
    first_run_setup_required: bool

@router.get("/health", response_model=HealthResponse)
def health_check(db: Session = Depends(get_db)):
    # Check DB
    db_ok = False
    first_run_required = False
    try:
        db.execute(text("SELECT 1")).scalar()
        db_ok = True
        user_count = db.query(User).count()
        first_run_required = (user_count == 0)
    except Exception:
        db_ok = False

    disk_info = storage_engine.get_disk_usage()
    disk_ok = disk_info["free_bytes"] > (100 * 1024 * 1024)

    overall_status = "ok" if (db_ok and disk_ok) else "degraded"

    return HealthResponse(
        status=overall_status,
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
        database="connected" if db_ok else "disconnected",
        disk_healthy=disk_ok,
        first_run_setup_required=first_run_required
    )
