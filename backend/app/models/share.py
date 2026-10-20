import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from app.db.database import Base

class ShareLink(Base):
    __tablename__ = "share_links"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    file_id = Column(String(36), ForeignKey("files.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    shared_with_user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    permission = Column(String(20), default="view", nullable=False)  # "view" or "download"
    password_hash = Column(String(255), nullable=True)  # Optional password protection
    expires_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    access_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    file = relationship("FileItem", back_populates="shares")
    owner = relationship("User", foreign_keys=[owner_id], back_populates="shares")
    shared_with_user = relationship("User", foreign_keys=[shared_with_user_id], back_populates="received_shares")
