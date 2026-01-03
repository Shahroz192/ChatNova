import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from app.services.ai_chat import AIChatService
from app.models.user import User
from app.models.memory import UserMemory
from sqlalchemy.orm import Session

@pytest.mark.asyncio
async def test_simple_chat_includes_relevant_memories():
    """Test that simple_chat includes relevant memories in the system prompt."""
    service = AIChatService()
    
    # Mock dependencies
    db = MagicMock(spec=Session)
    user_id = 1
    
    mock_user = MagicMock(spec=User)
    mock_user.id = user_id
    mock_user.custom_instructions = None
    
    memory = MagicMock(spec=UserMemory)
    memory.content = "I have a cat named Luna."
    
    with patch("app.crud.user.user.get", return_value=mock_user), \
         patch("app.crud.memory.memory.get_by_user", return_value=[memory]), \
         patch("app.core.cache.cache_manager.get_llm_response", return_value=None):
        
        mock_llm = MagicMock()
        async def mock_astream(*args, **kwargs):
            yield "Test response"
        mock_llm.astream = mock_astream
        mock_llm.ainvoke = AsyncMock(return_value="- I have a cat named Luna.") # Filter return
        
        with patch.object(service, "get_llm", return_value=mock_llm):
            with patch("app.services.ai_chat.ChatPromptTemplate.from_messages") as mock_from_messages:
                mock_prompt = MagicMock()
                mock_prompt.__or__.return_value = mock_prompt
                mock_prompt.astream = mock_astream
                mock_from_messages.return_value = mock_prompt
                
                async for _ in service.simple_chat(
                    message="What is my cat's name?",
                    model_name="gemini-2.5-flash",
                    user_id=user_id,
                    db=db
                ):
                    pass
                
                # Check if system prompt included the memory
                # It might be called multiple times (one for filter, one for chat)
                # We want the chat one (which has the longest list of messages)
                chat_call = [call for call in mock_from_messages.call_args_list if len(call[0][0]) > 2][0]
                messages = chat_call[0][0]
                system_msg = next(m for m in messages if m[0] == "system")[1]
                
                assert "Luna" in system_msg
                assert "User Context (Memories)" in system_msg
