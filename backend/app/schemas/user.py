from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional
from datetime import datetime
import re
from app.core.input_validation import InputSanitizer


class UserBase(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        """Validate and sanitize email address."""
        if not v or not isinstance(v, str):
            raise ValueError("Email cannot be empty")

        is_valid, sanitized, error = InputSanitizer.validate_email(v)
        if not is_valid:
            raise ValueError(error)

        return sanitized


class UserCreate(UserBase):
    password: str = Field(None, min_length=8)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if v is None:
            return v

        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")

        if not re.search(r"[A-Z]", v):
            raise ValueError(
                "Password must contain at least one uppercase letter (A-Z)"
            )

        if not re.search(r"[a-z]", v):
            raise ValueError(
                "Password must contain at least one lowercase letter (a-z)"
            )

        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit (0-9)")

        return v


class User(UserBase):
    id: int
    password: str = Field(None, min_length=8)
    messages_used: int
    created_at: Optional[datetime]

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if v is None:
            return v

        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")

        if not re.search(r"[A-Z]", v):
            raise ValueError(
                "Password must contain at least one uppercase letter (A-Z)"
            )

        if not re.search(r"[a-z]", v):
            raise ValueError(
                "Password must contain at least one lowercase letter (a-z)"
            )

        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit (0-9)")

        return v

    model_config = ConfigDict(
        from_attributes=True,
        arbitrary_types_allowed=True,
        json_encoders={datetime: lambda v: v.isoformat() if v else None},
    )


class UserUpdate(BaseModel):
    password: Optional[str] = Field(None, min_length=8)
    messages_used: Optional[int] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if v is None:
            return v

        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")

        if not re.search(r"[A-Z]", v):
            raise ValueError(
                "Password must contain at least one uppercase letter (A-Z)"
            )

        if not re.search(r"[a-z]", v):
            raise ValueError(
                "Password must contain at least one lowercase letter (a-z)"
            )

        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit (0-9)")

        return v


class UserAPIKeyBase(BaseModel):
    model_name: str
    encrypted_key: str


class UserAPIKeyCreate(UserAPIKeyBase):
    pass


class UserAPIKeyUpdate(BaseModel):
    encrypted_key: Optional[str] = None


class UserAPIKey(UserAPIKeyBase):
    id: int
    user_id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    model_config = ConfigDict(
        from_attributes=True,
        arbitrary_types_allowed=True,
        json_encoders={datetime: lambda v: v.isoformat() if v else None},
    )


class UserMCPServerBase(BaseModel):
    mcp_servers_config: str  # JSON string containing the full mcpServers configuration


class UserMCPServerCreate(UserMCPServerBase):
    pass


class UserMCPServerUpdate(BaseModel):
    mcp_servers_config: Optional[str] = None


class UserMCPServer(UserMCPServerBase):
    id: int
    user_id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    model_config = ConfigDict(
        from_attributes=True,
        arbitrary_types_allowed=True,
        json_encoders={datetime: lambda v: v.isoformat() if v else None},
    )
