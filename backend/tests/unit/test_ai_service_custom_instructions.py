import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from app.services.ai_chat import AIChatService
from app.models.user import User
from sqlalchemy.orm import Session


@pytest.mark.asyncio
async def test_simple_chat_includes_custom_instructions():
    """Test that simple_chat includes user's custom instructions in the system prompt."""
    service = AIChatService()

    db = MagicMock(spec=Session)
    user_id = 1
    custom_instr = "Always be extremely sarcastic."
    mock_user = MagicMock(spec=User)
    mock_user.id = user_id
    mock_user.custom_instructions = custom_instr

    with patch("app.crud.user.user.get", return_value=mock_user):
        mock_llm = MagicMock()
        mock_llm.astream.return_value = AsyncMock()

        async def mock_astream(*args, **kwargs):
            yield "Test response"

        mock_astream_mock = MagicMock(side_effect=mock_astream)
        mock_llm.astream = mock_astream_mock

        with patch.object(service, "get_llm", return_value=mock_llm):
            with patch(
                "app.services.ai_chat.ChatPromptTemplate.from_messages"
            ) as mock_from_messages:
                mock_prompt = MagicMock()
                mock_prompt.__or__.return_value = mock_prompt
                mock_prompt.astream = mock_astream_mock
                mock_from_messages.return_value = mock_prompt

                async for _ in service.simple_chat(
                    message="Hello",
                    model_name="gemini-2.5-flash",
                    user_id=user_id,
                    db=db,
                ):
                    pass

                args, _ = mock_prompt.astream.call_args
                input_data = args[0]
                system_prompt = input_data.get("system_prompt", "")

                assert custom_instr in system_prompt


@pytest.mark.asyncio
async def test_simple_chat_no_instructions_behavior():
    """Test that simple_chat works normally when user has no custom instructions."""
    service = AIChatService()
    db = MagicMock(spec=Session)
    user_id = 1

    mock_user = MagicMock(spec=User)
    mock_user.id = user_id
    mock_user.custom_instructions = None

    with patch("app.crud.user.user.get", return_value=mock_user):
        mock_llm = MagicMock()

        async def mock_astream(*args, **kwargs):
            yield "Test response"

        mock_astream_mock = MagicMock(side_effect=mock_astream)
        mock_llm.astream = mock_astream_mock

        with patch.object(service, "get_llm", return_value=mock_llm):
            with patch(
                "app.services.ai_chat.ChatPromptTemplate.from_messages"
            ) as mock_from_messages:
                mock_prompt = MagicMock()
                mock_prompt.__or__.return_value = mock_prompt
                mock_prompt.astream = mock_astream_mock
                mock_from_messages.return_value = mock_prompt

                async for _ in service.simple_chat(
                    message="Hello",
                    model_name="gemini-2.5-flash",
                    user_id=user_id,
                    db=db,
                ):
                    pass

                args, _ = mock_prompt.astream.call_args
                input_data = args[0]
                system_msg = input_data.get("system_prompt", "")

                assert "Custom Instructions" not in system_msg
