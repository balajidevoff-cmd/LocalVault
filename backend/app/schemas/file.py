from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

class FileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    folder_id: Optional[str] = None
    original_name: str
    mime_type: str
    size_bytes: int
    checksum_sha256: str
    is_starred: bool
    is_deleted: bool
    deleted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

class FileUpdateRequest(BaseModel):
    original_name: Optional[str] = Field(None, min_length=1, max_length=255)
    folder_id: Optional[str] = None  # Move to another folder (or None for root)
    is_starred: Optional[bool] = None
    is_deleted: Optional[bool] = None  # Trash or Restore

class FileListResponse(BaseModel):
    items: List[FileResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
