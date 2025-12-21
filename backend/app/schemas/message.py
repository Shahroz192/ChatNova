from pydantic import BaseModel, ConfigDict, field_validator
from typing import List, Dict, Any, Optional
from datetime import datetime
from app.core.input_validation import InputSanitizer


class MessageBase(BaseModel):
    content: str
    model: str
    search_web: Optional[bool] = False


class MessageCreate(MessageBase):
    @field_validator("content")
    @classmethod
    def validate_content(cls, v):
        """Validate and sanitize message content."""
        if not v or not isinstance(v, str):
            raise ValueError("Message content cannot be empty")

        is_valid, sanitized, error = InputSanitizer.validate_message_content(v)
        if not is_valid:
            raise ValueError(error)

        return sanitized

    @field_validator("model")
    @classmethod
    def validate_model(cls, v):
        """Validate model name to prevent injection."""
        if not v or not isinstance(v, str):
            raise ValueError("Model name is required")

        # Basic model name validation - allows alphanumeric, dots, hyphens, underscores, colons, and slashes
        import re

        if not re.match(r"^[a-zA-Z0-9._\-:/]+$", v):
            raise ValueError("Invalid model name format")

        return v.strip()

    @field_validator("search_web")
    @classmethod
    def validate_search_web(cls, v):
        """Validate search_web flag."""
        if v is None:
            return False
        return bool(v)


class MessageUpdate(BaseModel):
    response: str


class Message(MessageBase):
    id: int
    response: str
    user_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MessagePagination(BaseModel):
    data: List[Message]
    meta: Dict[str, Any]
