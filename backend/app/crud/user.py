from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.crud.base import CRUDBase
from app.models.user import User, UserAPIKey, UserMCPServer
from app.schemas.user import (
    UserCreate,
    UserUpdate,
    UserAPIKeyCreate,
    UserAPIKeyUpdate,
    UserMCPServerCreate,
    UserMCPServerUpdate,
)
from app.core.security import get_password_hash, verify_password


class CRUDUser(CRUDBase[User, UserCreate, UserUpdate]):
    def get_by_email(self, db: Session, *, email: str) -> Optional[User]:
        # Ensure email is lowercased and stripped for case-insensitive lookup
        if email:
            email = email.lower().strip()
        return db.query(User).filter(User.email == email).first()

    def create(self, db: Session, *, obj_in: UserCreate) -> User:
        db_obj = User(
            email=obj_in.email, hashed_password=get_password_hash(obj_in.password)
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def authenticate(self, db: Session, *, email: str, password: str) -> Optional[User]:
        user = self.get_by_email(db, email=email)
        if not user or not verify_password(password, user.hashed_password):
            return None
        return user

    def increment_messages(self, db: Session, user_id: int, increment: int = 1):
        # More efficient atomic update
        db.query(User).filter(User.id == user_id).update(
            {User.messages_used: User.messages_used + increment},
            synchronize_session=False,
        )
        db.commit()

    def get_user_with_message_count(
        self, db: Session, user_id: int
    ) -> tuple[Optional[User], int]:
        """
        Get user with their total message count in a single query
        """
        from app.models.message import Message

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return None, 0

        message_count = (
            db.query(func.count(Message.id)).filter(Message.user_id == user_id).scalar()
        )
        return user, message_count


user = CRUDUser(User)


class CRUDUserAPIKey(CRUDBase[UserAPIKey, UserAPIKeyCreate, UserAPIKeyUpdate]):
    def get_by_user_and_model(
        self, db: Session, *, user_id: int, model_name: str
    ) -> Optional[UserAPIKey]:
        return (
            db.query(UserAPIKey)
            .filter(UserAPIKey.user_id == user_id, UserAPIKey.model_name == model_name)
            .first()
        )

    def get_by_user(self, db: Session, *, user_id: int) -> List[UserAPIKey]:
        return db.query(UserAPIKey).filter(UserAPIKey.user_id == user_id).all()

    def create(
        self, db: Session, *, obj_in: UserAPIKeyCreate, user_id: int
    ) -> UserAPIKey:
        db_obj = UserAPIKey(
            user_id=user_id,
            model_name=obj_in.model_name,
            encrypted_key=obj_in.encrypted_key,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self, db: Session, *, db_obj: UserAPIKey, obj_in: UserAPIKeyUpdate
    ) -> UserAPIKey:
        if obj_in.encrypted_key is not None:
            db_obj.encrypted_key = obj_in.encrypted_key
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def remove(
        self, db: Session, *, user_id: int, model_name: str
    ) -> Optional[UserAPIKey]:
        obj = (
            db.query(UserAPIKey)
            .filter(UserAPIKey.user_id == user_id, UserAPIKey.model_name == model_name)
            .first()
        )
        if obj:
            db.delete(obj)
            db.commit()
        return obj


user_api_key = CRUDUserAPIKey(UserAPIKey)


class CRUDUserMCPServer(
    CRUDBase[UserMCPServer, UserMCPServerCreate, UserMCPServerUpdate]
):
    def get_by_user(self, db: Session, *, user_id: int) -> List[UserMCPServer]:
        return db.query(UserMCPServer).filter(UserMCPServer.user_id == user_id).all()

    def create(
        self, db: Session, *, obj_in: UserMCPServerCreate, user_id: int
    ) -> UserMCPServer:
        db_obj = UserMCPServer(
            user_id=user_id,
            mcp_servers_config=obj_in.mcp_servers_config,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self, db: Session, *, db_obj: UserMCPServer, obj_in: UserMCPServerUpdate
    ) -> UserMCPServer:
        if obj_in.mcp_servers_config is not None:
            db_obj.mcp_servers_config = obj_in.mcp_servers_config
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def remove(self, db: Session, *, user_id: int) -> Optional[UserMCPServer]:
        obj = db.query(UserMCPServer).filter(UserMCPServer.user_id == user_id).first()
        if obj:
            db.delete(obj)
            db.commit()
        return obj


user_mcp_server = CRUDUserMCPServer(UserMCPServer)
