from sqlalchemy import Column, Integer, String, DateTime, Text, Index
from sqlalchemy.sql import func
from ..database import Base


class TokenBlacklist(Base):
    __tablename__ = "token_blacklist"

    id = Column(Integer, primary_key=True, index=True)
    token_jti = Column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
        comment="JWT ID for tracking",
    )
    token_type = Column(
        String(50), default="access", comment="Type of token (access, refresh)"
    )
    user_id = Column(Integer, index=True, comment="User ID associated with this token")
    token_content = Column(
        Text, nullable=False, comment="Full token content for reference"
    )
    reason = Column(
        String(100),
        default="logout",
        comment="Reason for blacklisting (logout, security, expiry)",
    )
    blacklisted_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        comment="When token was blacklisted",
    )
    expires_at = Column(DateTime(timezone=True), comment="When token naturally expires")

    # Indexes for performance
    __table_args__ = (
        Index("idx_token_jti", "token_jti"),
        Index("idx_user_id", "user_id"),
        Index("idx_expires_at", "expires_at"),
        {"mysql_engine": "InnoDB"},
    )
