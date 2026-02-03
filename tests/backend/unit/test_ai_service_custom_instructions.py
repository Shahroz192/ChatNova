import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from app.services.ai_chat import AIChatService
from app.models.user import User
from sqlalchemy.orm import Session


@pytest.mark.asyncio
async def test_simple_chat_includes_custom_instructions():
    """Test that simple_chat includes user's custom instructions in the system prompt."""
    service = AIChatService()

    # Mock dependencies
    db = MagicMock(spec=Session)
    user_id = 1
    custom_instr = "Always be extremely sarcastic."
    mock_user = MagicMock(spec=User)
    mock_user.id = user_id
    mock_user.custom_instructions = custom_instr

    # Mock crud.user.get
    with (
        patch("app.crud.user.user.get", return_value=mock_user),
        patch("app.core.cache.cache_manager.get_llm_response", return_value=None),
    ):
        # Mock get_llm to return a mock LLM
        mock_llm = MagicMock()
        mock_llm.astream.return_value = AsyncMock()

        # Create an async iterator for astream
        async def mock_astream(*args, **kwargs):
            yield "Test response"

        # Fix: Use MagicMock with side_effect to track calls to the async generator
        mock_astream_mock = MagicMock(side_effect=mock_astream)
        mock_llm.astream = mock_astream_mock

        with patch.object(service, "get_llm", return_value=mock_llm):
            # We want to capture the prompt sent to the LLM.
            # Since simple_chat creates a chain: prompt | llm | parser
            # and calls chain.astream, we can intercept the call to prompt.

            with patch(
                "app.services.ai_chat.ChatPromptTemplate.from_messages"
            ) as mock_from_messages:
                mock_prompt = MagicMock()
                mock_prompt.__or__.return_value = mock_prompt  # Mock the pipe operator
                mock_prompt.astream = mock_astream_mock
                mock_from_messages.return_value = mock_prompt

                # Execute simple_chat
                async for _ in service.simple_chat(
                    message="Hello",
                    model_name="gemini-2.5-flash",
                    user_id=user_id,
                    db=db,
                ):
                    pass

                # Check if system prompt included custom instructions
                # The prompt template is rendered with variables passed to astream
                # So we inspect the call to astream
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

    with (
        patch("app.crud.user.user.get", return_value=mock_user),
        patch("app.core.cache.cache_manager.get_llm_response", return_value=None),
    ):
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

                # Check arguments passed to astream
                args, _ = mock_prompt.astream.call_args
                input_data = args[0]
                system_msg = input_data.get("system_prompt", "")

                # Should NOT contain a specific "Custom Instructions" section if empty
                assert "Custom Instructions" not in system_msg
