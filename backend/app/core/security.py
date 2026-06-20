from datetime import datetime, timedelta, UTC
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from cryptography.fernet import Fernet
import os
import uuid
import logging
from sqlalchemy.orm import Session
from .config import settings
from app.crud.token_blacklist import token_blacklist_crud


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8")[:72], hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


def create_access_token(
    data: dict, expires_delta: Optional[timedelta] = None
) -> tuple[str, str]:
    to_encode = data.copy()
    token_jti = str(uuid.uuid4())

    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    now = datetime.now(UTC)
    to_encode.update({"exp": expire, "iat": now, "jti": token_jti})

    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )

    return encoded_jwt, token_jti


def verify_token(token: str, db: Session = None):
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )

        user_id = payload.get("sub")
        token_jti = payload.get("jti")

        if not user_id or not token_jti:
            logging.warning(
                f"Token missing sub or jti. user_id={user_id}, jti={token_jti}"
            )
            return None

        if db and token_blacklist_crud.is_token_blacklisted(db, token_jti=token_jti):
            logging.info(f"Token blacklisted: jti={token_jti}")
            return None

        return user_id
    except JWTError as e:
        logging.warning(f"JWT validation error: {e}")
        return None


def get_token_issued_at(token: str) -> Optional[datetime]:
    """Extract the iat (issued at) claim from a token."""
    try:
        unverified = jwt.decode(
            token, settings.SECRET_KEY, options={"verify_signature": False}
        )
        iat_timestamp = unverified.get("iat")
        if iat_timestamp:
            return datetime.fromtimestamp(iat_timestamp, tz=UTC)
        return None
    except (JWTError, ValueError):
        return None


def extract_token_jti(token: str) -> Optional[str]:
    try:
        unverified = jwt.decode(
            token, settings.SECRET_KEY, options={"verify_signature": False}
        )
        return unverified.get("jti")
    except JWTError:
        return None


def get_token_expires_at(token: str) -> Optional[datetime]:
    try:
        unverified = jwt.decode(
            token, settings.SECRET_KEY, options={"verify_signature": False}
        )
        exp_timestamp = unverified.get("exp")
        if exp_timestamp:
            return datetime.fromtimestamp(exp_timestamp, tz=UTC)
        return None
    except (JWTError, ValueError):
        return None


def get_fernet_key() -> bytes:
    key = settings.FERNET_KEY or os.getenv("FERNET_KEY")
    if not key:
        raise ValueError(
            "FERNET_KEY environment variable is required for API key encryption"
        )
    return key.encode()


def encrypt_api_key(api_key: str) -> str:
    fernet = Fernet(get_fernet_key())
    return fernet.encrypt(api_key.encode()).decode()


def decrypt_api_key(encrypted_key: str) -> str:
    fernet = Fernet(get_fernet_key())
    return fernet.decrypt(encrypted_key.encode()).decode()
