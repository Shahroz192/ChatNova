import pytest
from sqlalchemy.orm import Session
from app import crud
from app.schemas.message import MessageCreate
from app.models.message import Message
from app.models.user import User
from app.models.session import ChatSession


def test_create_message(db_session: Session, test_user: User):
    """Test creating a new message."""
    message_in = MessageCreate(
        content="Hello, this is a test message",
        model="gpt-4"
    )
    message = crud.message.create(
        db_session,
        obj_in=message_in,
        response="This is the AI response",
        user_id=test_user.id
    )
    
    assert message.content == message_in.content
    assert message.model == message_in.model
    assert message.response == "This is the AI response"
    assert message.user_id == test_user.id
    assert message.id is not None


def test_create_message_with_session(db_session: Session, test_user: User):
    """Test creating a message associated with a session."""
    # Create a session first
    from app.schemas.session import ChatSessionCreate
    session_in = ChatSessionCreate(title="Test Session", description="A test session")
    session = crud.session.create(
        db_session, 
        obj_in=session_in, 
        user_id=test_user.id
    )
    
    # Create a message with the session
    message_in = MessageCreate(
        content="Hello, this is a test message for a session",
        model="gpt-4"
    )
    message = crud.message.create(
        db_session,
        obj_in=message_in,
        response="This is the AI response for session",
        user_id=test_user.id,
        session_id=session.id
    )
    
    assert message.content == message_in.content
    assert message.session_id == session.id
    assert message.user_id == test_user.id


def test_get_message(db_session: Session, test_user: User):
    """Test retrieving a message by ID."""
    # Create a message first
    message_in = MessageCreate(
        content="Test message content",
        model="gpt-4"
    )
    created_message = crud.message.create(
        db_session,
        obj_in=message_in,
        response="Test response",
        user_id=test_user.id
    )
    
    # Retrieve the message
    message = crud.message.get(db_session, id=created_message.id)
    
    assert message is not None
    assert message.id == created_message.id
    assert message.content == "Test message content"


def test_update_message(db_session: Session, test_user: User):
    """Test updating a message."""
    # Create a message first
    message_in = MessageCreate(
        content="Original content",
        model="gpt-4"
    )
    created_message = crud.message.create(
        db_session,
        obj_in=message_in,
        response="Original response",
        user_id=test_user.id
    )
    
    # Update the message
    updated_message = crud.message.update(
        db_session,
        db_obj=created_message,
        obj_in={"response": "Updated response"}
    )
    
    assert updated_message.response == "Updated response"


def test_delete_message(db_session: Session, test_user: User):
    """Test deleting a message."""
    # Create a message first
    message_in = MessageCreate(
        content="Message to delete",
        model="gpt-4"
    )
    created_message = crud.message.create(
        db_session,
        obj_in=message_in,
        response="Response to delete",
        user_id=test_user.id
    )
    
    # Delete the message
    deleted_message = crud.message.remove(db_session, id=created_message.id)
    
    assert deleted_message.id == created_message.id
    
    # Verify the message no longer exists
    message = crud.message.get(db_session, id=created_message.id)
    assert message is None


def test_get_messages_by_user(db_session: Session, test_user: User):
    """Test retrieving all messages for a user."""
    # Create multiple messages for the user
    message_in1 = MessageCreate(content="Message 1", model="gpt-4")
    message_in2 = MessageCreate(content="Message 2", model="gpt-4")
    
    crud.message.create(db_session, obj_in=message_in1, response="Response 1", user_id=test_user.id)
    crud.message.create(db_session, obj_in=message_in2, response="Response 2", user_id=test_user.id)
    
    # Retrieve messages for the user
    messages = crud.message.get_by_user(db_session, user_id=test_user.id)
    
    assert len(messages) == 2
    message_contents = [m.content for m in messages]
    assert "Message 1" in message_contents
    assert "Message 2" in message_contents


def test_count_messages_by_user(db_session: Session, test_user: User):
    """Test counting messages for a user."""
    # Create multiple messages for the user
    message_in1 = MessageCreate(content="Message 1", model="gpt-4")
    message_in2 = MessageCreate(content="Message 2", model="gpt-4")
    message_in3 = MessageCreate(content="Message 3", model="gpt-4")
    
    crud.message.create(db_session, obj_in=message_in1, response="Response 1", user_id=test_user.id)
    crud.message.create(db_session, obj_in=message_in2, response="Response 2", user_id=test_user.id)
    crud.message.create(db_session, obj_in=message_in3, response="Response 3", user_id=test_user.id)
    
    # Count messages for the user
    count = crud.message.count_by_user(db_session, user_id=test_user.id)
    
    assert count == 3


def test_get_messages_by_user_with_session_filter(db_session: Session, test_user: User):
    """Test retrieving messages for a user filtered by session."""
    # Create a session
    from app.schemas.session import ChatSessionCreate
    session_in = ChatSessionCreate(title="Test Session", description="A test session")
    session = crud.session.create(
        db_session, 
        obj_in=session_in, 
        user_id=test_user.id
    )
    
    # Create messages - some with session, some without
    message_in1 = MessageCreate(content="Message with session", model="gpt-4")
    message_in2 = MessageCreate(content="Message without session", model="gpt-4")
    
    crud.message.create(
        db_session, 
        obj_in=message_in1, 
        response="Response 1", 
        user_id=test_user.id, 
        session_id=session.id
    )
    crud.message.create(
        db_session, 
        obj_in=message_in2, 
        response="Response 2", 
        user_id=test_user.id
    )
    
    # Retrieve messages for the user with session filter
    messages = crud.message.get_by_user(
        db_session, 
        user_id=test_user.id, 
        session_id=session.id
    )
    
    assert len(messages) == 1
    assert messages[0].content == "Message with session"


def test_get_messages_by_user_with_search(db_session: Session, test_user: User):
    """Test retrieving messages for a user with search functionality."""
    # Create multiple messages for the user
    message_in1 = MessageCreate(content="Python is great for AI", model="gpt-4")
    message_in2 = MessageCreate(content="JavaScript for web development", model="gpt-4")
    message_in3 = MessageCreate(content="AI and machine learning", model="gpt-4")
    
    crud.message.create(db_session, obj_in=message_in1, response="Python response", user_id=test_user.id)
    crud.message.create(db_session, obj_in=message_in2, response="JavaScript response", user_id=test_user.id)
    crud.message.create(db_session, obj_in=message_in3, response="AI response", user_id=test_user.id)
    
    # Search for messages containing "AI"
    messages = crud.message.get_by_user(db_session, user_id=test_user.id, search="AI")
    
    assert len(messages) == 2  # "AI" appears in messages 1 and 3
    contents = [m.content for m in messages]
    assert "Python is great for AI" in contents
    assert "AI and machine learning" in contents


def test_get_message_by_id_not_found(db_session: Session):
    """Test retrieving a message that doesn't exist."""
    message = crud.message.get(db_session, id=99999)  # Non-existent ID
    
    assert message is None