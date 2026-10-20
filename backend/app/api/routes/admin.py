from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.api.dependencies import require_admin
from app.core.logging_config import logger
from app.db.database import get_db
from app.models.audit import AdminAuditLog
from app.models.file import FileItem
from app.models.user import User
from app.schemas.admin import (
    AdminAuditLogItem,
    AdminDeleteResponse,
    AdminFileItem,
    AdminFileListResponse,
    AdminStatsResponse,
    AdminUserItem,
)
from app.services.file_service import file_service
from app.services.storage_service import storage_engine

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/stats", response_model=AdminStatsResponse)
def get_admin_stats(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    total_users = db.query(func.count(User.id)).scalar() or 0
    total_files = db.query(func.count(FileItem.id)).filter(FileItem.is_deleted == False).scalar() or 0
    total_storage = db.query(func.coalesce(func.sum(FileItem.size_bytes), 0)).filter(FileItem.is_deleted == False).scalar() or 0

    disk = storage_engine.get_disk_usage()

    return AdminStatsResponse(
        total_users=total_users,
        total_files=total_files,
        total_storage_bytes=int(total_storage),
        disk_free_bytes=disk["free_bytes"],
        disk_total_bytes=disk["total_bytes"]
    )


@router.get("/users", response_model=List[AdminUserItem])
def list_admin_users(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    result = []
    for u in users:
        used_bytes = file_service.get_user_storage_usage(db, u)
        quota_bytes = file_service.get_user_quota(u)
        file_count = db.query(func.count(FileItem.id)).filter(
            FileItem.owner_id == u.id,
            FileItem.is_deleted == False
        ).scalar() or 0

        result.append(
            AdminUserItem(
                id=u.id,
                username=u.username,
                email=u.email,
                role=u.role,
                is_active=u.is_active,
                used_storage_bytes=used_bytes,
                quota_bytes=quota_bytes,
                file_count=file_count,
                created_at=u.created_at
            )
        )
    return result


@router.get("/files", response_model=AdminFileListResponse)
def list_admin_files(
    user_id: Optional[str] = Query(None),
    deleted: Optional[bool] = Query(None),
    query: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    db_query = db.query(FileItem).join(User, FileItem.owner_id == User.id)

    if user_id and user_id.strip():
        db_query = db_query.filter(FileItem.owner_id == user_id.strip())

    if deleted is not None:
        db_query = db_query.filter(FileItem.is_deleted == deleted)

    if query and query.strip():
        search_pattern = f"%{query.strip()}%"
        db_query = db_query.filter(
            or_(
                FileItem.original_name.ilike(search_pattern),
                User.username.ilike(search_pattern),
                User.email.ilike(search_pattern)
            )
        )

    total = db_query.count()
    total_pages = max(1, (total + page_size - 1) // page_size)
    files = db_query.order_by(FileItem.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for f in files:
        items.append(
            AdminFileItem(
                id=f.id,
                original_name=f.original_name,
                size_bytes=f.size_bytes,
                mime_type=f.mime_type or "application/octet-stream",
                owner_id=f.owner_id,
                owner_username=f.owner.username if f.owner else "Unknown",
                owner_email=f.owner.email if f.owner else "",
                is_deleted=f.is_deleted,
                is_starred=f.is_starred,
                created_at=f.created_at,
                updated_at=f.updated_at
            )
        )

    return AdminFileListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.delete("/files/{file_id}", response_model=AdminDeleteResponse)
def admin_delete_file(
    file_id: str,
    permanent: bool = Query(False),
    confirmed: bool = Query(False),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    if not confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Explicit confirmation is required to delete user files"
        )

    file_item = db.query(FileItem).filter(FileItem.id == file_id).first()
    if not file_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )

    owner_id = file_item.owner_id
    owner_username = file_item.owner.username if file_item.owner else "Unknown"
    filename = file_item.original_name
    file_size = file_item.size_bytes
    storage_key = file_item.internal_storage_key

    if permanent:
        action_name = "PERMANENT_DELETE"
        try:
            # Physically delete from storage
            storage_engine.delete_physical_file(storage_key)
            # Remove from DB
            db.delete(file_item)

            log_entry = AdminAuditLog(
                admin_id=current_admin.id,
                admin_username=current_admin.username,
                target_user_id=owner_id,
                target_username=owner_username,
                file_id=file_id,
                filename=filename,
                action=action_name,
                result="SUCCESS",
                details=f"Admin {current_admin.username} permanently deleted '{filename}' ({file_size} bytes) belonging to {owner_username}"
            )
            db.add(log_entry)
            db.commit()

            logger.info(f"Admin {current_admin.username} permanently purged file {file_id} ('{filename}') of user {owner_username}")
            return AdminDeleteResponse(
                file_id=file_id,
                filename=filename,
                owner_username=owner_username,
                action=action_name,
                message=f"File '{filename}' permanently erased from disk and database."
            )
        except Exception as e:
            db.rollback()
            # Record audit failure
            fail_log = AdminAuditLog(
                admin_id=current_admin.id,
                admin_username=current_admin.username,
                target_user_id=owner_id,
                target_username=owner_username,
                file_id=file_id,
                filename=filename,
                action=action_name,
                result="FAILURE",
                details=f"Error deleting file: {str(e)}"
            )
            db.add(fail_log)
            db.commit()
            logger.error(f"Failed to permanently delete file {file_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Filesystem deletion failed: {str(e)}"
            )
    else:
        action_name = "SOFT_DELETE"
        try:
            file_item.is_deleted = True
            file_item.deleted_at = datetime.now(timezone.utc)
            file_item.updated_at = datetime.now(timezone.utc)

            log_entry = AdminAuditLog(
                admin_id=current_admin.id,
                admin_username=current_admin.username,
                target_user_id=owner_id,
                target_username=owner_username,
                file_id=file_id,
                filename=filename,
                action=action_name,
                result="SUCCESS",
                details=f"Admin {current_admin.username} moved '{filename}' to trash"
            )
            db.add(log_entry)
            db.commit()

            logger.info(f"Admin {current_admin.username} soft-deleted file {file_id} ('{filename}')")
            return AdminDeleteResponse(
                file_id=file_id,
                filename=filename,
                owner_username=owner_username,
                action=action_name,
                message=f"File '{filename}' moved to user's trash."
            )
        except Exception as e:
            db.rollback()
            fail_log = AdminAuditLog(
                admin_id=current_admin.id,
                admin_username=current_admin.username,
                target_user_id=owner_id,
                target_username=owner_username,
                file_id=file_id,
                filename=filename,
                action=action_name,
                result="FAILURE",
                details=f"Error moving file to trash: {str(e)}"
            )
            db.add(fail_log)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to move file to trash: {str(e)}"
            )


@router.post("/files/{file_id}/restore", response_model=AdminDeleteResponse)
def admin_restore_file(
    file_id: str,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    file_item = db.query(FileItem).filter(FileItem.id == file_id).first()
    if not file_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )

    owner_username = file_item.owner.username if file_item.owner else "Unknown"
    file_item.is_deleted = False
    file_item.deleted_at = None
    file_item.updated_at = datetime.now(timezone.utc)

    log_entry = AdminAuditLog(
        admin_id=current_admin.id,
        admin_username=current_admin.username,
        target_user_id=file_item.owner_id,
        target_username=owner_username,
        file_id=file_id,
        filename=file_item.original_name,
        action="RESTORE",
        result="SUCCESS",
        details=f"Admin {current_admin.username} restored '{file_item.original_name}' from trash"
    )
    db.add(log_entry)
    db.commit()

    return AdminDeleteResponse(
        file_id=file_id,
        filename=file_item.original_name,
        owner_username=owner_username,
        action="RESTORE",
        message=f"File '{file_item.original_name}' restored from trash."
    )


@router.get("/audit-logs", response_model=List[AdminAuditLogItem])
def get_admin_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    logs = db.query(AdminAuditLog).order_by(AdminAuditLog.timestamp.desc()).limit(limit).all()
    return logs
