from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class TokenBlacklistBase(BaseModel):
    token_jti: str
    token_type: Optional[str] = "access"
    user_id: Optional[int] = None
    token_content: str
    reason: Optional[str] = "logout"
    expires_at: Optional[datetime] = None


class TokenBlacklistCreate(TokenBlacklistBase):
    pass


class TokenBlacklistResponse(TokenBlacklistBase):
    id: int
    blacklisted_at: datetime

    model_config = ConfigDict(from_attributes=True)
