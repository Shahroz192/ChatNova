from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, delete
from app.models.token_blacklist import TokenBlacklist
from datetime import datetime, UTC


class TokenBlacklistCRUD:
    """CRUD operations for token blacklisting."""

    def __init__(self):
        """Initialize CRUD operations."""
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
        """Create a new token blacklist entry."""
        # Check if token is already blacklisted
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
        """Get blacklist entry by JWT ID."""
        return (
            db.query(TokenBlacklist)
            .filter(TokenBlacklist.token_jti == token_jti)
            .first()
        )

    def is_token_blacklisted(self, db: Session, *, token_jti: str) -> bool:
        """Check if a token is blacklisted."""
        blacklisted = self.get_by_jti(db, token_jti=token_jti)
        return blacklisted is not None

    def blacklist_user_tokens(
        self, db: Session, *, user_id: int, reason: str = "security_incident"
    ) -> int:
        """Blacklist all active tokens for a user."""
        from datetime import datetime, UTC

        # Get all tokens that haven't expired yet and aren't already blacklisted
        current_time = datetime.now(UTC)
        tokens_to_blacklist = (
            db.query(TokenBlacklist)
            .filter(
                and_(
                    TokenBlacklist.user_id == user_id,
                    or_(
                        TokenBlacklist.expires_at > current_time,
                        TokenBlacklist.expires_at.is_(None),
                    ),
                )
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

    def cleanup_expired_tokens(self, db: Session) -> Tuple[int, str]:
        """Remove expired tokens from blacklist."""
        current_time = datetime.now(UTC)

        # Delete expired tokens
        result = db.execute(
            delete(TokenBlacklist).where(
                and_(
                    TokenBlacklist.expires_at.isnot(None),
                    TokenBlacklist.expires_at < current_time,
                )
            )
        )

        deleted_count = result.rowcount
        db.commit()

        message = f"Cleaned up {deleted_count} expired token blacklist entries"
        return deleted_count, message

    def get_user_blacklisted_tokens(
        self, db: Session, *, user_id: int, skip: int = 0, limit: int = 100
    ) -> List[TokenBlacklist]:
        """Get all blacklisted tokens for a user."""
        return (
            db.query(TokenBlacklist)
            .filter(TokenBlacklist.user_id == user_id)
            .order_by(TokenBlacklist.blacklisted_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_statistics(self, db: Session) -> dict:
        """Get token blacklist statistics."""
        from sqlalchemy import func, and_

        current_time = datetime.now(UTC)

        total_entries = db.query(func.count(TokenBlacklist.id)).scalar() or 0
        expired_entries = (
            db.query(func.count(TokenBlacklist.id))
            .filter(
                and_(
                    TokenBlacklist.expires_at.isnot(None),
                    TokenBlacklist.expires_at < current_time,
                )
            )
            .scalar()
            or 0
        )

        unique_users = (
            db.query(func.count(func.distinct(TokenBlacklist.user_id)))
            .filter(TokenBlacklist.user_id.isnot(None))
            .scalar()
            or 0
        )

        return {
            "total_entries": total_entries,
            "expired_entries": expired_entries,
            "unique_users": unique_users,
            "cleanup_needed": expired_entries > 0,
        }


# Create singleton instance
token_blacklist_crud = TokenBlacklistCRUD()
