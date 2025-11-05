from fastapi import APIRouter, Depends, HTTPException
from app import schemas
from app import crud
from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from sqlalchemy.orm import Session
from app.core.profiler import request_profiler
from app.core.security import encrypt_api_key
from app.schemas.user import (
    UserAPIKey,
    UserAPIKeyCreate,
    UserAPIKeyUpdate,
    UserMCPServer,
    UserMCPServerCreate,
    UserMCPServerUpdate,
)
from app.crud.user import user_api_key, user_mcp_server
from typing import List

router = APIRouter()


@router.get("/users/me", response_model=schemas.User)
@request_profiler.profile_endpoint("/users/me", "GET")
def read_users_me(current_user: User = Depends(get_current_active_user)):
    """
    Get current user.
    """
    return current_user


@router.put("/users/me", response_model=schemas.User)
@request_profiler.profile_endpoint("/users/me", "PUT")
def update_user_me(
    user_in: schemas.UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Update current user.
    """
    return crud.user.update(db, db_obj=current_user, obj_in=user_in)


@router.post("/users/me/api-keys", response_model=UserAPIKey)
@request_profiler.profile_endpoint("/users/me/api-keys", "POST")
def set_api_key(
    api_key_in: UserAPIKeyCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Set or update an API key for a model.
    """
    # Check if key already exists
    existing = user_api_key.get_by_user_and_model(
        db, user_id=current_user.id, model_name=api_key_in.model_name
    )
    encrypted_key = encrypt_api_key(
        api_key_in.encrypted_key
    )  # Note: This should be the plain key, but we'll encrypt it
    if existing:
        user_api_key.update(
            db, db_obj=existing, obj_in=UserAPIKeyUpdate(encrypted_key=encrypted_key)
        )
    else:
        user_api_key.create(
            db,
            obj_in=UserAPIKeyCreate(
                model_name=api_key_in.model_name, encrypted_key=encrypted_key
            ),
            user_id=current_user.id,
        )
    return user_api_key.get_by_user_and_model(
        db, user_id=current_user.id, model_name=api_key_in.model_name
    )


@router.get("/users/me/api-keys", response_model=List[UserAPIKey])
@request_profiler.profile_endpoint("/users/me/api-keys", "GET")
def get_api_keys(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get all API keys for the current user.
    """
    return user_api_key.get_by_user(db, user_id=current_user.id)


@router.delete("/users/me/api-keys/{model_name}")
@request_profiler.profile_endpoint("/users/me/api-keys/{model_name}", "DELETE")
def delete_api_key(
    model_name: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Delete an API key for a model.
    """
    deleted = user_api_key.remove(db, user_id=current_user.id, model_name=model_name)
    if not deleted:
        raise HTTPException(status_code=404, detail="API key not found")
    return {"message": "API key deleted"}


@router.post("/users/me/mcp-servers", response_model=UserMCPServer)
@request_profiler.profile_endpoint("/users/me/mcp-servers", "POST")
def set_mcp_server(
    mcp_server_in: UserMCPServerCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Set or update an MCP server configuration.
    """
    # Check if server already exists
    existing = user_mcp_server.get_by_user(db, user_id=current_user.id)
    if existing:
        user_mcp_server.update(
            db,
            db_obj=existing[0],
            obj_in=UserMCPServerUpdate(
                mcp_servers_config=mcp_server_in.mcp_servers_config
            ),
        )
    else:
        user_mcp_server.create(db, obj_in=mcp_server_in, user_id=current_user.id)
    return user_mcp_server.get_by_user(db, user_id=current_user.id)[0]


@router.get("/users/me/mcp-servers", response_model=List[UserMCPServer])
@request_profiler.profile_endpoint("/users/me/mcp-servers", "GET")
def get_mcp_servers(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get all MCP servers for the current user.
    """
    return user_mcp_server.get_by_user(db, user_id=current_user.id)


@router.delete("/users/me/mcp-servers")
@request_profiler.profile_endpoint("/users/me/mcp-servers", "DELETE")
def delete_mcp_server(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Delete an MCP server configuration.
    """
    deleted = user_mcp_server.remove(db, user_id=current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="MCP server not found")
    return {"message": "MCP server deleted"}
