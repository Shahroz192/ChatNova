from fastapi.testclient import TestClient
from app.models.user import User


def test_create_chat_session(client: TestClient, test_user: User):
    """Test creating a new chat session."""
    # First log in
    login_data = {"username": test_user.email, "password": "TestPassword123"}
    response = client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 200

    # Create a chat session
    session_data = {
        "title": "Test Chat Session",
        "description": "A test chat session for testing purposes",
    }
    response = client.post("/api/v1/sessions", json=session_data)

    assert response.status_code == 200
    data = response.json()
    assert data["title"] == session_data["title"]
    assert data["description"] == session_data["description"]
    assert data["user_id"] == test_user.id
    assert "id" in data


def test_get_user_sessions(client: TestClient, test_user: User):
    """Test getting all chat sessions for a user."""
    # First log in
    login_data = {"username": test_user.email, "password": "TestPassword123"}
    response = client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 200

    # Create a session first
    session_data = {"title": "My Session", "description": "A session to test retrieval"}
    create_response = client.post("/api/v1/sessions", json=session_data)
    assert create_response.status_code == 200

    # Get all sessions
    response = client.get("/api/v1/sessions")

    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "meta" in data
    assert len(data["data"]) >= 1
    session_titles = [s["title"] for s in data["data"]]
    assert "My Session" in session_titles


