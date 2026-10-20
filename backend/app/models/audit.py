import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship
from app.db.database import Base

class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    admin_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    admin_username = Column(String(64), nullable=False)
    target_user_id = Column(String(36), nullable=True, index=True)
    target_username = Column(String(64), nullable=True)
    file_id = Column(String(36), nullable=True, index=True)
    filename = Column(String(255), nullable=False)
    action = Column(String(50), nullable=False)  # "trash_file", "purge_file", "update_quota"
    result = Column(String(20), nullable=False)  # "success", "error"
    details = Column(String(512), nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    admin = relationship("User", foreign_keys=[admin_id])
