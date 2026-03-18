import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.rag_service import rag_service
from app.services.memory_service import memory_service
from app.services.ai_chat import AIChatService

from langchain_core.messages import AIMessage


@pytest.mark.asyncio
async def test_rag_service_optimize_query():
    # Use a more specific mock that doesn't trigger Pydantic validation errors
    llm = MagicMock()
    llm.ainvoke = AsyncMock(return_value=AIMessage(content="Optimized Query"))
    # Mock the | operator (Runnable binding)
    llm.__or__ = MagicMock(side_effect=lambda other: MagicMock())

    # Actually, the simplest way to test this is to mock the chain itself
    # but since it's local, we'll try to mock the output parser's behavior
    with patch(
        "langchain_core.output_parsers.StrOutputParser.ainvoke", new_callable=AsyncMock
    ) as mock_ainvoke:
        mock_ainvoke.return_value = "Optimized Query"
        result = await rag_service.optimize_query("Original message", [], llm)
        assert result == "Optimized Query"


@pytest.mark.asyncio
async def test_memory_service_get_relevant_memories_none():
    db = MagicMock()
    llm = AsyncMock()

    with patch("app.crud.memory.memory.get_by_user", return_value=[]):
        result = await memory_service.get_relevant_memories("query", 1, db, llm)
        assert result == ""


@pytest.mark.asyncio
async def test_ai_chat_service_delegates_to_memory_service():
    service = AIChatService()
    user_id = 1
    message = "Fact about me"

    with patch.object(service, "get_llm", return_value=AsyncMock()) as mock_get_llm:
        with patch(
            "app.services.memory_service.memory_service.extract_and_save_memories",
            new_callable=AsyncMock,
        ) as mock_extract:
            mock_extract.return_value = ["Fact saved"]

            result = await service.extract_and_save_memories(message, user_id)

            assert result == ["Fact saved"]
            mock_extract.assert_called_once()
            mock_get_llm.assert_called_once()
