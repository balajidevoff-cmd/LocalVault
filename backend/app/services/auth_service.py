from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging_config import logger
from app.core.security import (
    create_access_token,
    generate_secure_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.models.session import RefreshSession
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, RegisterRequest

class AuthService:
    @staticmethod
    def register_user(db: Session, req: RegisterRequest) -> User:
        """
        Registers a new user. If this is the very first user in the database,
        automatically promote them to administrator.
        """
        if not settings.ALLOW_REGISTRATION:
            user_count = db.query(User).count()
            if user_count > 0:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Public registration is currently disabled by administrator"
                )

        # Check existing username
        if db.query(User).filter(User.username == req.username).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username is already taken"
            )

        # Check existing email
        if db.query(User).filter(User.email == req.email).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email address is already registered"
            )

        # If zero users in database, make first user an admin
        existing_users = db.query(User).count()
        role = "admin" if existing_users == 0 else "user"

        new_user = User(
            username=req.username,
            email=req.email,
            password_hash=hash_password(req.password),
            role=role,
            is_active=True,
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        logger.info(f"User registered successfully: id={new_user.id} role={new_user.role}")
        return new_user

    @staticmethod
    def authenticate_user(
        db: Session,
        login_req: LoginRequest,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> Tuple[User, str, str]:
        """
        Validates credentials and creates access token and refresh session.
        Returns (user, access_token, raw_refresh_token).
        """
        user = db.query(User).filter(
            (User.username == login_req.username_or_email) | (User.email == login_req.username_or_email)
        ).first()

        if not user or not verify_password(login_req.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password"
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This account has been deactivated"
            )

        user.last_login_at = datetime.now(timezone.utc)
        
        # Create access token
        access_token = create_access_token(subject=user.id)

        # Create refresh session
        raw_refresh_token = generate_secure_token(48)
        refresh_expires = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        
        session_record = RefreshSession(
            user_id=user.id,
            token_hash=hash_token(raw_refresh_token),
            user_agent=user_agent[:255] if user_agent else None,
            ip_address=ip_address[:45] if ip_address else None,
            expires_at=refresh_expires
        )
        db.add(session_record)
        db.commit()

        logger.info(f"User login successful: id={user.id}")
        return user, access_token, raw_refresh_token

    @staticmethod
    def refresh_access_token(db: Session, raw_refresh_token: str) -> Tuple[User, str, str]:
        """
        Validates refresh token, rotates it, and issues a new access token.
        """
        hashed = hash_token(raw_refresh_token)
        session_record = db.query(RefreshSession).filter(
            RefreshSession.token_hash == hashed
        ).first()

        if not session_record:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token"
            )

        if session_record.revoked_at is not None:
            # RFC 6819 Token Reuse Detection: Indicates potential token theft.
            # Revoke all remaining active sessions for this account to contain the breach.
            now = datetime.now(timezone.utc)
            db.query(RefreshSession).filter(
                RefreshSession.user_id == session_record.user_id,
                RefreshSession.revoked_at == None
            ).update({"revoked_at": now})
            db.commit()
            logger.warning(
                f"SECURITY ALERT: Re-use of revoked refresh token detected for user_id={session_record.user_id}. "
                "All sessions for this user have been terminated."
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Security violation: Token reuse detected. All active sessions have been terminated."
            )

        now = datetime.now(timezone.utc)
        # Handle naive or aware datetime from sqlite
        expires_at = session_record.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if expires_at < now:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has expired"
            )

        user = db.query(User).filter(User.id == session_record.user_id).first()
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is inactive or not found"
            )

        # Revoke old session and issue new rotated refresh token
        session_record.revoked_at = now
        new_raw_refresh = generate_secure_token(48)
        new_session = RefreshSession(
            user_id=user.id,
            token_hash=hash_token(new_raw_refresh),
            user_agent=session_record.user_agent,
            ip_address=session_record.ip_address,
            expires_at=now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        )
        db.add(new_session)

        new_access_token = create_access_token(subject=user.id)
        db.commit()

        return user, new_access_token, new_raw_refresh

    @staticmethod
    def revoke_session(db: Session, raw_refresh_token: str) -> None:
        """Revokes a refresh token session on logout."""
        hashed = hash_token(raw_refresh_token)
        session_record = db.query(RefreshSession).filter(
            RefreshSession.token_hash == hashed
        ).first()
        if session_record:
            session_record.revoked_at = datetime.now(timezone.utc)
            db.commit()

    @staticmethod
    def change_password(db: Session, user: User, req: ChangePasswordRequest) -> None:
        """Verifies current password and updates to new password, revoking old sessions."""
        if not verify_password(req.current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password verification failed"
            )

        user.password_hash = hash_password(req.new_password)
        # Revoke all existing sessions for this user
        db.query(RefreshSession).filter(
            RefreshSession.user_id == user.id,
            RefreshSession.revoked_at == None
        ).update({"revoked_at": datetime.now(timezone.utc)})
        
        db.commit()
        logger.info(f"Password updated and sessions revoked for user={user.id}")

auth_service = AuthService()
