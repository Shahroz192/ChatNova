from typing import List, Optional
from sqlalchemy.orm import Session
from app.crud.base import CRUDBase
from app.models.memory import UserMemory
from app.schemas.memory import MemoryCreate, MemoryUpdate

class CRUDMemory(CRUDBase[UserMemory, MemoryCreate, MemoryUpdate]):
    def get_by_user(
        self, db: Session, *, user_id: int, skip: int = 0, limit: int = 100
    ) -> List[UserMemory]:
        return (
            db.query(self.model)
            .filter(UserMemory.user_id == user_id)
            .order_by(UserMemory.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def create_with_user(
        self, db: Session, *, obj_in: MemoryCreate, user_id: int
    ) -> UserMemory:
        db_obj = UserMemory(
            content=obj_in.content,
            user_id=user_id,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

memory = CRUDMemory(UserMemory)
