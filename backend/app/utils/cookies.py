from fastapi import Response
from app.core.config import settings


def set_auth_cookie(response: Response, token: str) -> None:
    """Set the authentication token in an HTTP-only cookie."""
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.ENVIRONMENT
        != "development",  # Use secure cookies in production
        samesite="lax",  # Lax prevents CSRF while allowing safe cross-site usage
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # Convert minutes to seconds
        path="/api/v1",  # Restrict cookie to API endpoints
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
