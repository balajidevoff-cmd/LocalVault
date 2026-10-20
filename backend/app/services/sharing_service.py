from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple
from fastapi import HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.logging_config import logger
from app.core.security import (
    generate_secure_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.models.file import FileItem
from app.models.share import ShareLink
from app.models.user import User
from app.schemas.share import PublicShareMetadata, ShareCreateRequest, ShareResponse
from app.services.file_service import file_service

class SharingService:
    @staticmethod
    def create_share(db: Session, user: User, req: ShareCreateRequest) -> ShareResponse:
        file_item = db.query(FileItem).filter(
            FileItem.id == req.file_id,
            FileItem.owner_id == user.id,
            FileItem.is_deleted == False
        ).first()

        if not file_item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found or access denied"
            )

        raw_token = generate_secure_token(32)
        token_hash = hash_token(raw_token)

        expires_at = None
        if req.expires_in_hours:
            expires_at = datetime.now(timezone.utc) + timedelta(hours=req.expires_in_hours)

        pwd_hash = hash_password(req.password) if req.password else None

        share = ShareLink(
            file_id=file_item.id,
            owner_id=user.id,
            token_hash=token_hash,
            permission=req.permission,
            password_hash=pwd_hash,
            expires_at=expires_at
        )
        db.add(share)
        db.commit()
        db.refresh(share)

        res = ShareResponse(
            id=share.id,
            file_id=share.file_id,
            owner_id=share.owner_id,
            permission=share.permission,
            has_password=bool(share.password_hash),
            expires_at=share.expires_at,
            revoked_at=share.revoked_at,
            access_count=share.access_count,
            created_at=share.created_at,
            raw_token=raw_token,
            share_url=f"/share/{raw_token}"
        )
        logger.info(f"Created share link id={share.id} for file={file_item.id}")
        return res

    @staticmethod
    def list_user_shares(db: Session, user: User) -> List[ShareResponse]:
        shares = db.query(ShareLink).filter(
            ShareLink.owner_id == user.id,
            ShareLink.revoked_at == None
        ).order_by(ShareLink.created_at.desc()).all()

        return [
            ShareResponse(
                id=s.id,
                file_id=s.file_id,
                owner_id=s.owner_id,
                permission=s.permission,
                has_password=bool(s.password_hash),
                expires_at=s.expires_at,
                revoked_at=s.revoked_at,
                access_count=s.access_count,
                created_at=s.created_at,
                share_url=None,
                raw_token=None
            )
            for s in shares
        ]

    @staticmethod
    def revoke_share(db: Session, user: User, share_id: str) -> None:
        share = db.query(ShareLink).filter(
            ShareLink.id == share_id,
            ShareLink.owner_id == user.id
        ).first()

        if not share:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Share link not found"
            )

        share.revoked_at = datetime.now(timezone.utc)
        db.commit()
        logger.info(f"Revoked share link {share_id}")

    @staticmethod
    def get_public_share(db: Session, raw_token: str) -> Tuple[ShareLink, FileItem]:
        hashed = hash_token(raw_token)
        share = db.query(ShareLink).filter(ShareLink.token_hash == hashed).first()

        if not share or share.revoked_at is not None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Share link is invalid or has expired"
            )

        if share.expires_at:
            exp = share.expires_at
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp < datetime.now(timezone.utc):
                raise HTTPException(
                    status_code=status.HTTP_410_GONE,
                    detail="This share link has expired"
                )

        file_item = db.query(FileItem).filter(
            FileItem.id == share.file_id,
            FileItem.is_deleted == False
        ).first()

        if not file_item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Shared file no longer exists"
            )

        return share, file_item

    @staticmethod
    def get_public_metadata(db: Session, raw_token: str) -> PublicShareMetadata:
        share, file_item = SharingService.get_public_share(db, raw_token)
        return PublicShareMetadata(
            token=raw_token,
            filename=file_item.original_name,
            size_bytes=file_item.size_bytes,
            mime_type=file_item.mime_type,
            permission=share.permission,
            requires_password=bool(share.password_hash),
            expires_at=share.expires_at,
            created_at=share.created_at
        )

    @staticmethod
    def download_public_share(
        db: Session,
        raw_token: str,
        password: Optional[str] = None,
        range_header: Optional[str] = None
    ) -> Response:
        share, file_item = SharingService.get_public_share(db, raw_token)

        if share.password_hash:
            if not password or not verify_password(password, share.password_hash):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Password required or incorrect for this share"
                )

        # Increment access count
        share.access_count += 1
        db.commit()

        is_preview = (share.permission == "view")
        return file_service.build_file_stream_response(
            file_item=file_item,
            range_header=range_header,
            is_preview=is_preview
        )

sharing_service = SharingService()
