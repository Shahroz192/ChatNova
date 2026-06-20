from fastapi import APIRouter, Depends, HTTPException, Response, Request
from fastapi.security import OAuth2PasswordRequestForm
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from app import crud
from app.schemas.user import User, UserCreate
from app.api.deps import get_db
from app.core.security import create_access_token

from app.utils.cookies import set_auth_cookie
from app.core.config import settings

limiter = Limiter(key_func=get_remote_address)

router = APIRouter()


@router.post("/register", response_model=User)
@limiter.limit("50/minute" if settings.ENVIRONMENT == "testing" else "5/minute")
def register(request: Request, user_in: UserCreate, db: Session = Depends(get_db)):
    db_user = crud.user.get_by_email(db, email=user_in.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.user.create(db, obj_in=user_in)


@router.post("/login")
@limiter.limit("50/minute" if settings.ENVIRONMENT == "testing" else "5/minute")
def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = crud.user.authenticate(
        db, email=form_data.username, password=form_data.password
    )
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    access_token, token_jti = create_access_token(data={"sub": str(user.id)})

    set_auth_cookie(response, access_token)

    return {
        "success": True,
        "user_id": user.id,
        "email": user.email,
        "token_jti": token_jti,
    }


@router.post("/logout")
def logout(response: Response, request: Request, db: Session = Depends(get_db)):
    """Logout user and blacklist current token."""
    from app.utils.cookies import clear_auth_cookie
    from app.core.security import extract_token_jti, get_token_expires_at

    token = request.cookies.get("access_token")

    if token:
        token_jti = extract_token_jti(token)
        expires_at = get_token_expires_at(token)

        if token_jti:
            from app.crud.token_blacklist import token_blacklist_crud

            token_blacklist_crud.create_blacklist_entry(
                db=db,
                token_jti=token_jti,
                user_id=None,
                token_content="LOGOUT_BLACKLISTED",
                token_type="access",
                reason="logout",
                expires_at=expires_at,
            )

    clear_auth_cookie(response)
    return {"success": True, "message": "Successfully logged out"}


@router.post("/logout-all")
def logout_all_sessions(
    response: Response, request: Request, db: Session = Depends(get_db)
):
    """Logout user from all sessions by invalidating all tokens.

    Sets a `last_logout_all_at` timestamp on the user. Any existing JWT
    with an `iat` before this timestamp will be rejected on next use.
    The current session's JTI is also blacklisted for immediate effect.
    """
    from app.utils.cookies import clear_auth_cookie
    from app.core.security import verify_token, extract_token_jti, get_token_expires_at

    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_id = verify_token(token, db)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    from app.crud.token_blacklist import token_blacklist_crud

    current_jti = extract_token_jti(token)
    current_exp = get_token_expires_at(token)

    blacklisted_count = token_blacklist_crud.blacklist_user_tokens(
        db=db,
        user_id=int(user_id),
        current_token_jti=current_jti,
        current_token_expires_at=current_exp,
        reason="logout_all_sessions",
    )

    clear_auth_cookie(response)
    return {
        "success": True,
        "message": "Successfully logged out from all sessions",
        "sessions_terminated": blacklisted_count,
    }
