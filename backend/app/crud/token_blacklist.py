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
        self, db: Session, *, user_id: int, reason: str = "security_incident"
    ) -> int:
        from datetime import datetime

        current_time = datetime.now(UTC)
        tokens_to_blacklist = (
            db.query(TokenBlacklist)
            .filter(
                TokenBlacklist.user_id == user_id,
                (
                    TokenBlacklist.expires_at > current_time
                ).self_group() | TokenBlacklist.expires_at.is_(None),
            )
            .all()
        )

        blacklisted_count = 0
        for token in tokens_to_blacklist:
            self.create_blacklist_entry(
                db=db,
                token_jti=f"{token.token_jti}_bulk_{int(current_time.timestamp())}",
                user_id=user_id,
                token_content="BULK_BLACKLISTED",
                token_type=token.token_type,
                reason=reason,
                expires_at=token.expires_at,
            )
            blacklisted_count += 1

        return blacklisted_count


token_blacklist_crud = TokenBlacklistCRUD()
