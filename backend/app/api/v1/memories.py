from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Any
from app import schemas, crud
from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.crud.memory import memory as memory_crud

router = APIRouter()

@router.get("/memories", response_model=List[schemas.Memory])
def read_memories(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Retrieve memories for the current user.
    """
    return memory_crud.get_by_user(db, user_id=current_user.id, skip=skip, limit=limit)

@router.post("/memories", response_model=schemas.Memory)
def create_memory(
    *,
    db: Session = Depends(get_db),
    memory_in: schemas.MemoryCreate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Create a new memory for the current user.
    """
    return memory_crud.create_with_user(db, obj_in=memory_in, user_id=current_user.id)

@router.delete("/memories/{memory_id}", response_model=schemas.Memory)
def delete_memory(
    *,
    db: Session = Depends(get_db),
    memory_id: int,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Delete a memory.
    """
    db_memory = memory_crud.get(db, id=memory_id)
    if not db_memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    if db_memory.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return memory_crud.remove(db, id=memory_id)
