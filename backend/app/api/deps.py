from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.crud.user import user
from app.core.security import verify_token
from app.models.user import User
from app.core.cache import cache_manager


def get_token_from_cookie(request: Request) -> str:
    """Extract token from the access_token cookie."""
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
    user_id = verify_token(token, db)  # Pass db session for blacklist check
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token or token has been revoked",
        )

    # Try to get user from cache first
    cache_key = f"user:{user_id}"
    cached_user_data = cache_manager.cache.get(cache_key)

    if cached_user_data:
        # Convert cached user data back to User object
        import json

        user_dict = json.loads(cached_user_data)
        user_obj = User(**user_dict)
    else:
        # Get user from database
        user_obj = user.get(db, id=user_id)
        if not user_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        # Cache the user data for 10 minutes to reduce database lookups
        import json

        cache_manager.cache.set(
            cache_key,
            json.dumps(
                {
                    "id": user_obj.id,
                    "email": user_obj.email,
                    "is_active": user_obj.is_active,
                    "messages_used": user_obj.messages_used,
                    "created_at": user_obj.created_at.isoformat()
                    if user_obj.created_at
                    else None,
                }
            ),
            600,  # 10 minutes TTL
        )

    return user_obj


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user
