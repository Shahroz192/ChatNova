from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import desc, asc, func, or_
from app.crud.base import CRUDBase
from app.models.message import Message
from app.schemas.message import MessageCreate, MessageUpdate
from app.core.cache import cache_manager
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
        """
        Create a new message with optimized caching invalidation
        """
        db_obj = Message(
            content=obj_in.content,
            model=obj_in.model,
            response=response,
            user_id=user_id,
            session_id=session_id,
            images=obj_in.images,
        )
        db.add(db_obj)
        db.flush()  # Get ID before commit to link documents

        # Link documents to this message if provided
        if obj_in.document_ids:
            from app.models.document import SessionDocument
            db.query(SessionDocument).filter(
                SessionDocument.id.in_(obj_in.document_ids),
                SessionDocument.user_id == user_id
            ).update({"message_id": db_obj.id}, synchronize_session=False)

        db.commit()
        db.refresh(db_obj)

        # Invalidate user's cached history when a new message is added
        cache_manager.invalidate_user_history(user_id)

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
        """
        Retrieve messages by user with optimized query, caching, search, and ordering
        """
        # For now, skip caching when search or session_id is applied since these queries can be highly variable
        if search or session_id:
            query = db.query(Message).filter(Message.user_id == user_id).options(selectinload(Message.documents))

            if session_id:
                query = query.filter(Message.session_id == session_id)

            if search:
                query = query.filter(
                    or_(
                        Message.content.contains(search),
                        Message.response.contains(search),
                    )
                )
        else:
            # First try to get from cache (only for non-search, non-session queries)
            cached_messages = cache_manager.get_chat_history(user_id, skip, limit)
            if cached_messages:
                # Convert the cached dictionaries back to Message objects
                # Use SQLAlchemy's merge method or create new instances
                messages = []
                for msg_dict in cached_messages:
                    # Create a new Message instance from the cached dictionary
                    msg_obj = Message(
                        id=msg_dict.get("id"),
                        user_id=msg_dict.get("user_id"),
                        session_id=msg_dict.get("session_id"),
                        content=msg_dict.get("content"),
                        model=msg_dict.get("model"),
                        response=msg_dict.get("response"),
                        created_at=msg_dict.get("created_at"),
                    )
                    messages.append(msg_obj)
                return messages

            # If not in cache, fetch from database
            query = db.query(Message).filter(Message.user_id == user_id).options(selectinload(Message.documents))

        # Apply ordering - descending by default to get newest first
        if newest_first:
            query = query.order_by(desc(Message.created_at))
        else:
            query = query.order_by(asc(Message.created_at))

        # Apply pagination
        query = query.offset(skip).limit(limit)

        messages = query.all()

        # Only cache if no search or session_id was applied
        if not search and not session_id:
            # Cache the results
            cache_manager.set_chat_history(user_id, skip, limit, messages)

        return messages

    def get_by_session(
        self,
        db: Session,
        *,
        session_id: int,
        skip: int = 0,
        limit: int = 100,
        newest_first: bool = True,
    ) -> List[Message]:
        """
        Retrieve messages by session with pagination and ordering
        """
        query = db.query(Message).filter(Message.session_id == session_id)

        # Apply ordering - descending by default to get newest first
        if newest_first:
            query = query.order_by(desc(Message.created_at))
        else:
            query = query.order_by(asc(Message.created_at))

        # Apply pagination
        query = query.offset(skip).limit(limit)

        return query.all()

    def get_latest_messages(
        self, db: Session, *, user_id: int, limit: int = 10
    ) -> List[Message]:
        """
        Get latest messages for a user - optimized for recent chat display
        """
        return (
            db.query(Message)
            .filter(Message.user_id == user_id)
            .order_by(desc(Message.created_at))
            .limit(limit)
            .all()
        )

    def get_by_session_with_session_info(
        self,
        db: Session,
        *,
        session_id: int,
        skip: int = 0,
        limit: int = 100,
        newest_first: bool = True,
    ) -> List[dict]:
        """
        Retrieve messages by session with session information using eager loading
        Prevents N+1 queries when accessing session information for each message
        """
        query = (
            db.query(Message)
            .filter(Message.session_id == session_id)
            .options(joinedload(Message.session))  # Eager load session info
        )

        # Apply ordering - descending by default to get newest first
        if newest_first:
            query = query.order_by(desc(Message.created_at))
        else:
            query = query.order_by(asc(Message.created_at))

        # Apply pagination
        query = query.offset(skip).limit(limit)

        messages = query.all()

        # Convert to dictionaries with session info
        results = []
        for msg in messages:
            msg_dict = {
                "id": msg.id,
                "user_id": msg.user_id,
                "session_id": msg.session_id,
                "content": msg.content,
                "response": msg.response,
                "model": msg.model,
                "created_at": msg.created_at,
                "session_info": {
                    "id": msg.session.id,
                    "title": msg.session.title,
                    "description": msg.session.description,
                }
                if msg.session
                else None,
            }
            results.append(msg_dict)

        return results

    def get_user_messages_with_session_info(
        self,
        db: Session,
        *,
        user_id: int,
        skip: int = 0,
        limit: int = 100,
        newest_first: bool = True,
        include_sessions: bool = True,
    ) -> List[Message]:
        """
        Retrieve messages for a user with eager loading of session information
        Prevents N+1 queries when accessing session info for multiple messages
        """
        if not include_sessions:
            # If sessions not needed, use simple query
            query = db.query(Message).filter(Message.user_id == user_id)
        else:
            # Eager load session info to prevent N+1 queries
            query = (
                db.query(Message)
                .filter(Message.user_id == user_id)
                .options(selectinload(Message.session))  # Eager load sessions
            )

        # Apply ordering - descending by default to get newest first
        if newest_first:
            query = query.order_by(desc(Message.created_at))
        else:
            query = query.order_by(asc(Message.created_at))

        # Apply pagination
        query = query.offset(skip).limit(limit)

        return query.all()

    def get_recent_messages_with_context(
        self,
        db: Session,
        *,
        user_id: int,
        limit: int = 20,
        include_session_context: bool = True,
    ) -> List[dict]:
        """
        Get recent messages with context for dashboard display
        Optimized to prevent N+1 queries when displaying recent activity
        """
        if include_session_context:
            # Use joined loading to get session info in same query
            query = (
                db.query(Message)
                .filter(Message.user_id == user_id)
                .options(joinedload(Message.session))
                .order_by(desc(Message.created_at))
                .limit(limit)
            )

            messages = query.all()

            results = []
            for msg in messages:
                # Extract session context if available
                session_context = None
                if msg.session:
                    session_context = {"id": msg.session.id, "title": msg.session.title}

                msg_dict = {
                    "id": msg.id,
                    "content": msg.content[:100] + "..."
                    if len(msg.content) > 100
                    else msg.content,
                    "response": msg.response[:100] + "..."
                    if len(msg.response) > 100
                    else msg.response,
                    "model": msg.model,
                    "created_at": msg.created_at,
                    "session_context": session_context,
                }
                results.append(msg_dict)

            return results
        else:
            # Simple query without session context
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
        """
        Count total messages for a user - useful for pagination metadata
        """
        return self.count_by_user_optimized(
            db, user_id=user_id, search=search, session_id=session_id
        )

    def count_by_user_optimized(
        self,
        db: Session,
        *,
        user_id: int,
        search: str = None,
        session_id: Optional[int] = None,
    ) -> int:
        """
        Count total messages for a user - optimized for performance
        Uses count query instead of loading all data
        """
        # Start with base query
        base_query = db.query(func.count(Message.id)).filter(Message.user_id == user_id)

        if session_id:
            base_query = base_query.filter(Message.session_id == session_id)

        if search:
            base_query = base_query.filter(
                or_(Message.content.contains(search), Message.response.contains(search))
            )

        return base_query.scalar()

    def delete_by_user(
        self,
        db: Session,
        *,
        user_id: int,
        before_date: Optional[str] = None,
        session_id: Optional[int] = None,
    ) -> int:
        """
        Delete messages for a user. Optionally delete messages before a specific date or within a session.
        """
        query = db.query(Message).filter(Message.user_id == user_id)

        if session_id:
            query = query.filter(Message.session_id == session_id)

        if before_date:
            # Convert date string to datetime object
            before_datetime = datetime.fromisoformat(before_date)
            query = query.filter(Message.created_at < before_datetime)

        # Get count of messages to be deleted for return
        to_delete_count = query.count()

        # Delete the messages
        query.delete(synchronize_session=False)

        # Commit the deletion
        db.commit()

        # Invalidate cache for user history
        cache_manager.invalidate_user_history(user_id)

        return to_delete_count

    def update(
        self,
        db: Session,
        *,
        db_obj: Message,
        obj_in: dict,
    ) -> Message:
        """
        Update a message with cache invalidation for consistency
        """
        # Convert dict to MessageUpdate schema for proper type safety
        if isinstance(obj_in, dict):
            update_schema = MessageUpdate(**obj_in)
        else:
            update_schema = obj_in

        # Update the message using the base class method
        updated_obj = super().update(db, db_obj=db_obj, obj_in=update_schema)

        # Invalidate user's cached history when a message is updated
        cache_manager.invalidate_user_history(db_obj.user_id)

        return updated_obj

    def remove(self, db: Session, *, id: int) -> Message:
        """
        Remove a specific message by ID with cache invalidation
        """
        obj = db.get(Message, id)
        if obj:
            db.delete(obj)
            db.commit()

            # Invalidate cache for user history
            cache_manager.invalidate_user_history(obj.user_id)

        return obj


message = CRUDMessage(Message)
