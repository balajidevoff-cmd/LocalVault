from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict

class AdminFileItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    original_name: str
    size_bytes: int
    mime_type: str
    owner_id: str
    owner_username: str
    owner_email: str
    is_deleted: bool
    is_starred: bool
    created_at: datetime
    updated_at: datetime

class AdminUserItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    email: str
    role: str
    is_active: bool
    used_storage_bytes: int
    quota_bytes: int
    file_count: int
    created_at: datetime

class AdminFileListResponse(BaseModel):
    items: List[AdminFileItem]
    total: int
    page: int
    page_size: int
    total_pages: int

class AdminAuditLogItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    admin_id: Optional[str] = None
    admin_username: str
    target_user_id: Optional[str] = None
    target_username: Optional[str] = None
    file_id: Optional[str] = None
    filename: str
    action: str
    result: str
    details: Optional[str] = None
    timestamp: datetime

class AdminDeleteResponse(BaseModel):
    file_id: str
    filename: str
    owner_username: str
    action: str
    message: str

class AdminStatsResponse(BaseModel):
    total_users: int
    total_files: int
    total_storage_bytes: int
    disk_free_bytes: int
    disk_total_bytes: int
