from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

class ShareCreateRequest(BaseModel):
    file_id: str
    permission: str = Field("view", pattern="^(view|download)$")
    password: Optional[str] = Field(None, min_length=4, max_length=64)
    expires_in_hours: Optional[int] = Field(None, ge=1, le=8760)

class ShareResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    file_id: str
    owner_id: str
    permission: str
    has_password: bool
    expires_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    access_count: int
    created_at: datetime
    share_url: Optional[str] = None
    raw_token: Optional[str] = None  # Returned ONLY once upon creation

class PublicShareMetadata(BaseModel):
    token: str
    filename: str
    size_bytes: int
    mime_type: str
    permission: str
    requires_password: bool
    expires_at: Optional[datetime] = None
    created_at: datetime
