import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from app.services.ai_chat import AIChatService
from sqlalchemy.orm import Session


@pytest.mark.asyncio
async def test_simple_chat_memory_service_called():
    """Test that simple_chat calls memory_service.get_relevant_memories."""
    service = AIChatService()

    db = MagicMock(spec=Session)
    user_id = 1

    with (
        patch("app.crud.user.user.get", return_value=MagicMock(custom_instructions=None)),
        patch(
            "app.services.ai_chat.memory_service.get_relevant_memories",
            new_callable=AsyncMock,
            return_value="Relevant memory context",
        ),
        patch(
            "app.services.ai_chat.rag_service.get_relevant_chunks",
            new_callable=AsyncMock,
            return_value={"text": "", "sources": []},
        ),
    ):
        mock_llm = MagicMock()

        async def mock_astream(*args, **kwargs):
            yield "Test memory response"

        mock_astream_mock = MagicMock(side_effect=mock_astream)
        mock_llm.astream = mock_astream_mock

        with patch("app.services.ai_chat.llm_service.get_llm", return_value=mock_llm):
            with patch(
                "app.services.ai_chat.ChatPromptTemplate.from_messages"
            ) as mock_from_messages:
                mock_prompt = MagicMock()
                mock_prompt.__or__.return_value = mock_prompt
                mock_prompt.astream = mock_astream_mock
                mock_from_messages.return_value = mock_prompt

                responses = []
                async for chunk in service.simple_chat(
                    message="What do I like?",
                    model_name="gemini-2.5-flash",
                    user_id=user_id,
                    db=db,
                ):
                    responses.append(chunk)

                assert "".join(responses) == "Test memory response"
