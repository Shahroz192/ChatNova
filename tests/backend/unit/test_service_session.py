import pytest
from unittest.mock import MagicMock, patch
from app.services.session_service import ChatSessionService
from app.schemas.session import ChatSessionUpdate

@pytest.fixture
def session_service():
    return ChatSessionService()

def test_create_session(session_service):
    db = MagicMock()
    user = MagicMock()
    user.id = 1
    title = "Test Session"
    
    mock_session_obj = MagicMock()
    mock_session_obj.id = 101
    mock_session_obj.user_id = 1
    mock_session_obj.title = title
    mock_session_obj.description = None
    mock_session_obj.created_at = "now"
    mock_session_obj.updated_at = "now"
    
    with patch("app.services.session_service.session_crud.create") as mock_create:
        mock_create.return_value = mock_session_obj
        
        result = session_service.create_session(db, user, title)
        
        assert result["id"] == 101
        assert result["title"] == title
        assert result["message_count"] == 0
        mock_create.assert_called_once()

def test_get_user_sessions(session_service):
    db = MagicMock()
    user = MagicMock()
    user.id = 1
    
    mock_sessions = [{"id": 1, "title": "Session 1", "message_count": 5}]
    
    with patch("app.services.session_service.session_crud.get_by_user_with_message_count") as mock_get:
        mock_get.return_value = mock_sessions
        
        result = session_service.get_user_sessions(db, user)
        assert result == mock_sessions
        mock_get.assert_called_once()

def test_get_session_by_id(session_service):
    db = MagicMock()
    user = MagicMock()
    user.id = 1
    session_id = 101
    
    mock_session_obj = MagicMock()
    mock_session_obj.id = session_id
    mock_session_obj.user_id = 1
    mock_session_obj.title = "Title"
    
    with patch("app.services.session_service.session_crud.get") as mock_get_session:
        mock_get_session.return_value = mock_session_obj
        with patch("app.services.session_service.message_crud.count_by_user") as mock_count:
            mock_count.return_value = 10
            
            result = session_service.get_session_by_id(db, session_id, user)
            assert result["id"] == session_id
            assert result["message_count"] == 10

def test_get_session_by_id_wrong_user(session_service):
    db = MagicMock()
    user = MagicMock()
    user.id = 1
    session_id = 101
    
    mock_session_obj = MagicMock()
    mock_session_obj.user_id = 2 # Different user
    
    with patch("app.services.session_service.session_crud.get", return_value=mock_session_obj):
        result = session_service.get_session_by_id(db, session_id, user)
        assert result is None

def test_update_session(session_service):
    db = MagicMock()
    user = MagicMock()
    user.id = 1
    session_id = 101
    
    mock_session_obj = MagicMock()
    mock_session_obj.user_id = 1
    
    mock_updated_session = MagicMock()
    mock_updated_session.id = session_id
    mock_updated_session.title = "New Title"
    
    update_data = ChatSessionUpdate(title="New Title")
    
    with patch("app.services.session_service.session_crud.get", return_value=mock_session_obj):
        with patch("app.services.session_service.session_crud.update") as mock_update:
            mock_update.return_value = mock_updated_session
            with patch("app.services.session_service.message_crud.count_by_user", return_value=0):
                result = session_service.update_session(db, session_id, user, update_data)
                assert result["title"] == "New Title"

def test_delete_session(session_service):
    db = MagicMock()
    user = MagicMock()
    user.id = 1
    session_id = 101
    
    mock_session_obj = MagicMock()
    mock_session_obj.user_id = 1
    
    with patch("app.services.session_service.session_crud.get", return_value=mock_session_obj):
        with patch("app.services.session_service.session_crud.remove") as mock_remove:
            success = session_service.delete_session(db, session_id, user)
            assert success is True
            mock_remove.assert_called_once_with(db, id=session_id)
