from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


mcp_path = "/home/shahroz/ai-chat-pro/backend/app/mcp.json"


class Settings(BaseSettings):
    PROJECT_NAME: str = "ChatNova"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str

    # Auth
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Encryption
    FERNET_KEY: Optional[str] = None

    # AI Models
    GOOGLE_API_KEY: Optional[str] = None
    CEREBRAS_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()


# Validate required environment variables at startup
def validate_environment():
    """Validate that all required environment variables are present."""
    required_vars = ["DATABASE_URL", "SECRET_KEY"]

    missing_vars = []
    for var in required_vars:
        if not getattr(settings, var, None):
            missing_vars.append(var)

    if missing_vars:
        raise ValueError(
            f"Missing required environment variables: {', '.join(missing_vars)}. "
            "Please check your .env file or environment configuration."
        )

    print("✅ All required environment variables validated successfully")


# Run validation on import
try:
    validate_environment()
except ValueError as e:
    print(f"⚠️  Environment validation warning: {e}")
    # Don't raise the error to allow startup in development mode
