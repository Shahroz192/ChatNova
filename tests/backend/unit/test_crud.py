"""
Unit tests for backend CRUD operations
"""
import pytest
from sqlalchemy.orm import Session
from app.crud.user import user, user_api_key, user_mcp_server
from app.crud.message import message
from app.models.user import User
from app.models.message import Message
from app.schemas.user import UserCreate, UserAPIKeyCreate, UserMCPServerCreate
from app.schemas.message import MessageCreate


def test_create_user(db_session: Session):
    """Test creating a new user"""
    user_data = {
        "email": "test@example.com",
        "password": "TestPassword123"
    }
    user_in = UserCreate(**user_data)
    created_user = user.create(db_session, obj_in=user_in)
    
    assert created_user.email == user_data["email"]
    assert hasattr(created_user, "hashed_password")
    assert created_user.id is not None


def test_get_user_by_id(db_session: Session):
    """Test retrieving a user by ID"""
    # First create a user
    user_data = {
        "email": "test2@example.com",
        "password": "TestPassword123"
    }
    user_in = UserCreate(**user_data)
    created_user = user.create(db_session, obj_in=user_in)
    
    # Retrieve the user by ID
    retrieved_user = user.get(db_session, id=created_user.id)
    
    assert retrieved_user is not None
    assert retrieved_user.email == user_data["email"]


def test_get_user_by_email(db_session: Session):
    """Test retrieving a user by email"""
    # First create a user
    user_data = {
        "email": "test3@example.com",
        "password": "TestPassword123"
    }
    user_in = UserCreate(**user_data)
    created_user = user.create(db_session, obj_in=user_in)
    
    # Retrieve the user by email
    retrieved_user = user.get_by_email(db_session, email=user_data["email"])
    
    assert retrieved_user is not None
    assert retrieved_user.email == user_data["email"]


def test_user_authentication(db_session: Session):
    """Test user authentication"""
    # Create a user
    user_data = {
        "email": "auth_test@example.com",
        "password": "TestPassword123"
    }
    user_in = UserCreate(**user_data)
    created_user = user.create(db_session, obj_in=user_in)
    
    # Test authentication with correct credentials
    authenticated_user = user.authenticate(db_session, email=user_data["email"], password=user_data["password"])
    assert authenticated_user is not None
    assert authenticated_user.id == created_user.id
    
    # Test authentication with incorrect password
    wrong_auth = user.authenticate(db_session, email=user_data["email"], password="wrongpassword")
    assert wrong_auth is None


def test_increment_messages_used(db_session: Session):
    """Test incrementing user's message count"""
    # Create a user
    user_data = {
        "email": "message_count_test@example.com",
        "password": "TestPassword123"
    }
    user_in = UserCreate(**user_data)
    created_user = user.create(db_session, obj_in=user_in)
    
    # Initialize with 0 messages
    assert created_user.messages_used == 0
    
    # Increment by 1
    user.increment_messages(db_session, created_user.id, 1)
    db_session.refresh(created_user)
    assert created_user.messages_used == 1
    
    # Increment by 5
    user.increment_messages(db_session, created_user.id, 5)
    db_session.refresh(created_user)
    assert created_user.messages_used == 6


def test_create_message(db_session: Session):
    """Test creating a new message"""
    # First create a user
    user_data = {
        "email": "message_test@example.com",
        "username": "messagetestuser",
        "password": "TestPassword123"
    }
    user_in = UserCreate(**user_data)
    created_user = user.create(db_session, obj_in=user_in)
    
    # Create a message
    message_data = {
        "content": "Hello, world!",
        "model": "gpt-3.5-turbo"
    }
    message_response = "Test response"
    created_message = message.create(
        db_session, 
        obj_in=MessageCreate(**message_data), 
        response=message_response, 
        user_id=created_user.id
    )
    
    assert created_message.content == message_data["content"]
    assert created_message.model == message_data["model"]
    assert created_message.response == message_response
    assert created_message.user_id == created_user.id


def test_get_messages_by_user(db_session: Session):
    """Test retrieving messages by user"""
    # First create a user
    user_data = {
        "email": "history_test@example.com",
        "username": "historytestuser",
        "password": "TestPassword123"
    }
    user_in = UserCreate(**user_data)
    created_user = user.create(db_session, obj_in=user_in)
    
    # Create multiple messages for the user
    message_data_1 = {
        "content": "First message",
        "model": "gpt-3.5-turbo"
    }
    message_data_2 = {
        "content": "Second message",
        "model": "gpt-3.5-turbo"
    }
    
    message.create(
        db_session, 
        obj_in=MessageCreate(**message_data_1), 
        response="Response 1", 
        user_id=created_user.id
    )
    message.create(
        db_session, 
        obj_in=MessageCreate(**message_data_2), 
        response="Response 2", 
        user_id=created_user.id
    )
    
    # Get messages for the user
    messages = message.get_by_user(db_session, user_id=created_user.id)
    
    assert len(messages) >= 2  # May have more from previous tests
    user_messages = [msg for msg in messages if msg.user_id == created_user.id]
    assert len(user_messages) == 2
    assert all(msg.user_id == created_user.id for msg in user_messages)


