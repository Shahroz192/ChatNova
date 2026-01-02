import pytest
import uuid
import os
from pathlib import Path
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Set environment to testing for rate limiting
os.environ["ENVIRONMENT"] = "testing"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

# Load environment variables from backend/.env
backend_dir = Path(__file__).parent.parent / "backend"
env_file = backend_dir / ".env"
if env_file.exists():
    from dotenv import load_dotenv

    load_dotenv(env_file)

from app.main import app
from app.database import Base, get_db
from app.models.user import User
from app.core.security import get_password_hash
from app.schemas.user import UserCreate


# Create an in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Create a new database session for each test."""
    # Drop all tables and recreate to ensure clean state
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def client(db_session):
    """Create a test client with a database session."""

    def override_get_db():
        try:
            yield db_session
        finally:
            db_session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db_session):
    """Create a test user."""
    unique_id = str(uuid.uuid4())[:8]  # Use first 8 chars of uuid for uniqueness
    user_data = UserCreate(
        email=f"test_{unique_id}@example.com", password="TestPassword123"
    )
    hashed_password = get_password_hash(user_data.password)
    user = User(email=user_data.email, hashed_password=hashed_password)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def authenticated_client(client, test_user):
    """Create an authenticated test client."""
    # Login to get the cookie
    response = client.post(
        "/api/v1/auth/login",
        data={"username": test_user.email, "password": "TestPassword123"},
    )
    assert response.status_code == 200
    # Return the client with authentication
    return client
