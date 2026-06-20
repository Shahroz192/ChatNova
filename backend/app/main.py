import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.api.v1 import auth, chat, users, memories, search
from app.database import engine, Base
from app.core.config import settings
from fastapi.middleware.gzip import GZipMiddleware
from app.core.security_headers import SecurityHeadersMiddleware
from app.services.web_search import web_search_service
from app.services.session_service import session_service
from app.services.ai_chat import ai_service
session_service.configure(ai_service.clear_session_memory)

try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    logging.error(f"Database connection failed: {e}. Make sure PostgreSQL is running.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    web_search_service.start()
    yield
    web_search_service.shutdown()


app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION, lifespan=lifespan)

if settings.ENVIRONMENT == "testing":
    limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
else:
    limiter = Limiter(key_func=get_remote_address, default_limits=["10/minute"])

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(GZipMiddleware, minimum_size=1024)

app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "X-Requested-With",
        "Set-Cookie",
    ],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(chat.router, prefix="/api/v1", tags=["chat"])
app.include_router(users.router, prefix="/api/v1", tags=["users"])
app.include_router(memories.router, prefix="/api/v1", tags=["memories"])
app.include_router(search.router, prefix="/api/v1/search", tags=["search"])
