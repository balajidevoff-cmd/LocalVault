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
from app.schemas.share import PublicShareMetadata, ShareCreateRequest, ShareResponse, SharedWithMeItem
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

        target_user = None
        if req.share_with_username or req.share_with_email:
            query = db.query(User)
            if req.share_with_username:
                query = query.filter(User.username == req.share_with_username.strip())
            elif req.share_with_email:
                query = query.filter(User.email == req.share_with_email.strip())
            
            target_user = query.first()
            if not target_user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Recipient user '{req.share_with_username or req.share_with_email}' not found"
                )
            if target_user.id == user.id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot share a file with yourself"
                )

            # Prevent duplicate active shares for the same file and recipient
            existing_share = db.query(ShareLink).filter(
                ShareLink.file_id == file_item.id,
                ShareLink.owner_id == user.id,
                ShareLink.shared_with_user_id == target_user.id,
                ShareLink.revoked_at == None
            ).first()

            if existing_share:
                # Update permission and expiration instead of creating duplicate
                existing_share.permission = req.permission
                if req.expires_in_hours:
                    existing_share.expires_at = datetime.now(timezone.utc) + timedelta(hours=req.expires_in_hours)
                else:
                    existing_share.expires_at = None
                db.commit()
                db.refresh(existing_share)
                return ShareResponse(
                    id=existing_share.id,
                    file_id=existing_share.file_id,
                    owner_id=existing_share.owner_id,
                    permission=existing_share.permission,
                    has_password=bool(existing_share.password_hash),
                    expires_at=existing_share.expires_at,
                    revoked_at=existing_share.revoked_at,
                    access_count=existing_share.access_count,
                    created_at=existing_share.created_at,
                    raw_token=None,
                    share_url=None,
                    shared_with_user_id=target_user.id,
                    shared_with_username=target_user.username,
                    file_name=file_item.original_name
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
            shared_with_user_id=target_user.id if target_user else None,
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
            share_url=f"/share/{raw_token}" if not target_user else None,
            shared_with_user_id=target_user.id if target_user else None,
            shared_with_username=target_user.username if target_user else None,
            file_name=file_item.original_name
        )
        logger.info(f"Created share link id={share.id} for file={file_item.id} (target_user={target_user.username if target_user else 'public'})")
        return res

    @staticmethod
    def list_user_shares(db: Session, user: User) -> List[ShareResponse]:
        shares = db.query(ShareLink).filter(
            ShareLink.owner_id == user.id,
            ShareLink.revoked_at == None
        ).order_by(ShareLink.created_at.desc()).all()

        results = []
        for s in shares:
            target_username = s.shared_with_user.username if s.shared_with_user else None
            filename = s.file.original_name if s.file else "Deleted File"
            results.append(
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
                    raw_token=None,
                    shared_with_user_id=s.shared_with_user_id,
                    shared_with_username=target_username,
                    file_name=filename
                )
            )
        return results

    @staticmethod
    def list_shared_with_me(db: Session, user: User) -> List[SharedWithMeItem]:
        now = datetime.now(timezone.utc)
        shares = db.query(ShareLink).join(FileItem).filter(
            ShareLink.shared_with_user_id == user.id,
            ShareLink.revoked_at == None,
            FileItem.is_deleted == False
        ).order_by(ShareLink.created_at.desc()).all()

        items = []
        for s in shares:
            if s.expires_at:
                exp = s.expires_at
                if exp.tzinfo is None:
                    exp = exp.replace(tzinfo=timezone.utc)
                if exp < now:
                    continue  # Expired

            if not s.file or s.file.is_deleted:
                continue

            owner_name = s.owner.username if s.owner else "Unknown"
            items.append(
                SharedWithMeItem(
                    share_id=s.id,
                    file_id=s.file.id,
                    file_name=s.file.original_name,
                    size_bytes=s.file.size_bytes,
                    mime_type=s.file.mime_type,
                    owner_id=s.owner_id,
                    owner_username=owner_name,
                    permission=s.permission,
                    created_at=s.created_at,
                    expires_at=s.expires_at
                )
            )
        return items

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
