import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from app.services.ai_chat import AIChatService, sanitize_user_input

def test_sanitize_user_input():
    assert sanitize_user_input("  hello  ") == "hello"
    assert sanitize_user_input("hello\x00world") == "helloworld"
    long_input = "a" * 6000
    assert len(sanitize_user_input(long_input)) == 5000
    assert sanitize_user_input(None) is None

@pytest.fixture
def ai_service():
    with patch("app.services.ai_chat.MCPClient.from_config_file") as mock_mcp:
        service = AIChatService()
        return service

def test_get_provider_key(ai_service):
    db = MagicMock()
    user_id = 1
    provider = "Google"
    
    mock_key_obj = MagicMock()
    mock_key_obj.encrypted_key = "encrypted_key"
    
    with patch("app.services.ai_chat.user_api_key.get_by_user_and_model") as mock_get_key:
        mock_get_key.return_value = mock_key_obj
        with patch("app.services.ai_chat.decrypt_api_key") as mock_decrypt:
            mock_decrypt.return_value = "decrypted_key"
            
            key = ai_service.get_provider_key(provider, user_id, db)
            assert key == "decrypted_key"

def test_get_llm(ai_service):
    db = MagicMock()
    user_id = 1
    model_name = "gemini-2.5-flash"
    
    with patch.object(ai_service, "get_provider_key", return_value="test_api_key"):
        mock_llm_class = MagicMock()
        ai_service.llm_configs[model_name]["class"] = mock_llm_class
        
        llm = ai_service.get_llm(model_name, user_id, db)
        assert llm is not None
        mock_llm_class.assert_called_once()

def test_get_session_memory(ai_service):
    session_id = 123
    memory = ai_service.get_session_memory(session_id)
    assert memory.memory_key == "chat_history"
    assert ai_service.get_session_memory(session_id) is memory

@pytest.mark.asyncio
async def test_simple_chat_cached(ai_service):
    with patch("app.services.ai_chat.cache_manager") as mock_cache:
        mock_cache.get_llm_response.return_value = ["cached ", "response"]
        
        with patch.object(ai_service, "get_llm", return_value=MagicMock()):
            responses = []
            async for chunk in ai_service.simple_chat("hello", "gemini-2.5-flash", user_id=1):
                responses.append(chunk)
                
            assert "".join(responses) == "cached response"

@pytest.mark.asyncio
async def test_get_relevant_memories_small(ai_service):
    db = MagicMock()
    user_id = 1
    llm = MagicMock()
    
    with patch("app.crud.memory.memory.get_by_user") as mock_get_by_user:
        mock_mem = MagicMock()
        mock_mem.content = "I like apples"
        mock_get_by_user.return_value = [mock_mem]
        
        result = await ai_service.get_relevant_memories("query", user_id, db, llm)
        assert "I like apples" in result

@pytest.mark.asyncio
async def test_get_relevant_memories_large(ai_service):
    db = MagicMock()
    user_id = 1
    llm = AsyncMock()
    
    memories = [MagicMock(content=f"Fact {i}") for i in range(6)]
    
    with patch("app.crud.memory.memory.get_by_user", return_value=memories):
        
        with patch("app.services.ai_chat.ChatPromptTemplate.from_messages") as mock_prompt:
            mock_chain = AsyncMock()
            mock_chain.ainvoke.return_value = "Fact 1\nFact 2"
            mock_prompt.return_value.__or__.return_value.__or__.return_value = mock_chain
            
            result = await ai_service.get_relevant_memories("query", user_id, db, llm)
            assert "Fact 1" in result
            assert "Fact 2" in result
            assert "Fact 0" not in result
