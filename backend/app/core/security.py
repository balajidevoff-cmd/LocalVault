import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Union
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

from app.core.config import settings

# Initialize Argon2id password hasher with secure defaults
ph = PasswordHasher(
    time_cost=3,
    memory_cost=65536,  # 64 MB
    parallelism=4,
    hash_len=32,
    salt_len=16
)

def hash_password(password: str) -> str:
    """Hashes a plain password using Argon2id."""
    return ph.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against an Argon2id hash."""
    try:
        return ph.verify(hashed_password, plain_password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False

def hash_token(token: str) -> str:
    """Computes a SHA-256 hash of a raw session or share token for safe database storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def generate_secure_token(nbytes: int = 48) -> str:
    """Generates an unguessable URL-safe token."""
    return secrets.token_urlsafe(nbytes)

def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Creates a short-lived signed JWT access token."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode: Dict[str, Any] = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access"
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and validates a signed JWT access token. Returns claims dict or None."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload
    except (jwt.PyJWTError, ValueError):
        return None

def sanitize_filename(filename: str) -> str:
    r"""
    Sanitizes user-provided filename:
    - Removes path separators (/ and \)
    - Strips null bytes
    - Normalizes leading/trailing spaces and dots to prevent hidden/escaping files
    - Retains Unicode characters safely
    """
    if not filename:
        return "unnamed_file"
    # Extract basename to strip directories first
    basename = filename.replace("\\", "/").split("/")[-1]
    # Remove null bytes and control characters
    clean = basename.replace("\x00", "")
    clean = re.sub(r'[\x00-\x1f\x7f]', '', clean)
    # Strip dangerous characters for Windows filesystems: : * ? " < > | / \
    clean = re.sub(r'[:*?"<>|/\\]', '_', clean)
    # Collapse multiple dots to prevent .. traversal tokens
    clean = re.sub(r'\.{2,}', '_', clean)
    # Prevent hidden files or trailing dots/spaces
    clean = clean.strip(". ")
    if not clean:
        return "unnamed_file"

    # Neutralize Windows reserved device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
    stem = clean.split(".")[0].upper()
    if stem in {"CON", "PRN", "AUX", "NUL"} or re.match(r'^(COM|LPT)[1-9]$', stem):
        clean = f"_{clean}"

    # Limit length to 255 chars
    return clean[:255]
