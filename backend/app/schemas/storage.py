from typing import Dict, List, Optional
from pydantic import BaseModel

class FileTypeDistribution(BaseModel):
    category: str  # e.g. "images", "documents", "audio", "video", "archives", "other"
    count: int
    size_bytes: int

class StorageUsageResponse(BaseModel):
    user_used_bytes: int
    user_quota_bytes: int
    user_usage_percentage: float
    file_count: int
    folder_count: int
    disk_total_bytes: int
    disk_free_bytes: int
    disk_used_bytes: int
    categories: List[FileTypeDistribution]

class StorageStatusResponse(BaseModel):
    storage_root: str
    status: str
    disk_total_bytes: int
    disk_free_bytes: int
    disk_used_bytes: int
    writable: bool
    db_connected: bool
