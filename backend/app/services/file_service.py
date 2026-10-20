import mimetypes
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import filetype
from fastapi import HTTPException, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from pathlib import Path
from app.core.config import settings
from app.core.logging_config import logger
from app.core.security import sanitize_filename
from app.models.file import FileItem
from app.models.folder import Folder
from app.models.user import User
from app.schemas.file import FileListResponse, FileResponse, FileUpdateRequest
from app.schemas.storage import FileTypeDistribution, StorageUsageResponse
from app.services.folder_service import folder_service
from app.services.storage_service import storage_engine

class FileService:
    @staticmethod
    def get_user_storage_usage(db: Session, user: User) -> int:
        """Computes current total storage consumption for the given user in bytes."""
        total = db.query(func.coalesce(func.sum(FileItem.size_bytes), 0)).filter(
            FileItem.owner_id == user.id
        ).scalar()
        return int(total or 0)

    @staticmethod
    def get_user_quota(user: User) -> int:
        """Determines the effective storage quota for the user."""
        if user.storage_quota_bytes:
            try:
                return int(user.storage_quota_bytes)
            except ValueError:
                pass
        return settings.LOCALVAULT_STORAGE_QUOTA_BYTES

    @staticmethod
    async def upload_file(
        db: Session,
        user: User,
        upload_file: UploadFile,
        folder_id: Optional[str] = None
    ) -> FileResponse:
        # Determine target folder path hierarchy on disk if folder is specified
        folder_path = ""
        if folder_id:
            folder = db.query(Folder).filter(
                Folder.id == folder_id,
                Folder.owner_id == user.id
            ).first()
            if not folder:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Target folder does not exist"
                )
            crumbs = folder_service.get_breadcrumbs(db, folder)
            folder_path = "/".join(c.name for c in crumbs if c.id is not None)

        clean_filename = sanitize_filename(upload_file.filename or "upload")
        current_usage = FileService.get_user_storage_usage(db, user)
        quota = FileService.get_user_quota(user)

        # Stream write to storage engine with human-readable filename and extension
        internal_key, size_bytes, checksum, saved_filename = await storage_engine.save_upload_stream(
            upload_file=upload_file,
            current_user_usage_bytes=current_usage,
            user_quota_bytes=quota,
            username=user.username,
            folder_path=folder_path,
            preferred_filename=clean_filename
        )

        # Detect MIME type safely: inspect physical file header first
        physical_path = storage_engine.get_file_path(internal_key)
        mime_type = "application/octet-stream"
        try:
            kind = filetype.guess(str(physical_path))
            if kind:
                mime_type = kind.mime
            else:
                guessed, _ = mimetypes.guess_type(clean_filename)
                if guessed:
                    mime_type = guessed
        except Exception:
            guessed, _ = mimetypes.guess_type(clean_filename)
            if guessed:
                mime_type = guessed

        # Create database record
        file_item = FileItem(
            owner_id=user.id,
            folder_id=folder_id,
            original_name=clean_filename,
            internal_storage_key=internal_key,
            mime_type=mime_type,
            size_bytes=size_bytes,
            checksum_sha256=checksum,
            is_starred=False,
            is_deleted=False
        )
        db.add(file_item)
        db.commit()
        db.refresh(file_item)

        logger.info(f"File uploaded: id={file_item.id} name='{clean_filename}' size={size_bytes}")
        return FileResponse.model_validate(file_item)

    @staticmethod
    def get_file(db: Session, user: User, file_id: str) -> FileItem:
        file_item = db.query(FileItem).filter(
            FileItem.id == file_id,
            FileItem.owner_id == user.id
        ).first()
        if not file_item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found or access denied"
            )
        return file_item

    @staticmethod
    def list_files(
        db: Session,
        user: User,
        folder_id: Optional[str] = None,
        all_files: bool = False,
        starred: Optional[bool] = None,
        deleted: bool = False,
        search_query: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        page: int = 1,
        page_size: int = 50
    ) -> FileListResponse:
        query = db.query(FileItem).filter(FileItem.owner_id == user.id)

        # Deletion state filter (trash vs active)
        query = query.filter(FileItem.is_deleted == deleted)

        # Starred filter
        if starred is not None:
            query = query.filter(FileItem.is_starred == starred)

        # Folder filter (only applied if not in search or special views)
        if not all_files and search_query is None and starred is None and not deleted:
            if folder_id:
                query = query.filter(FileItem.folder_id == folder_id)
            else:
                query = query.filter(FileItem.folder_id == None)

        # Search filter
        if search_query:
            clean_search = f"%{search_query.strip()}%"
            query = query.filter(FileItem.original_name.ilike(clean_search))

        # Sorting
        sort_col = getattr(FileItem, sort_by, FileItem.created_at)
        if sort_order.lower() == "asc":
            query = query.order_by(sort_col.asc())
        else:
            query = query.order_by(sort_col.desc())

        total = query.count()
        total_pages = max(1, (total + page_size - 1) // page_size)
        items = query.offset((page - 1) * page_size).limit(page_size).all()

        return FileListResponse(
            items=[FileResponse.model_validate(item) for item in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )

    @staticmethod
    def update_file(db: Session, user: User, file_id: str, req: FileUpdateRequest) -> FileResponse:
        file_item = FileService.get_file(db, user, file_id)

        if req.original_name is not None:
            clean_name = sanitize_filename(req.original_name)
            if not clean_name:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid filename")
            try:
                new_key = storage_engine.rename_physical_file(file_item.internal_storage_key, clean_name)
                file_item.internal_storage_key = new_key
                file_item.original_name = Path(new_key).name
            except Exception as e:
                logger.warning(f"Could not rename physical file: {e}")
                file_item.original_name = clean_name

        if req.folder_id is not None:
            new_folder_path = ""
            if req.folder_id != "":
                folder = db.query(Folder).filter(
                    Folder.id == req.folder_id,
                    Folder.owner_id == user.id
                ).first()
                if not folder:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target folder not found")
                file_item.folder_id = req.folder_id
                crumbs = folder_service.get_breadcrumbs(db, folder)
                new_folder_path = "/".join(c.name for c in crumbs if c.id is not None)
            else:
                file_item.folder_id = None

            try:
                new_key = storage_engine.move_physical_file(file_item.internal_storage_key, user.username, new_folder_path)
                file_item.internal_storage_key = new_key
            except Exception as e:
                logger.warning(f"Could not move physical file: {e}")

        if req.is_starred is not None:
            file_item.is_starred = req.is_starred

        if req.is_deleted is not None:
            file_item.is_deleted = req.is_deleted
            file_item.deleted_at = datetime.now(timezone.utc) if req.is_deleted else None

        file_item.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(file_item)

        return FileResponse.model_validate(file_item)

    @staticmethod
    def purge_file(db: Session, user: User, file_id: str) -> None:
        """Permanently purges a file and deletes its physical content from disk."""
        file_item = FileService.get_file(db, user, file_id)
        
        # Physically delete
        storage_engine.delete_physical_file(file_item.internal_storage_key)
        
        # Remove DB record
        db.delete(file_item)
        db.commit()
        logger.info(f"File purged permanently: id={file_id}")

    @staticmethod
    def build_file_stream_response(
        file_item: FileItem,
        range_header: Optional[str] = None,
        is_preview: bool = False
    ) -> Response:
        """
        Constructs a streaming response with proper headers, supporting Byte-Range requests.
        """
        file_size = file_item.size_bytes
        content_type = file_item.mime_type or "application/octet-stream"
        
        # Content Disposition
        disposition_type = "inline" if is_preview else "attachment"
        # RFC 5987 encoded filename
        safe_filename = file_item.original_name.replace('"', '\\"')
        headers = {
            "Content-Disposition": f'{disposition_type}; filename="{safe_filename}"',
            "Accept-Ranges": "bytes",
            "X-Content-Type-Options": "nosniff",
        }

        # Handle Range requests
        if range_header and range_header.startswith("bytes="):
            try:
                ranges = range_header.replace("bytes=", "").split("-")
                start = int(ranges[0]) if ranges[0] else 0
                end = int(ranges[1]) if len(ranges) > 1 and ranges[1] else file_size - 1
                end = min(end, file_size - 1)

                if start > end or start >= file_size:
                    raise HTTPException(
                        status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
                        headers={"Content-Range": f"bytes */{file_size}"}
                    )

                content_length = end - start + 1
                headers["Content-Range"] = f"bytes {start}-{end}/{file_size}"
                headers["Content-Length"] = str(content_length)

                stream = storage_engine.stream_file_chunks(
                    file_item.internal_storage_key,
                    start_byte=start,
                    end_byte=end
                )

                return StreamingResponse(
                    stream,
                    status_code=status.HTTP_206_PARTIAL_CONTENT,
                    headers=headers,
                    media_type=content_type
                )
            except (ValueError, IndexError):
                pass  # Fall back to full stream

        headers["Content-Length"] = str(file_size)
        stream = storage_engine.stream_file_chunks(
            file_item.internal_storage_key,
            start_byte=0,
            end_byte=file_size - 1
        )
        return StreamingResponse(
            stream,
            status_code=status.HTTP_200_OK,
            headers=headers,
            media_type=content_type
        )

    @staticmethod
    def get_storage_analytics(db: Session, user: User) -> StorageUsageResponse:
        """Returns storage metrics, file counts, and distribution by categories."""
        user_used = FileService.get_user_storage_usage(db, user)
        quota = FileService.get_user_quota(user)
        file_count = db.query(FileItem).filter(FileItem.owner_id == user.id, FileItem.is_deleted == False).count()
        folder_count = db.query(Folder).filter(Folder.owner_id == user.id).count()

        disk_info = storage_engine.get_disk_usage()

        # Group by MIME categories
        files = db.query(FileItem.mime_type, FileItem.size_bytes).filter(
            FileItem.owner_id == user.id,
            FileItem.is_deleted == False
        ).all()

        category_stats: Dict[str, Dict[str, int]] = {
            "images": {"count": 0, "size": 0},
            "videos": {"count": 0, "size": 0},
            "audio": {"count": 0, "size": 0},
            "documents": {"count": 0, "size": 0},
            "archives": {"count": 0, "size": 0},
            "other": {"count": 0, "size": 0},
        }

        for mime, size in files:
            mime = (mime or "").lower()
            if mime.startswith("image/"):
                cat = "images"
            elif mime.startswith("video/"):
                cat = "videos"
            elif mime.startswith("audio/"):
                cat = "audio"
            elif (
                mime.startswith("text/") or
                "pdf" in mime or
                "word" in mime or
                "sheet" in mime or
                "presentation" in mime or
                "document" in mime
            ):
                cat = "documents"
            elif "zip" in mime or "tar" in mime or "rar" in mime or "7z" in mime or "gzip" in mime:
                cat = "archives"
            else:
                cat = "other"

            category_stats[cat]["count"] += 1
            category_stats[cat]["size"] += size

        categories = [
            FileTypeDistribution(category=k, count=v["count"], size_bytes=v["size"])
            for k, v in category_stats.items()
        ]

        usage_pct = round((user_used / quota * 100) if quota > 0 else 0, 2)

        return StorageUsageResponse(
            user_used_bytes=user_used,
            user_quota_bytes=quota,
            user_usage_percentage=min(100.0, usage_pct),
            file_count=file_count,
            folder_count=folder_count,
            disk_total_bytes=disk_info["total_bytes"],
            disk_free_bytes=disk_info["free_bytes"],
            disk_used_bytes=disk_info["used_bytes"],
            categories=categories
        )

file_service = FileService()
