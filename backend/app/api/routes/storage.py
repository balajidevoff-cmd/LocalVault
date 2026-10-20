import os
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.config import settings
from app.db.database import get_db
from app.models.user import User
from app.schemas.storage import StorageStatusResponse, StorageUsageResponse
from app.services.file_service import file_service
from app.services.storage_service import storage_engine

router = APIRouter(prefix="/storage", tags=["Storage"])

@router.get("/usage", response_model=StorageUsageResponse)
def get_storage_usage(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return file_service.get_storage_analytics(db, current_user)

@router.get("/status", response_model=StorageStatusResponse)
def get_storage_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    disk_info = storage_engine.get_disk_usage()
    
    # Test storage writability
    writable = os.access(str(storage_engine.root), os.W_OK)
    
    # Test DB connection
    db_connected = False
    try:
        db.execute(text("SELECT 1")).scalar()
        db_connected = True
    except Exception:
        pass

    return StorageStatusResponse(
        storage_root=str(storage_engine.root.name), # Obfuscate full host path for security
        status="healthy" if (writable and db_connected) else "degraded",
        disk_total_bytes=disk_info["total_bytes"],
        disk_free_bytes=disk_info["free_bytes"],
        disk_used_bytes=disk_info["used_bytes"],
        writable=writable,
        db_connected=db_connected
    )
