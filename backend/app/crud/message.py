from sqlalchemy.orm import Session, selectinload
from sqlalchemy import desc, asc, func, or_
from app.crud.base import CRUDBase
from app.models.message import Message
from app.schemas.message import MessageCreate, MessageUpdate
from typing import List, Optional
from datetime import datetime


class CRUDMessage(CRUDBase[Message, MessageCreate, MessageUpdate]):
    def create(
        self,
        db: Session,
        *,
        obj_in: MessageCreate,
        response: str,
        user_id: int,
        session_id: Optional[int] = None,
    ) -> Message:
        db_obj = Message(
            content=obj_in.content,
            model=obj_in.model,
            response=response,
            user_id=user_id,
            session_id=session_id,
            images=obj_in.images,
        )
        db.add(db_obj)
        db.flush()

        if obj_in.document_ids:
            from app.models.document import SessionDocument

            db.query(SessionDocument).filter(
                SessionDocument.id.in_(obj_in.document_ids),
                SessionDocument.user_id == user_id,
            ).update({"message_id": db_obj.id}, synchronize_session=False)

        db.commit()
        db.refresh(db_obj)

        return db_obj

    def get_by_user(
        self,
        db: Session,
        *,
        user_id: int,
        skip: int = 0,
        limit: int = 100,
        newest_first: bool = True,
        search: str = None,
        session_id: Optional[int] = None,
    ) -> List[Message]:
        query = (
            db.query(Message)
            .filter(Message.user_id == user_id)
            .options(selectinload(Message.documents))
        )

        if session_id:
            query = query.filter(Message.session_id == session_id)

        if search:
            query = query.filter(
                or_(
                    Message.content.contains(search),
                    Message.response.contains(search),
                )
            )

        if newest_first:
            query = query.order_by(desc(Message.created_at))
        else:
            query = query.order_by(asc(Message.created_at))

        query = query.offset(skip).limit(limit)

        return query.all()

    def get_by_session(
        self,
        db: Session,
        *,
        session_id: int,
        user_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
        newest_first: bool = True,
    ) -> List[Message]:
        query = db.query(Message).filter(Message.session_id == session_id)
        if user_id is not None:
            query = query.filter(Message.user_id == user_id)

        if newest_first:
            query = query.order_by(desc(Message.created_at))
        else:
            query = query.order_by(asc(Message.created_at))

        query = query.offset(skip).limit(limit)

        return query.all()

    def get_latest_messages(
        self, db: Session, *, user_id: int, limit: int = 10
    ) -> List[Message]:
        return (
            db.query(Message)
            .filter(Message.user_id == user_id)
            .order_by(desc(Message.created_at))
            .limit(limit)
            .all()
        )

    def count_by_user(
        self,
        db: Session,
        *,
        user_id: int,
        search: str = None,
        session_id: Optional[int] = None,
    ) -> int:
        query = db.query(func.count(Message.id)).filter(Message.user_id == user_id)

        if session_id:
            query = query.filter(Message.session_id == session_id)

        if search:
            query = query.filter(
                or_(Message.content.contains(search), Message.response.contains(search))
            )

        return query.scalar()

    def delete_by_user(
        self,
        db: Session,
        *,
        user_id: int,
        before_date: Optional[str] = None,
        session_id: Optional[int] = None,
    ) -> int:
        query = db.query(Message).filter(Message.user_id == user_id)

        if session_id:
            query = query.filter(Message.session_id == session_id)

        if before_date:
            before_datetime = datetime.fromisoformat(before_date)
            query = query.filter(Message.created_at < before_datetime)

        to_delete_count = query.count()
        query.delete(synchronize_session=False)
        db.commit()

        return to_delete_count

    def update(
        self,
        db: Session,
        *,
        db_obj: Message,
        obj_in: dict,
    ) -> Message:
        if isinstance(obj_in, dict):
            update_schema = MessageUpdate(**obj_in)
        else:
            update_schema = obj_in

        return super().update(db, db_obj=db_obj, obj_in=update_schema)

    def remove(self, db: Session, *, id: int) -> Message:
        obj = db.get(Message, id)
        if obj:
            db.delete(obj)
            db.commit()
        return obj


message = CRUDMessage(Message)
