import logging
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, func
from app.crud.base import CRUDBase
from app.models.session import ChatSession
from app.models.message import Message  # Import Message for optimized queries
from app.schemas.session import ChatSessionCreate, ChatSessionUpdate
from typing import List, Optional


logger = logging.getLogger(__name__)


class CRUDChatSession(CRUDBase[ChatSession, ChatSessionCreate, ChatSessionUpdate]):
    def create(
        self, db: Session, *, obj_in: ChatSessionCreate, user_id: int
    ) -> ChatSession:
        """
        Create a new chat session for a user
        """
        try:
            db_obj = ChatSession(
                title=obj_in.title,
                description=obj_in.description,
                user_id=user_id,
            )
            db.add(db_obj)
            db.commit()
            db.refresh(db_obj)
            return db_obj
        except Exception as e:
            logger.error(f"Error creating session: {e}")
            raise

    def get_by_user(
        self,
        db: Session,
        *,
        user_id: int,
        skip: int = 0,
        limit: int = 100,
        newest_first: bool = True,
    ) -> List[ChatSession]:
        """
        Retrieve chat sessions by user with pagination and ordering
        """
        query = db.query(ChatSession).filter(ChatSession.user_id == user_id)

        # Apply ordering - descending by created_at to get newest first
        if newest_first:
            query = query.order_by(desc(ChatSession.created_at))
        else:
            query = query.order_by(asc(ChatSession.created_at))

        # Apply pagination
        query = query.offset(skip).limit(limit)

        return query.all()

    def get_by_user_with_message_count(
        self,
        db: Session,
        *,
        user_id: int,
        skip: int = 0,
        limit: int = 100,
        newest_first: bool = True,
        search: str = None,
    ) -> List[dict]:
        """
        Retrieve chat sessions with message count for a user
        Uses optimized query with proper eager loading to prevent N+1 queries
        """
        # Use subquery for message count to avoid N+1 queries
        message_count_subquery = (
            db.query(
                ChatSession.id.label("session_id"),
                func.count(Message.id).label("message_count"),
            )
            .outerjoin(ChatSession.messages)
            .group_by(ChatSession.id)
            .subquery()
        )

        query = (
            db.query(ChatSession, message_count_subquery.c.message_count)
            .filter(ChatSession.user_id == user_id)
            .join(
                message_count_subquery,
                ChatSession.id == message_count_subquery.c.session_id,
                isouter=True,
            )
        )

        # Apply search filter if provided
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (ChatSession.title.ilike(search_term))
                | (ChatSession.description.ilike(search_term))
            )

        # Apply ordering - descending by created_at to get newest first
        if newest_first:
            query = query.order_by(desc(ChatSession.created_at))
        else:
            query = query.order_by(asc(ChatSession.created_at))

        # Apply pagination
        query = query.offset(skip).limit(limit)

        results = []
        for session, message_count in query.all():
            session_dict = {
                "id": session.id,
                "user_id": session.user_id,
                "title": session.title,
                "description": session.description,
                "created_at": session.created_at,
                "updated_at": session.updated_at,
                "message_count": int(message_count or 0),
            }
            results.append(session_dict)

        return results

    def count_by_user(self, db: Session, *, user_id: int, search: str = None) -> int:
        """
        Count total chat sessions for a user - useful for pagination metadata
        """
        query = db.query(func.count(ChatSession.id)).filter(
            ChatSession.user_id == user_id
        )

        # Apply search filter if provided
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (ChatSession.title.ilike(search_term))
                | (ChatSession.description.ilike(search_term))
            )

        return query.scalar()

    def update(
        self, db: Session, *, db_obj: ChatSession, obj_in: ChatSessionUpdate
    ) -> ChatSession:
        """
        Update a chat session
        """
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)

        db.commit()
        db.refresh(db_obj)
        return db_obj

    def remove(self, db: Session, *, id: int) -> Optional[ChatSession]:
        """
        Remove a specific chat session by ID
        """
        obj = db.get(ChatSession, id)
        if obj:
            db.delete(obj)
            db.commit()
        return obj


session = CRUDChatSession(ChatSession)
