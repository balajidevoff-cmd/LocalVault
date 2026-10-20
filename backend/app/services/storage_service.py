import hashlib
import os
import shutil
import uuid
from pathlib import Path
from typing import AsyncGenerator, BinaryIO, Generator, Optional, Tuple
from fastapi import HTTPException, UploadFile, status

from app.core.config import settings
from app.core.logging_config import logger
from app.core.security import sanitize_filename

class StorageEngine:
    def __init__(self, base_path: Optional[Path] = None):
        self.root: Path = (base_path or settings.LOCALVAULT_STORAGE_PATH).resolve()
        self.tmp_dir: Path = self.root / ".tmp"
        self.files_dir: Path = self.root / "objects"
        
        # Ensure base directories exist
        self.tmp_dir.mkdir(parents=True, exist_ok=True)
        self.files_dir.mkdir(parents=True, exist_ok=True)

    def get_disk_usage(self) -> dict:
        """
        Calculates physical disk capacity and free space on the host volume (e.g. 512 GB SSD).
        """
        try:
            total, used, free = shutil.disk_usage(str(self.root))
            return {
                "total_bytes": total,
                "used_bytes": used,
                "free_bytes": free,
            }
        except Exception as e:
            logger.error(f"Failed to check disk usage: {e}")
            return {
                "total_bytes": 0,
                "used_bytes": 0,
                "free_bytes": 0,
            }

    def _resolve_physical_path(self, internal_key: str) -> Path:
        """
        Resolves an internal key into a secure path within self.root.
        Supports human-readable paths (e.g. 'Balaji/water 2.jpg') as well
        as legacy sharded keys ('50719014ed2744fbbcccc5b63ca109dc').
        Enforces strict path containment to prevent path traversal.
        """
        if not internal_key or len(internal_key) < 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid storage key format"
            )

        # Normalize path separators
        clean_key = internal_key.replace("\\", "/").strip("/")

        # Check for path traversal elements
        parts = clean_key.split("/")
        if any(p == ".." or p == "." or not p for p in parts):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Path traversal tokens are strictly forbidden"
            )

        # Check for legacy 32-char hex sharded keys
        if len(clean_key) == 32 and "/" not in clean_key and clean_key.isalnum():
            prefix1 = clean_key[:2]
            prefix2 = clean_key[2:4]
            legacy_path = (self.files_dir / prefix1 / prefix2 / clean_key).resolve()
            if legacy_path.is_file():
                return legacy_path

        file_path = (self.root / clean_key).resolve()

        # Strict containment verification
        try:
            file_path.relative_to(self.root)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access outside storage root is strictly forbidden"
            )

        return file_path

    async def save_upload_stream(
        self,
        upload_file: UploadFile,
        current_user_usage_bytes: int,
        user_quota_bytes: int,
        username: str = "default",
        folder_path: str = "",
        preferred_filename: Optional[str] = None
    ) -> Tuple[str, int, str, str]:
        """
        Streams an incoming upload to a temporary file on the local filesystem,
        computing SHA-256 and enforcing file size & disk quota limits on the fly.
        Upon success, atomically places the file into the user's readable storage directory
        with the original filename and file extension intact.
        Returns (internal_storage_key, size_bytes, sha256_checksum, final_filename).
        """
        disk_info = self.get_disk_usage()
        # Require at least 200 MB free physical disk safety margin
        safety_margin_bytes = 200 * 1024 * 1024
        if disk_info["free_bytes"] < safety_margin_bytes:
            raise HTTPException(
                status_code=status.HTTP_507_INSUFFICIENT_STORAGE,
                detail="Physical disk has insufficient free space on server host"
            )

        # Sanitize filename, retaining real extension
        raw_name = preferred_filename or upload_file.filename or "unnamed_file"
        clean_filename = sanitize_filename(raw_name)

        # Build user target folder on local SSD (e.g. data/storage/Balaji or data/storage/Balaji/Movies)
        clean_user = sanitize_filename(username or "default")
        target_dir = self.root / clean_user
        if folder_path:
            clean_sub = "/".join(sanitize_filename(p) for p in folder_path.replace("\\", "/").split("/") if p.strip())
            if clean_sub:
                target_dir = target_dir / clean_sub
        target_dir.mkdir(parents=True, exist_ok=True)

        # Handle duplicate filename in the target folder gracefully
        stem, ext = os.path.splitext(clean_filename)
        candidate = clean_filename
        counter = 1
        while (target_dir / candidate).exists():
            candidate = f"{stem} ({counter}){ext}"
            counter += 1
        final_filename = candidate
        final_path = target_dir / final_filename

        internal_key = str(final_path.relative_to(self.root)).replace("\\", "/")
        temp_file_path = self.tmp_dir / f"{uuid.uuid4().hex}.upload.tmp"

        sha256 = hashlib.sha256()
        bytes_written = 0
        chunk_size = settings.STREAM_CHUNK_SIZE_BYTES

        try:
            with open(temp_file_path, "wb", buffering=8 * 1024 * 1024) as f_out:
                while True:
                    chunk = await upload_file.read(chunk_size)
                    if not chunk:
                        break

                    bytes_written += len(chunk)

                    # Check max upload size
                    if bytes_written > settings.LOCALVAULT_MAX_UPLOAD_SIZE_BYTES:
                        raise HTTPException(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail=f"File exceeds maximum allowed upload size of {settings.LOCALVAULT_MAX_UPLOAD_SIZE_BYTES} bytes"
                        )

                    # Check personal user quota
                    if (current_user_usage_bytes + bytes_written) > user_quota_bytes:
                        raise HTTPException(
                            status_code=status.HTTP_507_INSUFFICIENT_STORAGE,
                            detail="Storage quota exceeded for this account"
                        )

                    # Check physical free disk space during streaming
                    if bytes_written > (disk_info["free_bytes"] - safety_margin_bytes):
                        raise HTTPException(
                            status_code=status.HTTP_507_INSUFFICIENT_STORAGE,
                            detail="Physical disk free space exhausted during upload"
                        )

                    sha256.update(chunk)
                    f_out.write(chunk)

            checksum = sha256.hexdigest()

            # Atomically place file with readable name & extension on local disk
            os.replace(str(temp_file_path), str(final_path))

            logger.info(f"Stored physical file: '{internal_key}' size={bytes_written} sha256={checksum[:8]}...")
            return internal_key, bytes_written, checksum, final_filename

        except Exception as e:
            # Clean up temporary file on any error
            if temp_file_path.exists():
                try:
                    temp_file_path.unlink()
                except OSError:
                    pass
            logger.error(f"Upload failed for {upload_file.filename}: {e}")
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Upload processing failed: {str(e)}"
            )

    def rename_physical_file(self, old_internal_key: str, new_name: str) -> str:
        """
        Renames the physical file on local disk while retaining its extension and format.
        Returns the updated internal_storage_key.
        """
        old_path = self.get_file_path(old_internal_key)
        clean_new_name = sanitize_filename(new_name)
        target_dir = old_path.parent

        stem, ext = os.path.splitext(clean_new_name)
        candidate = clean_new_name
        counter = 1
        while (target_dir / candidate).exists() and (target_dir / candidate) != old_path:
            candidate = f"{stem} ({counter}){ext}"
            counter += 1

        new_path = target_dir / candidate
        if old_path != new_path:
            os.replace(str(old_path), str(new_path))
        return str(new_path.relative_to(self.root)).replace("\\", "/")

    def move_physical_file(self, old_internal_key: str, username: str, new_folder_path: str = "") -> str:
        """
        Moves the physical file to a new folder directory on local disk.
        Returns the updated internal_storage_key.
        """
        old_path = self.get_file_path(old_internal_key)
        filename = old_path.name

        clean_user = sanitize_filename(username or "default")
        target_dir = self.root / clean_user
        if new_folder_path:
            clean_sub = "/".join(sanitize_filename(p) for p in new_folder_path.replace("\\", "/").split("/") if p.strip())
            if clean_sub:
                target_dir = target_dir / clean_sub
        target_dir.mkdir(parents=True, exist_ok=True)

        stem, ext = os.path.splitext(filename)
        candidate = filename
        counter = 1
        while (target_dir / candidate).exists() and (target_dir / candidate) != old_path:
            candidate = f"{stem} ({counter}){ext}"
            counter += 1

        new_path = target_dir / candidate
        if old_path != new_path:
            os.replace(str(old_path), str(new_path))
        return str(new_path.relative_to(self.root)).replace("\\", "/")

    def file_exists(self, internal_key: str) -> bool:
        """Checks if the physical file exists on local storage."""
        try:
            path = self._resolve_physical_path(internal_key)
            return path.is_file()
        except HTTPException:
            return False

    def get_file_path(self, internal_key: str) -> Path:
        """Returns the verified Path object for a given internal key."""
        path = self._resolve_physical_path(internal_key)
        if not path.is_file():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Physical file not found on local storage"
            )
        return path

    def delete_physical_file(self, internal_key: str) -> bool:
        """Deletes the physical file from disk safely."""
        try:
            path = self._resolve_physical_path(internal_key)
            if path.is_file():
                path.unlink()
                # Attempt to clean up empty parent directories if empty
                try:
                    if not any(path.parent.iterdir()):
                        path.parent.rmdir()
                except OSError:
                    pass
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to delete physical file {internal_key}: {e}")
            return False

    def stream_file_chunks(
        self,
        internal_key: str,
        start_byte: int = 0,
        end_byte: Optional[int] = None,
        chunk_size: int = settings.STREAM_CHUNK_SIZE_BYTES
    ) -> Generator[bytes, None, None]:
        """
        Generator for streaming file bytes without loading large files into memory.
        Supports HTTP Range requests.
        """
        path = self.get_file_path(internal_key)
        file_size = path.stat().st_size
        
        if end_byte is None or end_byte >= file_size:
            end_byte = file_size - 1

        if start_byte > end_byte or start_byte < 0:
            return

        with open(path, "rb") as f:
            f.seek(start_byte)
            remaining = end_byte - start_byte + 1
            while remaining > 0:
                current_chunk = min(chunk_size, remaining)
                data = f.read(current_chunk)
                if not data:
                    break
                remaining -= len(data)
                yield data

    def cleanup_abandoned_tmp_files(self, max_age_seconds: int = 86400) -> int:
        """
        Removes stranded temporary files older than max_age_seconds (default 24h).
        """
        import time
        count = 0
        now = time.time()
        for item in self.tmp_dir.glob("*.upload.tmp"):
            try:
                if now - item.stat().st_mtime > max_age_seconds:
                    item.unlink()
                    count += 1
            except OSError:
                pass
        return count

storage_engine = StorageEngine()
