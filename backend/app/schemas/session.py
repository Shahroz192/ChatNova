from pydantic import BaseModel, ConfigDict, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.core.input_validation import InputSanitizer


class ChatSessionBase(BaseModel):
    title: str
    description: Optional[str] = None


class ChatSessionCreate(ChatSessionBase):
    @field_validator("title")
    @classmethod
    def validate_title(cls, v):
        """Validate and sanitize session title."""
        if not v or not isinstance(v, str):
            raise ValueError("Title cannot be empty")

        is_valid, sanitized, error = InputSanitizer.validate_title(v)
        if not is_valid:
            raise ValueError(error)

        return sanitized

    @field_validator("description")
    @classmethod
    def validate_description(cls, v):
        """Validate and sanitize session description."""
        if not v:
            return None

        is_valid, sanitized, error = InputSanitizer.validate_description(v)
        if not is_valid:
            raise ValueError(error)

        return sanitized


class ChatSessionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, v):
        """Validate and sanitize session title."""
        if v is None:
            return v

        if not isinstance(v, str):
            raise ValueError("Title must be a string")

        is_valid, sanitized, error = InputSanitizer.validate_title(v)
        if not is_valid:
            raise ValueError(error)

        return sanitized

    @field_validator("description")
    @classmethod
    def validate_description(cls, v):
        """Validate and sanitize session description."""
        if v is None:
            return v

        is_valid, sanitized, error = InputSanitizer.validate_description(v)
        if not is_valid:
            raise ValueError(error)

        return sanitized


class ChatSession(ChatSessionBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ChatSessionPagination(BaseModel):
    data: List[ChatSession]
    meta: Dict[str, Any]
