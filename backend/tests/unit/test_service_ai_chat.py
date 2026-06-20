import pytest
from unittest.mock import MagicMock, patch
from app.services.ai_chat import AIChatService

@pytest.fixture
def ai_service():
    return AIChatService()

@pytest.mark.asyncio
async def test_simple_chat_basic(ai_service):
    mock_llm = MagicMock()

    async def mock_astream(*args, **kwargs):
        yield "Hello"

    # We need to mock the chain's astream
    mock_chain = MagicMock()
    mock_chain.astream = MagicMock(side_effect=mock_astream)

    with patch("app.services.ai_chat.llm_service.get_llm", return_value=mock_llm),          patch("app.services.ai_chat.ChatPromptTemplate.from_messages", return_value=MagicMock(__or__=MagicMock(return_value=mock_chain))),          patch("app.services.ai_chat.memory_service.get_relevant_memories", return_value=""),          patch("app.services.ai_chat.rag_service.get_relevant_chunks", return_value={"text": "", "sources": []}),          patch("app.services.ai_chat.ui_generator_service.generate_ui", return_value=None):

                responses = []
                async for chunk in ai_service.simple_chat("hi", "gemini-2.5-flash", 1, MagicMock()):
                    responses.append(chunk)
                assert "Hello" in "".join(responses)
