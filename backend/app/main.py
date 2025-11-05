from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.api.v1 import auth, chat, users
from app.database import engine, Base
from app.core.config import settings
from app.core.db_profiler import setup_db_profiling
from app.core.memory_profiler import memory_profiler
from app.core.compression import CompressionMiddleware
from app.core.security_headers import SecurityHeadersMiddleware

# Enable memory profiling
memory_profiler.start_tracemalloc()

# Create database tables if the database is available
try:
    Base.metadata.create_all(bind=engine)
    setup_db_profiling(engine)
except Exception as e:
    print(f"Database connection failed: {e}. Make sure PostgreSQL is running.")

app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION)

# Add rate limiting
# Use environment-aware rate limiting (higher limits for testing)
if settings.ENVIRONMENT == "testing":
    # More generous limits for testing to avoid interfering with test runs
    limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
else:
    # Stricter limits for production
    limiter = Limiter(key_func=get_remote_address, default_limits=["10/minute"])

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add compression middleware for large responses
app.add_middleware(CompressionMiddleware)

# Add security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8000",  # Allow backend origin for direct access
    ],  # Allow specific origins only
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # Specific methods only
    allow_headers=[
        "Authorization",
        "Content-Type",
        "X-Requested-With",
        "Set-Cookie",
    ],  # Specific headers only
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(chat.router, prefix="/api/v1", tags=["chat"])
app.include_router(users.router, prefix="/api/v1", tags=["users"])