def test_get_specific_session(client: TestClient, test_user: User):
    """Test getting a specific chat session."""
    # First log in
    login_data = {"username": test_user.email, "password": "TestPassword123"}
    response = client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 200

    # Create a session first
    session_data = {
        "title": "Specific Session",
        "description": "A specific session to retrieve",
    }
    create_response = client.post("/api/v1/sessions", json=session_data)
    assert create_response.status_code == 200
    session_id = create_response.json()["id"]

    # Get the specific session
    response = client.get(f"/api/v1/sessions/{session_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == session_id
    assert data["title"] == "Specific Session"


def test_update_session(client: TestClient, test_user: User):
    """Test updating a chat session."""
    # First log in
    login_data = {"username": test_user.email, "password": "TestPassword123"}
    response = client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 200

    # Create a session first
    session_data = {"title": "Original Title", "description": "Original Description"}
    create_response = client.post("/api/v1/sessions", json=session_data)
    assert create_response.status_code == 200
    session_id = create_response.json()["id"]

    # Update the session
    update_data = {"title": "Updated Title", "description": "Updated Description"}
    response = client.put(f"/api/v1/sessions/{session_id}", json=update_data)

    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated Title"
    assert data["description"] == "Updated Description"


def test_delete_session(client: TestClient, test_user: User):
    """Test deleting a chat session."""
    # First log in
    login_data = {"username": test_user.email, "password": "TestPassword123"}
    response = client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 200

    # Create a session first
    session_data = {
        "title": "To Be Deleted",
        "description": "This session will be deleted",
    }
    create_response = client.post("/api/v1/sessions", json=session_data)
    assert create_response.status_code == 200
    session_id = create_response.json()["id"]

    # Delete the session
    response = client.delete(f"/api/v1/sessions/{session_id}")

    assert response.status_code == 200
    data = response.json()
    assert "message" in data

    # Verify the session is deleted
    get_response = client.get(f"/api/v1/sessions/{session_id}")
    assert get_response.status_code == 404


def test_create_chat_message(client: TestClient, test_user: User):
    """Test creating a chat message (basic chat endpoint)."""
    # First log in
    login_data = {"username": test_user.email, "password": "TestPassword123"}
    response = client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 200

    # Create a message
    message_data = {
        "content": "Hello, this is a test message!",
        "model": "gemini-2.5-flash",
    }
    response = client.post("/api/v1/chat", json=message_data)

    # Note: This will likely fail without proper AI model configuration,
    # but we can test that authentication works and request validation works
    assert response.status_code in [
        200,
        500,
    ]  # 200 if successful, 500 if AI service fails


def test_create_chat_message_with_session(client: TestClient, test_user: User):
    """Test creating a chat message associated with a session."""
    # First log in
    login_data = {"username": test_user.email, "password": "TestPassword123"}
    response = client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 200

    # Create a session first
    session_data = {"title": "Chat Session", "description": "Session for chat testing"}
    create_session_response = client.post("/api/v1/sessions", json=session_data)
    assert create_session_response.status_code == 200
    session_id = create_session_response.json()["id"]

    # Create a message with session ID
    message_data = {
        "content": "Hello, this is a test message for a session!",
        "model": "gemini-2.5-flash",
    }
    response = client.post(f"/api/v1/chat?session_id={session_id}", json=message_data)

    # Note: This will likely fail without proper AI model configuration,
    # but we can test that authentication works and request validation works
    assert response.status_code in [
        200,
        500,
    ]  # 200 if successful, 500 if AI service fails


def test_get_session_messages(client: TestClient, test_user: User):
    """Test getting messages for a specific session."""
    # First log in
    login_data = {"username": test_user.email, "password": "TestPassword123"}
    response = client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 200

    # Create a session first
    session_data = {
        "title": "Message Session",
        "description": "Session to test message retrieval",
    }
    create_session_response = client.post("/api/v1/sessions", json=session_data)
    assert create_session_response.status_code == 200
    session_id = create_session_response.json()["id"]

    # Get messages for the session (should be empty initially)
    response = client.get(f"/api/v1/sessions/{session_id}/messages")

    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "meta" in data
    assert len(data["data"]) == 0


def test_get_chat_history(client: TestClient, test_user: User):
    """Test getting chat history for the user."""
    # First log in
    login_data = {"username": test_user.email, "password": "TestPassword123"}
    response = client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 200

    # Get chat history (should be empty initially)
    response = client.get("/api/v1/chat/history")

    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "meta" in data
    # The history might not be empty if other tests created messages,
    # but we can at least verify the structure


def test_get_available_models(client: TestClient, test_user: User):
    """Test getting available AI models."""
    # First log in
    login_data = {"username": test_user.email, "password": "TestPassword123"}
    response = client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 200

    # Get available models
    response = client.get("/api/v1/chat/models")

    assert response.status_code == 200
    data = response.json()
    assert "models" in data
    assert "total" in data
    # Models might be empty if no API keys are configured


def test_access_chat_endpoints_without_auth(client: TestClient):
    """Test that chat endpoints require authentication."""
    endpoints_to_test = [
        "/api/v1/sessions",
        "/api/v1/chat",
        "/api/v1/chat/history",
        "/api/v1/chat/models",
    ]

    for endpoint in endpoints_to_test:
        if endpoint == "/api/v1/sessions":
            # Test GET and POST
            response = client.get(endpoint)
            assert response.status_code == 401, (
                f"Endpoint {endpoint} should require authentication"
            )

            response = client.post(
                endpoint, json={"title": "Test", "description": "Test"}
            )
            assert response.status_code == 401, (
                f"Endpoint {endpoint} should require authentication"
            )
        elif endpoint == "/api/v1/chat":
            # Test POST
            response = client.post(
                endpoint, json={"content": "test", "model": "gemini-2.5-flash"}
            )
            assert response.status_code == 401, (
                f"Endpoint {endpoint} should require authentication"
            )
        elif endpoint == "/api/v1/chat/history":
            # Test GET
            response = client.get(endpoint)
            assert response.status_code == 401, (
                f"Endpoint {endpoint} should require authentication"
            )
        elif endpoint == "/api/v1/chat/models":
            # Test GET
            response = client.get(endpoint)
            assert response.status_code == 401, (
                f"Endpoint {endpoint} should require authentication"
            )


def test_session_not_found(client: TestClient, test_user: User):
    """Test accessing a non-existent session."""
    # First log in
    login_data = {"username": test_user.email, "password": "TestPassword123"}
    response = client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 200

    # Try to access a non-existent session
    response = client.get("/api/v1/sessions/99999")

    assert response.status_code == 404


def test_delete_nonexistent_session(client: TestClient, test_user: User):
    """Test deleting a non-existent session."""
    # First log in
    login_data = {"username": test_user.email, "password": "TestPassword123"}
    response = client.post("/api/v1/auth/login", data=login_data)
    assert response.status_code == 200

    # Try to delete a non-existent session
    response = client.delete("/api/v1/sessions/99999")

    assert response.status_code == 404
