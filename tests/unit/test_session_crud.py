import pytest
from sqlalchemy.orm import Session
from app import crud
from app.schemas.session import ChatSessionCreate, ChatSessionUpdate
from app.models.session import ChatSession
from app.models.user import User


def test_create_session(db_session: Session, test_user: User):
    """Test creating a new chat session."""
    session_in = ChatSessionCreate(
        title="Test Session",
        description="A test chat session"
    )
    session = crud.session.create(
        db_session, 
        obj_in=session_in, 
        user_id=test_user.id
    )
    
    assert session.title == session_in.title
    assert session.description == session_in.description
    assert session.user_id == test_user.id
    assert session.id is not None


def test_get_session(db_session: Session, test_user: User):
    """Test retrieving a session by ID."""
    # Create a session first
    session_in = ChatSessionCreate(
        title="Test Session",
        description="A test chat session"
    )
    created_session = crud.session.create(
        db_session, 
        obj_in=session_in, 
        user_id=test_user.id
    )
    
    # Retrieve the session
    session = crud.session.get(db_session, id=created_session.id)
    
    assert session is not None
    assert session.id == created_session.id
    assert session.title == "Test Session"


def test_update_session(db_session: Session, test_user: User):
    """Test updating a session."""
    # Create a session first
    session_in = ChatSessionCreate(
        title="Original Title",
        description="Original Description"
    )
    created_session = crud.session.create(
        db_session, 
        obj_in=session_in, 
        user_id=test_user.id
    )
    
    # Update the session
    session_update = ChatSessionUpdate(
        title="Updated Title",
        description="Updated Description"
    )
    updated_session = crud.session.update(
        db_session, 
        db_obj=created_session, 
        obj_in=session_update
    )
    
    assert updated_session.title == "Updated Title"
    assert updated_session.description == "Updated Description"


def test_delete_session(db_session: Session, test_user: User):
    """Test deleting a session."""
    # Create a session first
    session_in = ChatSessionCreate(
        title="To Delete",
        description="Session to be deleted"
    )
    created_session = crud.session.create(
        db_session, 
        obj_in=session_in, 
        user_id=test_user.id
    )
    
    # Delete the session
    deleted_session = crud.session.remove(db_session, id=created_session.id)
    
    assert deleted_session.id == created_session.id
    
    # Verify the session no longer exists
    session = crud.session.get(db_session, id=created_session.id)
    assert session is None


def test_get_sessions_by_user(db_session: Session, test_user: User):
    """Test retrieving all sessions for a user."""
    # Create multiple sessions for the user
    session_in1 = ChatSessionCreate(title="Session 1", description="First session")
    session_in2 = ChatSessionCreate(title="Session 2", description="Second session")
    
    crud.session.create(db_session, obj_in=session_in1, user_id=test_user.id)
    crud.session.create(db_session, obj_in=session_in2, user_id=test_user.id)
    
    # Retrieve sessions for the user
    sessions = crud.session.get_by_user(db_session, user_id=test_user.id)
    
    assert len(sessions) == 2
    session_titles = [s.title for s in sessions]
    assert "Session 1" in session_titles
    assert "Session 2" in session_titles


def test_count_sessions_by_user(db_session: Session, test_user: User):
    """Test counting sessions for a user."""
    # Create multiple sessions for the user
    session_in1 = ChatSessionCreate(title="Session 1", description="First session")
    session_in2 = ChatSessionCreate(title="Session 2", description="Second session")
    
    crud.session.create(db_session, obj_in=session_in1, user_id=test_user.id)
    crud.session.create(db_session, obj_in=session_in2, user_id=test_user.id)
    
    # Count sessions for the user
    count = crud.session.count_by_user(db_session, user_id=test_user.id)
    
    assert count == 2


def test_get_sessions_by_user_with_search(db_session: Session, test_user: User):
    """Test retrieving sessions for a user with search functionality."""
    # Create multiple sessions for the user
    session_in1 = ChatSessionCreate(title="Python Help", description="Python programming help")
    session_in2 = ChatSessionCreate(title="JavaScript Guide", description="JavaScript guide")
    session_in3 = ChatSessionCreate(title="AI Discussion", description="AI-related discussion")
    
    crud.session.create(db_session, obj_in=session_in1, user_id=test_user.id)
    crud.session.create(db_session, obj_in=session_in2, user_id=test_user.id)
    crud.session.create(db_session, obj_in=session_in3, user_id=test_user.id)
    
    # Search for sessions containing "Python"
    sessions = crud.session.get_by_user_with_message_count(db_session, user_id=test_user.id, search="Python")
    
    assert len(sessions) == 1
    assert sessions[0]["title"] == "Python Help"
    
    # Search for sessions containing "Guide"
    sessions = crud.session.get_by_user_with_message_count(db_session, user_id=test_user.id, search="Guide")
    
    assert len(sessions) == 1
    assert sessions[0]["title"] == "JavaScript Guide"


def test_get_session_by_id_not_found(db_session: Session):
    """Test retrieving a session that doesn't exist."""
    session = crud.session.get(db_session, id=99999)  # Non-existent ID
    
    assert session is None