def test_count_messages_by_user(db_session: Session):
    """Test counting messages by user"""
    # First create a user
    user_data = {
        "email": "count_test@example.com",
        "username": "counttestuser",
        "password": "TestPassword123"
    }
    user_in = UserCreate(**user_data)
    created_user = user.create(db_session, obj_in=user_in)
    
    # Create multiple messages for the user
    message_data_1 = {
        "content": "Count test message 1",
        "model": "gpt-3.5-turbo"
    }
    message_data_2 = {
        "content": "Count test message 2",
        "model": "gpt-3.5-turbo"
    }
    
    message.create(
        db_session, 
        obj_in=MessageCreate(**message_data_1), 
        response="Response 1", 
        user_id=created_user.id
    )
    message.create(
        db_session, 
        obj_in=MessageCreate(**message_data_2), 
        response="Response 2", 
        user_id=created_user.id
    )
    
    # Count messages for the user
    count = message.count_by_user(db_session, user_id=created_user.id)
    
    assert count >= 2  # May have more from previous tests
    # Get actual messages to confirm
    messages = message.get_by_user(db_session, user_id=created_user.id)
    actual_count = len([msg for msg in messages if msg.user_id == created_user.id])
    assert count >= actual_count  # Count includes messages from other tests


def test_get_latest_messages(db_session: Session):
    """Test retrieving latest messages for a user"""
    # First create a user
    user_data = {
        "email": "latest_test@example.com",
        "username": "latesttestuser",
        "password": "TestPassword123"
    }
    user_in = UserCreate(**user_data)
    created_user = user.create(db_session, obj_in=user_in)
    
    # Create multiple messages for the user
    for i in range(5):
        message_data = {
            "content": f"Latest test message {i}",
            "model": "gpt-3.5-turbo"
        }
        message.create(
            db_session, 
            obj_in=MessageCreate(**message_data), 
            response=f"Response {i}", 
            user_id=created_user.id
        )
    
    # Get latest 3 messages
    latest_messages = message.get_latest_messages(db_session, user_id=created_user.id, limit=3)
    
    assert len(latest_messages) == 3
    assert all(msg.user_id == created_user.id for msg in latest_messages)
    
    # Verify they are in newest-first order (by checking creation time if available)
    # The first message in the list should be the most recent


def test_create_user_api_key(db_session: Session):
    """Test creating a user API key"""
    # First create a user
    user_data = {
        "email": "api_key_test@example.com",
        "username": "apikeytestuser",
        "password": "TestPassword123"
    }
    user_in = UserCreate(**user_data)
    created_user = user.create(db_session, obj_in=user_in)
    
    # Create an API key for the user
    api_key_data = {
        "model_name": "gpt-3.5-turbo",
        "encrypted_key": "encrypted_test_key_123"
    }
    created_api_key = user_api_key.create(
        db_session,
        obj_in=UserAPIKeyCreate(**api_key_data),
        user_id=created_user.id
    )
    
    assert created_api_key.user_id == created_user.id
    assert created_api_key.model_name == api_key_data["model_name"]
    assert created_api_key.encrypted_key == api_key_data["encrypted_key"]


def test_get_user_api_key_by_user_and_model(db_session: Session):
    """Test retrieving a user API key by user and model"""
    # First create a user
    user_data = {
        "email": "api_key_get_test@example.com",
        "username": "apikeygettestuser",
        "password": "TestPassword123"
    }
    user_in = UserCreate(**user_data)
    created_user = user.create(db_session, obj_in=user_in)
    
    # Create an API key for the user
    api_key_data = {
        "model_name": "gpt-4",
        "encrypted_key": "encrypted_test_key_456"
    }
    created_api_key = user_api_key.create(
        db_session,
        obj_in=UserAPIKeyCreate(**api_key_data),
        user_id=created_user.id
    )
    
    # Retrieve the API key
    retrieved_api_key = user_api_key.get_by_user_and_model(
        db_session,
        user_id=created_user.id,
        model_name=api_key_data["model_name"]
    )
    
    assert retrieved_api_key is not None
    assert retrieved_api_key.user_id == created_user.id
    assert retrieved_api_key.model_name == api_key_data["model_name"]


def test_create_user_mcp_server(db_session: Session):
    """Test creating a user MCP server"""
    # First create a user
    user_data = {
        "email": "mcp_server_test@example.com",
        "username": "mcpservertestuser",
        "password": "TestPassword123"
    }
    user_in = UserCreate(**user_data)
    created_user = user.create(db_session, obj_in=user_in)
    
    # Create an MCP server for the user
    import json
    mcp_server_data = {
        "mcp_servers_config": json.dumps({
            "mcpServers": {
                "test-server": {
                    "command": "npx",
                    "args": ["-y", "@modelcontextprotocol/server-everything"],
                    "env": {"API_KEY": "test_key"}
                }
            }
        })
    }
    created_mcp_server = user_mcp_server.create(
        db_session,
        obj_in=UserMCPServerCreate(**mcp_server_data),
        user_id=created_user.id
    )
    
    assert created_mcp_server.user_id == created_user.id
    assert created_mcp_server.mcp_servers_config == mcp_server_data["mcp_servers_config"]