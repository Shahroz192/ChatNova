from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app import crud, models, schemas
from app.api import deps

router = APIRouter()

@router.get("/", response_model=List[schemas.search.SearchHistory])
def read_search_history(
    db: Session = Depends(deps.get_db),
    current_user: models.user.User = Depends(deps.get_current_active_user),
    limit: int = Query(10, ge=1, le=50),
) -> Any:
    """
    Retrieve current user's search history.
    """
    history = crud.search_history.get_by_user(db, user_id=current_user.id, limit=limit)
    return history

@router.post("/", response_model=schemas.search.SearchHistory)
def create_search_history_item(
    *,
    db: Session = Depends(deps.get_db),
    current_user: models.user.User = Depends(deps.get_current_active_user),
    history_in: schemas.search.SearchHistoryCreate,
) -> Any:
    """
    Create a new search history item.
    """
    # Check if the exact same query already exists for this user recently to avoid duplicates
    # For simplicity, we just add it now, but we could deduplicate.
    history = crud.search_history.create_with_user(
        db, obj_in=history_in, user_id=current_user.id
    )
    return history

@router.delete("/", response_model=int)
def clear_search_history(
    db: Session = Depends(deps.get_db),
    current_user: models.user.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Clear current user's search history.
    """
    rows = crud.search_history.delete_by_user(db, user_id=current_user.id)
    return rows
