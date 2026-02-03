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

    with (
        patch("app.crud.user.user.get", return_value=mock_user),
        patch("app.crud.memory.memory.get_by_user", return_value=[memory]),
        patch("app.core.cache.cache_manager.get_llm_response", return_value=None),
    ):
        mock_llm = MagicMock()

        async def mock_astream(*args, **kwargs):
            yield "Test response"

        mock_astream_mock = MagicMock(side_effect=mock_astream)
        mock_llm.astream = mock_astream_mock
        mock_llm.ainvoke = AsyncMock(
            return_value="- I have a cat named Luna."
        )  # Filter return

        with patch.object(service, "get_llm", return_value=mock_llm):
            with patch(
                "app.services.ai_chat.ChatPromptTemplate.from_messages"
            ) as mock_from_messages:
                mock_prompt = MagicMock()
                mock_prompt.__or__.return_value = mock_prompt
                mock_prompt.astream = mock_astream_mock
                mock_from_messages.return_value = mock_prompt

                async for _ in service.simple_chat(
                    message="What is my cat's name?",
                    model_name="gemini-2.5-flash",
                    user_id=user_id,
                    db=db,
                ):
                    pass

                # Check if system prompt included the memory
                # We need to find the call to astream that had the system_prompt
                astream_calls = mock_prompt.astream.call_args_list
                chat_call = None
                for call in astream_calls:
                    args, _ = call
                    if isinstance(args[0], dict) and "system_prompt" in args[0]:
                        chat_call = call
                        break
                
                assert chat_call is not None
                input_data = chat_call[0][0]
                system_prompt = input_data["system_prompt"]

                assert "Luna" in system_prompt
                assert "User Context (Memories)" in system_prompt
