import logging
from typing import Optional, List
from sqlalchemy.orm import Session
from app.crud.session import session as session_crud
from app.crud.message import message as message_crud
from app.schemas.session import ChatSessionCreate, ChatSessionUpdate
from app.models.user import User


class ChatSessionService:
    def __init__(self):
        pass

    def create_session(
        self, db: Session, user: User, title: str, description: Optional[str] = None
    ) -> dict:
        """Create a new chat session for a user"""
        try:
            session_create = ChatSessionCreate(title=title, description=description)
            session_obj = session_crud.create(
                db, obj_in=session_create, user_id=user.id
            )

            return {
                "id": session_obj.id,
                "user_id": session_obj.user_id,
                "title": session_obj.title,
                "description": session_obj.description,
                "created_at": session_obj.created_at,
                "updated_at": session_obj.updated_at,
                "message_count": 0,
            }
        except Exception as e:
            logging.error(f"Error creating session for user {user.id}: {e}")
            raise

    def get_user_sessions(
        self,
        db: Session,
        user: User,
        skip: int = 0,
        limit: int = 100,
        newest_first: bool = True,
        search: str = None,
    ) -> List[dict]:
        """Get all sessions for a user with message counts"""
        sessions_with_counts = session_crud.get_by_user_with_message_count(
            db,
            user_id=user.id,
            skip=skip,
            limit=limit,
            newest_first=newest_first,
            search=search,
        )
        return sessions_with_counts

    def get_session_by_id(
        self, db: Session, session_id: int, user: User
    ) -> Optional[dict]:
        """Get a specific session by ID for a user"""
        session_obj = session_crud.get(db, id=session_id)
        if not session_obj or session_obj.user_id != user.id:
            return None

        # Get message count for this session
        message_count = message_crud.count_by_user(
            db, user_id=user.id, session_id=session_id
        )

        return {
            "id": session_obj.id,
            "user_id": session_obj.user_id,
            "title": session_obj.title,
            "description": session_obj.description,
            "created_at": session_obj.created_at,
            "updated_at": session_obj.updated_at,
            "message_count": message_count,
        }

    def update_session(
        self, db: Session, session_id: int, user: User, update_data: ChatSessionUpdate
    ) -> Optional[dict]:
        """Update a session for a user"""
        session_obj = session_crud.get(db, id=session_id)
        if not session_obj or session_obj.user_id != user.id:
            return None

        updated_session = session_crud.update(
            db, db_obj=session_obj, obj_in=update_data
        )

        # Get message count for this session
        message_count = message_crud.count_by_user(
            db, user_id=user.id, session_id=session_id
        )

        return {
            "id": updated_session.id,
            "user_id": updated_session.user_id,
            "title": updated_session.title,
            "description": updated_session.description,
            "created_at": updated_session.created_at,
            "updated_at": updated_session.updated_at,
            "message_count": message_count,
        }

    def delete_session(self, db: Session, session_id: int, user: User) -> bool:
        """Delete a session for a user"""
        session_obj = session_crud.get(db, id=session_id)
        if not session_obj or session_obj.user_id != user.id:
            return False

        session_crud.remove(db, id=session_id)
        return True

    def get_session_messages(
        self,
        db: Session,
        session_id: int,
        user: User,
        skip: int = 0,
        limit: int = 100,
        newest_first: bool = True,
    ) -> List[dict]:
        """Get messages for a specific session"""
        session_obj = session_crud.get(db, id=session_id)
        if not session_obj or session_obj.user_id != user.id:
            return []

        messages = message_crud.get_by_session(
            db, session_id=session_id, skip=skip, limit=limit, newest_first=newest_first
        )

        return [
            {
                "id": msg.id,
                "content": msg.content,
                "response": msg.response,
                "model": msg.model,
                "created_at": msg.created_at,
            }
            for msg in messages
        ]

    def delete_session_messages(
        self,
        db: Session,
        session_id: int,
        user: User,
        before_date: Optional[str] = None,
    ) -> int:
        """Delete messages in a session for a user"""
        session_obj = session_crud.get(db, id=session_id)
        if not session_obj or session_obj.user_id != user.id:
            return 0

        return message_crud.delete_by_user(
            db, user_id=user.id, session_id=session_id, before_date=before_date
        )


session_service = ChatSessionService()
