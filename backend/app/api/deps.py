import time
from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.crud.user import user
from app.core.security import verify_token
from app.models.user import User

_USER_CACHE_TTL = 600
_user_cache: dict[str, tuple[float, dict]] = {}


def _get_cached_user(user_id: int) -> User | None:
    entry = _user_cache.get(f"user:{user_id}")
    if entry is None:
        return None
    cached_at, user_dict = entry
    if time.time() - cached_at > _USER_CACHE_TTL:
        del _user_cache[f"user:{user_id}"]
        return None
    return _user_from_dict(user_dict)


def _set_cached_user(user_obj: User) -> None:
    _user_cache[f"user:{user_obj.id}"] = (
        time.time(),
        _user_to_dict(user_obj),
    )


def _user_to_dict(user_obj: User) -> dict:
    return {
        "id": user_obj.id,
        "email": user_obj.email,
        "hashed_password": user_obj.hashed_password,
        "is_active": user_obj.is_active,
        "messages_used": user_obj.messages_used,
        "custom_instructions": user_obj.custom_instructions,
    }


def _user_from_dict(d: dict) -> User:
    user_obj = User(
        id=d["id"],
        email=d["email"],
        hashed_password=d["hashed_password"],
    )
    user_obj.is_active = d.get("is_active", True)
    user_obj.messages_used = d.get("messages_used", 0)
    user_obj.custom_instructions = d.get("custom_instructions")
    return user_obj


def invalidate_user_cache(user_id: int) -> None:
    _user_cache.pop(f"user:{user_id}", None)


def clear_user_cache() -> None:
    _user_cache.clear()


def get_token_from_cookie(request: Request) -> str:
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No access token provided",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token


def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(get_token_from_cookie)
) -> User:
    user_id = verify_token(token, db)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token or token has been revoked",
        )

    cached = _get_cached_user(user_id)
    if cached is not None:
        return cached

    user_obj = user.get(db, id=user_id)
    if not user_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    _set_cached_user(user_obj)
    return user_obj


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user
