from fastapi import Response
from app.core.config import settings


def set_auth_cookie(response: Response, token: str) -> None:
    """Set the authentication token in an HTTP-only cookie."""
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.ENVIRONMENT not in ["development", "testing"],
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/api/v1",
    )


def clear_auth_cookie(response: Response) -> None:
    """Clear the authentication cookie."""
    response.set_cookie(
        key="access_token",
        value="",
        httponly=True,
        max_age=0,  # Expire immediately
        path="/api/v1",
    )
