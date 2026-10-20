from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

class FolderCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    parent_folder_id: Optional[str] = None

class FolderUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    parent_folder_id: Optional[str] = None

class BreadcrumbItem(BaseModel):
    id: Optional[str] = None
    name: str

class FolderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    owner_id: str
    parent_folder_id: Optional[str] = None
    name: str
    created_at: datetime
    updated_at: datetime
    breadcrumbs: Optional[List[BreadcrumbItem]] = None

class FolderDetailResponse(FolderResponse):
    item_count: int = 0
    total_size_bytes: int = 0
