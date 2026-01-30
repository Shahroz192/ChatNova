from sqlalchemy.orm import Session
from app.models.user import User
from datetime import datetime


def test_create_memory_model(db_session: Session, test_user: User):
    """Test that we can create a UserMemory model and link it to a user."""
    # This will fail initially because UserMemory is not defined
    from app.models.memory import UserMemory

    content = "I live in San Francisco."
    memory = UserMemory(user_id=test_user.id, content=content)
    db_session.add(memory)
    db_session.commit()
    db_session.refresh(memory)

    assert memory.id is not None
    assert memory.user_id == test_user.id
    assert memory.content == content
    assert isinstance(memory.created_at, datetime)
    assert memory.last_accessed_at is not None


def test_user_memory_relationship(db_session: Session, test_user: User):
    """Test the relationship between User and UserMemory."""
    from app.models.memory import UserMemory

    memory1 = UserMemory(user_id=test_user.id, content="Fact 1")
    memory2 = UserMemory(user_id=test_user.id, content="Fact 2")
    db_session.add_all([memory1, memory2])
    db_session.commit()

    # Reload user
    db_session.refresh(test_user)

    # Check if user has memories attribute
    assert hasattr(test_user, "memories")
    assert len(test_user.memories) == 2
    assert any(m.content == "Fact 1" for m in test_user.memories)
