from datetime import datetime, timedelta, UTC
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from cryptography.fernet import Fernet
import os
import uuid
from sqlalchemy.orm import Session
from .config import settings
from app.crud.token_blacklist import token_blacklist_crud


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against a hashed password.
    Uses bcrypt directly to avoid version detection issues.
    Truncates passwords longer than 72 bytes to match hashing behavior.
    """
    try:
        # Bcrypt truncates passwords after 72 bytes, so truncate before verification too
        password_bytes = plain_password.encode("utf-8")
        if len(password_bytes) > 72:
            password_bytes = password_bytes[:72]
            plain_password = password_bytes.decode("utf-8", errors="ignore")

        return bcrypt.checkpw(
            plain_password.encode("utf-8"), hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """
    Hash a password with bcrypt, handling passwords longer than 72 bytes.
    Bcrypt truncates passwords at 72 bytes, so we'll hash the first 72 bytes.
    """
    # Bcrypt truncates passwords after 72 bytes
    # First, encode to bytes and limit to 72 bytes
    password_bytes = password.encode("utf-8")
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
        # Decode back to string, handling any truncated multi-byte characters
        password = password_bytes.decode("utf-8", errors="ignore")
    else:
        # Use original password if it's not longer than 72 bytes
        password = password

    # Use bcrypt directly to avoid version detection issues
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_access_token(
    data: dict, expires_delta: Optional[timedelta] = None
) -> tuple[str, str]:
    """Create access token with JWT ID for tracking.

    Returns:
        tuple[str, str]: (encoded_jwt, token_jti)
    """
    to_encode = data.copy()

    # Generate unique JWT ID for tracking
    token_jti = str(uuid.uuid4())

    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update(
        {
            "exp": expire,
            "jti": token_jti,  # Add JWT ID for tracking
        }
    )

    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )

    return encoded_jwt, token_jti


def verify_token(token: str, db: Session = None):
    """Verify JWT token and check against blacklist.

    Args:
        token: JWT token to verify
        db: Database session for blacklist check

    Returns:
        Optional[str]: User ID if valid and not blacklisted, None otherwise
    """
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )

        user_id = payload.get("sub")
        token_jti = payload.get("jti")

        if not user_id or not token_jti:
            print(f"DEBUG: Missing sub or jti. user_id={user_id}, jti={token_jti}")
            return None

        # Check if token is blacklisted
        if db and token_blacklist_crud.is_token_blacklisted(db, token_jti=token_jti):
            print(f"DEBUG: Token blacklisted. jti={token_jti}")
            return None

        return user_id
    except JWTError as e:
        print(f"DEBUG: JWTError: {e}")
        return None


def extract_token_jti(token: str) -> Optional[str]:
    """Extract JWT ID from token without full validation.

    Used for blacklist operations where we need jti from potentially invalid tokens.

    Args:
        token: JWT token to extract jti from

    Returns:
        Optional[str]: JWT ID if present, None otherwise
    """
    try:
        # Decode without signature validation to extract jti
        unverified = jwt.decode(
            token, settings.SECRET_KEY, options={"verify_signature": False}
        )
        return unverified.get("jti")
    except JWTError:
        return None


def get_token_expires_at(token: str) -> Optional[datetime]:
    """Get token expiration time from token.

    Args:
        token: JWT token to extract expiration from

    Returns:
        Optional[datetime]: Expiration time if present, None otherwise
    """
    try:
        # Decode without signature validation to extract exp
        unverified = jwt.decode(
            token, settings.SECRET_KEY, options={"verify_signature": False}
        )
        exp_timestamp = unverified.get("exp")
        if exp_timestamp:
            return datetime.fromtimestamp(exp_timestamp, tz=UTC)
        return None
    except (JWTError, ValueError):
        return None


# Encryption for API keys
def get_fernet_key() -> bytes:
    """Get or generate a Fernet key for encryption."""
    key = settings.FERNET_KEY or os.getenv("FERNET_KEY")
    if not key:
        raise ValueError(
            "FERNET_KEY environment variable is required for API key encryption"
        )
    return key.encode()


def encrypt_api_key(api_key: str) -> str:
    """Encrypt an API key."""
    fernet = Fernet(get_fernet_key())
    return fernet.encrypt(api_key.encode()).decode()


def decrypt_api_key(encrypted_key: str) -> str:
    """Decrypt an API key."""
    fernet = Fernet(get_fernet_key())
    return fernet.decrypt(encrypted_key.encode()).decode()
