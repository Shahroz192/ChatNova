from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.memory import UserMemory


def test_create_memory(client: TestClient, test_user: User):
    """Test creating a memory via API."""
    # Login
    client.post(
        "/api/v1/auth/login",
        data={"username": test_user.email, "password": "TestPassword123"},
    )

    content = "I like playing tennis."
    response = client.post("/api/v1/memories", json={"content": content})

    assert response.status_code == 200
    data = response.json()
    assert data["content"] == content
    assert data["user_id"] == test_user.id


def test_read_memories(client: TestClient, test_user: User, db_session: Session):
    """Test reading memories via API."""
    # Add some memories manually
    memory1 = UserMemory(user_id=test_user.id, content="Fact 1")
    memory2 = UserMemory(user_id=test_user.id, content="Fact 2")
    db_session.add_all([memory1, memory2])
    db_session.commit()

    # Login
    client.post(
        "/api/v1/auth/login",
        data={"username": test_user.email, "password": "TestPassword123"},
    )

    response = client.get("/api/v1/memories")

    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    assert any(m["content"] == "Fact 1" for m in data)


def test_delete_memory(client: TestClient, test_user: User, db_session: Session):
    """Test deleting a memory via API."""
    memory = UserMemory(user_id=test_user.id, content="To be deleted")
    db_session.add(memory)
    db_session.commit()
    db_session.refresh(memory)

    # Login
    client.post(
        "/api/v1/auth/login",
        data={"username": test_user.email, "password": "TestPassword123"},
    )

    response = client.delete(f"/api/v1/memories/{memory.id}")

    assert response.status_code == 200

    # Verify it's gone
    db_session.expire_all()
    db_memory = db_session.get(UserMemory, memory.id)
    assert db_memory is None
