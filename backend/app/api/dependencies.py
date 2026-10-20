import time
from collections import defaultdict
from typing import Dict, List, Optional
from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging_config import logger
from app.core.security import decode_access_token
from app.db.database import get_db
from app.models.user import User

# In-memory sliding-window rate limiter for sensitive endpoints
class SimpleRateLimiter:
    def __init__(self, requests_per_minute: int = 30):
        self.rpm = requests_per_minute
        self.history: Dict[str, List[float]] = defaultdict(list)

    def check(self, request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        if client_ip == "testclient" or settings.ENVIRONMENT == "test":
            return
        now = time.time()
        window_start = now - 60.0

        # Purge timestamps older than 1 minute
        self.history[client_ip] = [t for t in self.history[client_ip] if t > window_start]

        if len(self.history[client_ip]) >= self.rpm:
            logger.warning(f"Rate limit exceeded for IP: {client_ip}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please slow down and try again later."
            )

        self.history[client_ip].append(now)

login_limiter = SimpleRateLimiter(requests_per_minute=20)
upload_limiter = SimpleRateLimiter(requests_per_minute=120)
share_limiter = SimpleRateLimiter(requests_per_minute=30)

def get_current_user(
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
    access_token_cookie: Optional[str] = Cookie(None, alias="localvault_access_token")
) -> User:
    """
    Extracts and validates JWT bearer token from Authorization header or HttpOnly cookie.
    """
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    elif access_token_cookie:
        token = access_token_cookie

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"}
        )

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token claims"
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )

    return user

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Ensures the authenticated user has the administrator role."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator privileges required"
        )
    return current_user
