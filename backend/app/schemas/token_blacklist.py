from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class TokenBlacklistBase(BaseModel):
    """Base schema for token blacklist."""

    token_jti: str
    token_type: Optional[str] = "access"
    user_id: Optional[int] = None
    token_content: str
    reason: Optional[str] = "logout"
    expires_at: Optional[datetime] = None


class TokenBlacklistCreate(TokenBlacklistBase):
    """Schema for creating a token blacklist entry."""

    pass


class TokenBlacklistUpdate(BaseModel):
    """Schema for updating a token blacklist entry."""

    reason: Optional[str] = None


class TokenBlacklistResponse(TokenBlacklistBase):
    """Schema for token blacklist response."""

    id: int
    blacklisted_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenBlacklistCleanupResponse(BaseModel):
    """Schema for cleanup operation response."""

    cleaned_count: int
    cleanup_message: str


class BulkTokenBlacklistRequest(BaseModel):
    """Schema for bulk token blacklist requests."""

    user_id: Optional[int] = None
    reason: Optional[str] = "security_incident"
    token_jtis: Optional[list[str]] = None
