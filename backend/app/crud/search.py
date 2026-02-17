from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.crud.base import CRUDBase
from app.models.search import SearchHistory
from app.schemas.search import SearchHistoryCreate, SearchHistory as SearchHistorySchema

class CRUDSearchHistory(CRUDBase[SearchHistory, SearchHistoryCreate, SearchHistorySchema]):
    def create_with_user(
        self, db: Session, *, obj_in: SearchHistoryCreate, user_id: int
    ) -> SearchHistory:
        db_obj = SearchHistory(
            query=obj_in.query,
            search_type=obj_in.search_type,
            user_id=user_id,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_by_user(
        self, db: Session, *, user_id: int, limit: int = 10
    ) -> List[SearchHistory]:
        return (
            db.query(SearchHistory)
            .filter(SearchHistory.user_id == user_id)
            .order_by(desc(SearchHistory.created_at), desc(SearchHistory.id))
            .limit(limit)
            .all()
        )

    def delete_by_user(self, db: Session, *, user_id: int) -> int:
        rows = db.query(SearchHistory).filter(SearchHistory.user_id == user_id).delete()
        db.commit()
        return rows

search_history = CRUDSearchHistory(SearchHistory)
