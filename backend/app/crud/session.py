import logging
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import desc, asc, func
from app.crud.base import CRUDBase
from app.models.session import ChatSession
from app.models.message import Message  # Import Message for optimized queries
from app.schemas.session import ChatSessionCreate, ChatSessionUpdate
from typing import List, Optional
from datetime import datetime


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

    def get_by_user_with_messages(
        self,
        db: Session,
        *,
        user_id: int,
        skip: int = 0,
        limit: int = 50,
        newest_first: bool = True,
        include_messages: bool = True,
    ) -> List[ChatSession]:
        """
        Retrieve chat sessions for a user with eager loading of messages
        Prevents N+1 queries when accessing session.messages
        """
        query = (
            db.query(ChatSession)
            .filter(ChatSession.user_id == user_id)
            .options(selectinload(ChatSession.messages))
        )

        # Apply ordering - descending by created_at to get newest first
        if newest_first:
            query = query.order_by(desc(ChatSession.created_at))
        else:
            query = query.order_by(asc(ChatSession.created_at))

        # Apply pagination
        query = query.offset(skip).limit(limit)

        return query.all()

    def get_by_user_with_recent_messages(
        self,
        db: Session,
        *,
        user_id: int,
        skip: int = 0,
        limit: int = 10,
        message_limit: int = 10,
    ) -> List[dict]:
        """
        Get sessions with recent messages using optimized eager loading
        Prevents N+1 queries when loading recent conversations
        """
        # Query sessions with eager loading of limited messages
        query = (
            db.query(ChatSession)
            .filter(ChatSession.user_id == user_id)
            .options(
                selectinload(ChatSession.messages).limit(
                    message_limit
                )  # Limit messages per session
            )
            .order_by(desc(ChatSession.updated_at))
            .offset(skip)
            .limit(limit)
        )

        sessions = query.all()

        # Convert to dictionaries with limited messages
        results = []
        for session in sessions:
            # Limit messages per session for performance
            recent_messages = sorted(
                session.messages, key=lambda m: m.created_at, reverse=True
            )[:message_limit]

            session_dict = {
                "id": session.id,
                "user_id": session.user_id,
                "title": session.title,
                "description": session.description,
                "created_at": session.created_at,
                "updated_at": session.updated_at,
                "message_count": len(session.messages),
                "recent_messages": [
                    {
                        "id": msg.id,
                        "content": msg.content,
                        "response": msg.response,
                        "model": msg.model,
                        "created_at": msg.created_at,
                    }
                    for msg in recent_messages
                ],
            }
            results.append(session_dict)

        return results

    def get_latest_sessions(
        self, db: Session, *, user_id: int, limit: int = 10
    ) -> List[ChatSession]:
        """
        Get latest chat sessions for a user - optimized for recent session display
        """
        return (
            db.query(ChatSession)
            .filter(ChatSession.user_id == user_id)
            .order_by(desc(ChatSession.created_at))
            .limit(limit)
            .all()
        )

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

    def delete_by_user(
        self, db: Session, *, user_id: int, before_date: Optional[str] = None
    ) -> int:
        """
        Delete chat sessions for a user. Optionally delete sessions before a specific date.
        """
        query = db.query(ChatSession).filter(ChatSession.user_id == user_id)

        if before_date:
            before_datetime = datetime.fromisoformat(before_date)
            query = query.filter(ChatSession.created_at < before_datetime)

        to_delete_count = query.count()

        # Delete the sessions
        query.delete(synchronize_session=False)

        # Commit the deletion
        db.commit()

        return to_delete_count

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
