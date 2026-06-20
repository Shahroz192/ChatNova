from typing import Optional
from sqlalchemy.orm import Session
from app.models.token_blacklist import TokenBlacklist
from datetime import datetime, UTC


class TokenBlacklistCRUD:
    """CRUD operations for token blacklisting."""

    def __init__(self):
        self.model = TokenBlacklist

    def create_blacklist_entry(
        self,
        db: Session,
        *,
        token_jti: str,
        user_id: Optional[int],
        token_content: str,
        token_type: str = "access",
        reason: str = "logout",
        expires_at: Optional[datetime] = None,
    ) -> TokenBlacklist:
        existing = self.get_by_jti(db, token_jti=token_jti)
        if existing:
            return existing

        db_obj = TokenBlacklist(
            token_jti=token_jti,
            user_id=user_id,
            token_content=token_content,
            token_type=token_type,
            reason=reason,
            expires_at=expires_at,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_by_jti(self, db: Session, *, token_jti: str) -> Optional[TokenBlacklist]:
        return (
            db.query(TokenBlacklist)
            .filter(TokenBlacklist.token_jti == token_jti)
            .first()
        )

    def is_token_blacklisted(self, db: Session, *, token_jti: str) -> bool:
        return self.get_by_jti(db, token_jti=token_jti) is not None

    def blacklist_user_tokens(
        self,
        db: Session,
        *,
        user_id: int,
        current_token_jti: Optional[str] = None,
        current_token_expires_at: Optional[datetime] = None,
        reason: str = "security_incident",
    ) -> int:
        """
        Invalidate all tokens for a user by setting their last_logout_all_at timestamp.
        Any token issued before this timestamp will be rejected on next use.

        Also blacklists the current token's JTI for immediate effect.
        """
        from datetime import datetime
        from app.crud.user import user as user_crud

        now = datetime.now(UTC)

        # 1. Set last_logout_all_at on the user — this invalidates ALL existing tokens
        db_user = user_crud.get(db, id=user_id)
        if db_user:
            db_user.last_logout_all_at = now
            db.add(db_user)
            db.commit()

        # 2. Blacklist the current token JTI for immediate effect
        count = 0
        if current_token_jti:
            self.create_blacklist_entry(
                db=db,
                token_jti=current_token_jti,
                user_id=user_id,
                token_content="BULK_INVALIDATED_ALL",
                token_type="access",
                reason=reason,
                expires_at=current_token_expires_at,
            )
            count = 1

        return count


token_blacklist_crud = TokenBlacklistCRUD()
