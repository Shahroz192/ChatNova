import logging
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


mcp_path = "/home/shahroz/ChatNova/backend/app/mcp.json"


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

    logging.info("✅ All required environment variables validated successfully")


try:
    validate_environment()
except ValueError as e:
    logging.error(f"Environment validation failed: {e}")
    if settings.ENVIRONMENT != "development":
        raise
    logging.warning(f"⚠️  Environment validation warning (development mode): {e}")
