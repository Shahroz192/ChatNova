"""
Unit tests for backend API endpoints with mocked AI services
"""

from fastapi.testclient import TestClient
from app.crud.user import user
from app.schemas.user import UserCreate
from sqlalchemy.orm import Session
from unittest.mock import patch


def test_health_check(client: TestClient):
    """Test the health check endpoint"""
    response = client.get("/")
    assert response.status_code in [200, 404]


def test_user_registration(client: TestClient, db_session: Session):
    """Test user registration endpoint"""
    # Test data
    user_data = {
        "email": "newuser@example.com",
        "password": "TestPassword123",
        "username": "newuser",
    }

    response = client.post("/api/v1/auth/register", json=user_data)
    assert response.status_code == 200

    data = response.json()
    assert "id" in data
    assert data["email"] == user_data["email"]

    # Verify user was created in database
    created_user = user.get_by_email(db_session, email=user_data["email"])
    assert created_user is not None
    assert created_user.email == user_data["email"]


def test_user_login(client: TestClient, db_session: Session):
    """Test user login endpoint with httpOnly cookies"""
    # First create a user
    user_data = {
        "email": "login_test@example.com",
        "password": "TestPassword123",
        "username": "logintestuser",
    }
    user_in = UserCreate(**user_data)
    created_user = user.create(db_session, obj_in=user_in)

    login_data = {"username": user_data["email"], "password": user_data["password"]}

    response = client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 200

    # Verify the response indicates success but doesn't return the token
    data = response.json()
    assert "success" in data
    assert data["success"] is True
    assert "access_token" not in data  # Token should be in httpOnly cookie now


def test_get_current_user(client: TestClient, db_session: Session):
    """Test getting current user with cookie-based authentication"""
    # Create a user
    user_data = {
        "email": "current_user_test@example.com",
        "password": "TestPassword123",
        "username": "currentusertest",
    }
    user_in = UserCreate(**user_data)
    created_user = user.create(db_session, obj_in=user_in)

    # Log in to set the cookie
    login_data = {"username": user_data["email"], "password": user_data["password"]}
    login_response = client.post("/api/v1/auth/login", data=login_data)
    assert login_response.status_code == 200

    # Now get current user - cookies should be automatically sent by TestClient
    response = client.get("/api/v1/users/me")
    assert response.status_code == 200

    data = response.json()
    assert data["email"] == user_data["email"]


def test_chat_endpoint(client: TestClient, db_session: Session):
    """Test the chat endpoint with mocked AI service"""
    # Create a user
    user_data = {
        "email": "chat_test@example.com",
        "password": "TestPassword123",
        "username": "chattestuser",
    }
    user_in = UserCreate(**user_data)
    created_user = user.create(db_session, obj_in=user_in)

    # Log in to set the cookie
    login_data = {"username": user_data["email"], "password": user_data["password"]}
    login_response = client.post("/api/v1/auth/login", data=login_data)
    assert login_response.status_code == 200

    # Test the chat endpoint - should work with httpOnly cookie auth
    chat_data = {
        "content": "Hello, how are you?",
        "model": "gemini-2.5-flash",  # Use a valid model from the service
    }

    # Mock AIChatService methods used in the endpoint
    # The endpoint imports ai_service from app.api.v1.chat
    with patch("app.api.v1.chat.ai_service.simple_chat") as mock_chat:
        # Mocking an async generator
        async def mock_simple_chat(*args, **kwargs):
            yield "Hello!"
            yield " How can I help?"
        
        mock_chat.return_value = mock_simple_chat()
        
        # Also need to ensure get_llm returns something or is bypassed
        # and get_available_models includes the model
        with patch("app.api.v1.chat.ai_service.get_available_models", return_value=["gemini-2.5-flash"]):
            response = client.post("/api/v1/chat", json=chat_data)
            assert response.status_code == 200
            assert "Hello!" in response.text


def test_get_chat_history(client: TestClient, db_session: Session):
    """Test the chat history endpoint with cookie-based auth"""
    # Create a user
    user_data = {
        "email": "history_test@example.com",
        "password": "TestPassword123",
        "username": "historytestuser",
    }
    user_in = UserCreate(**user_data)
    created_user = user.create(db_session, obj_in=user_in)

    # Log in to set the cookie
    login_data = {"username": user_data["email"], "password": user_data["password"]}
    login_response = client.post("/api/v1/auth/login", data=login_data)
    assert login_response.status_code == 200

    # Test the chat history endpoint - should work with httpOnly cookie auth
    response = client.get("/api/v1/chat/history")
    assert response.status_code == 200

    data = response.json()
    assert "data" in data
    assert "meta" in data
    assert isinstance(data["data"], list)
    assert isinstance(data["meta"], dict)


def test_get_available_models(client: TestClient, db_session: Session):
    """Test the get available models endpoint with auth"""
    # Create a user
    user_data = {
        "email": "models_test@example.com",
        "password": "TestPassword123",
        "username": "modelstestuser",
    }
    user_in = UserCreate(**user_data)
    created_user = user.create(db_session, obj_in=user_in)

    # Log in to set the cookie
    login_data = {"username": user_data["email"], "password": user_data["password"]}
    login_response = client.post("/api/v1/auth/login", data=login_data)
    assert login_response.status_code == 200

    # Test the models endpoint - should work with httpOnly cookie auth
    response = client.get("/api/v1/chat/models")
    assert response.status_code == 200

    data = response.json()
    assert "models" in data
    assert "total" in data
    assert isinstance(data["models"], list)


def test_logout(client: TestClient, db_session: Session):
    """Test the logout endpoint"""
    # Create a user
    user_data = {
        "email": "logout_test@example.com",
        "password": "TestPassword123",
        "username": "logouttestuser",
    }
    user_in = UserCreate(**user_data)
    created_user = user.create(db_session, obj_in=user_in)

    # Log in to set the cookie
    login_data = {"username": user_data["email"], "password": user_data["password"]}
    login_response = client.post("/api/v1/auth/login", data=login_data)
    assert login_response.status_code == 200

    # Test logout
    logout_response = client.post("/api/v1/auth/logout")
    assert logout_response.status_code == 200

    # After logout, accessing protected endpoint should fail
    protected_response = client.get("/api/v1/users/me")
    assert protected_response.status_code in [401, 403]  # Should be unauthorized now
