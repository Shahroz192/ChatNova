import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from app import crud, schemas
from app.api.deps import get_current_active_user, get_db, invalidate_user_cache
from app.crud.user import user_api_key, user_mcp_server
from app.models.user import User
from app.schemas.user import (
    UserAPIKey,
    UserAPIKeyCreate,
    UserAPIKeyUpdate,
    UserInstructionsUpdate,
    UserMCPServer,
    UserMCPServerCreate,
    UserMCPServerUpdate,
)
from app.core.security import encrypt_api_key
from app.utils.cookies import clear_auth_cookie

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/users/me", response_model=schemas.User)
def read_user_me(
    current_user: User = Depends(get_current_active_user),
):
    """
    Get current user.
    """
    return current_user


@router.put("/users/me", response_model=schemas.User)
def update_user_me(
    user_in: schemas.UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Update current user.
    """
    invalidate_user_cache(current_user.id)

    db_user = crud.user.get(db, id=current_user.id)
    return crud.user.update(db, db_obj=db_user, obj_in=user_in)


@router.patch("/users/me/instructions", response_model=schemas.User)
def update_user_instructions(
    instr_in: UserInstructionsUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Update user custom instructions.
    """
    invalidate_user_cache(current_user.id)

    db_user = crud.user.get(db, id=current_user.id)
    user_update = schemas.UserUpdate(custom_instructions=instr_in.custom_instructions)
    return crud.user.update(db, db_obj=db_user, obj_in=user_update)


@router.post("/users/me/api-keys", response_model=UserAPIKey)
def set_api_key(
    api_key_in: UserAPIKeyCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Set or update an API key for a model.
    """
    existing = user_api_key.get_by_user_and_model(
        db, user_id=current_user.id, model_name=api_key_in.model_name
    )

    raw_key = api_key_in.api_key
    encrypted_key = encrypt_api_key(raw_key)

    if existing:
        return user_api_key.update(
            db,
            db_obj=existing,
            obj_in=UserAPIKeyUpdate(encrypted_key=encrypted_key),
        )

    return user_api_key.create(
        db,
        obj_in={
            "model_name": api_key_in.model_name,
            "encrypted_key": encrypted_key,
        },
        user_id=current_user.id,
    )


@router.get("/users/me/api-keys", response_model=List[UserAPIKey])
def get_api_keys(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get all API keys for the current user.
    """
    keys = user_api_key.get_by_user(db, user_id=current_user.id)

    result = []
    for key in keys:
        key_data = UserAPIKey(
            id=key.id,
            user_id=key.user_id,
            model_name=key.model_name,
            created_at=key.created_at,
        )
        result.append(key_data)

    return result


@router.delete("/users/me/api-keys/{model_name}")
def delete_api_key(
    model_name: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Delete a specific API key by provider/model name (e.g., "Google", "Cerebras").
    """
    key_obj = user_api_key.remove_by_user_and_model(
        db, user_id=current_user.id, model_name=model_name
    )
    if not key_obj:
        raise HTTPException(status_code=404, detail="API key not found")
    return {"message": "API key deleted successfully"}


@router.post("/users/me/mcp-servers", response_model=UserMCPServer)
def save_mcp_servers(
    mcp_in: UserMCPServerCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Save MCP server configuration for the current user.
    """
    existing = user_mcp_server.get_by_user(db, user_id=current_user.id)

    if existing:
        return user_mcp_server.update(
            db,
            db_obj=existing[0],
            obj_in={"mcp_servers_config": mcp_in.mcp_servers_config},
        )

    return user_mcp_server.create(
        db,
        obj_in={
            "user_id": current_user.id,
            "mcp_servers_config": mcp_in.mcp_servers_config,
        },
    )


@router.get("/users/me/mcp-servers", response_model=List[UserMCPServer])
def get_mcp_servers(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get MCP server configuration for the current user.
    """
    return user_mcp_server.get_by_user(db, user_id=current_user.id) or []


@router.put("/users/me/mcp-servers/{server_id}", response_model=UserMCPServer)
def update_mcp_server(
    server_id: int,
    mcp_in: UserMCPServerUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Update a specific MCP server configuration.
    """
    existing = user_mcp_server.get(db, id=server_id)
    if not existing or existing.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="MCP server not found")
    return user_mcp_server.update(
        db, db_obj=existing, obj_in={"mcp_servers_config": mcp_in.mcp_servers_config}
    )


@router.delete("/users/me", status_code=204)
def delete_user_me(
    response: Response,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    request: Request = None,
):
    """Delete current user account and all associated data."""
    invalidate_user_cache(current_user.id)

    from app.core.security import extract_token_jti, get_token_expires_at
    from app.crud.token_blacklist import token_blacklist_crud

    token = request.cookies.get("access_token")
    if token:
        token_jti = extract_token_jti(token)
        expires_at = get_token_expires_at(token)
        if token_jti:
            token_blacklist_crud.create_blacklist_entry(
                db=db,
                token_jti=token_jti,
                user_id=current_user.id,
                token_content="ACCOUNT_DELETED",
                token_type="access",
                reason="account_deletion",
                expires_at=expires_at,
            )

    from app.crud.user import user

    user.remove(db, id=current_user.id)
    clear_auth_cookie(response)
    return None


@router.delete("/users/me/mcp-servers/{server_id}")
def delete_mcp_server(
    server_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Delete a specific MCP server configuration.
    """
    existing = user_mcp_server.get(db, id=server_id)
    if not existing or existing.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="MCP server not found")
    user_mcp_server.remove(db, id=server_id)
    return {"message": "MCP server deleted successfully"}



