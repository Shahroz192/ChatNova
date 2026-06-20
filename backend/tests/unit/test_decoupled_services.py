import pytest
import sqlalchemy as sa
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

    with patch("app.services.ai_chat.llm_service.get_llm", return_value=AsyncMock()) as mock_get_llm:
        with patch(
            "app.services.memory_service.memory_service.extract_and_save_memories",
            new_callable=AsyncMock,
        ) as mock_extract:
            mock_extract.return_value = ["Fact saved"]

            result = await service.extract_and_save_memories(message, user_id)

            assert result == ["Fact saved"]
            mock_extract.assert_called_once()
            mock_get_llm.assert_called_once()


@pytest.mark.asyncio
async def test_rag_service_get_relevant_chunks_falls_back_without_embeddings():
    db = MagicMock()
    session_id = 123
    user_id = 1

    fake_chunk = MagicMock()
    fake_chunk.id = 1
    fake_chunk.document_id = 10
    fake_chunk.document = MagicMock(filename="doc.pdf")
    fake_chunk.content = "Keyword match content"

    query = MagicMock()
    query.join.return_value = query
    query.filter.return_value = query
    query.limit.return_value = query
    query.all.return_value = [fake_chunk]
    db.query.return_value = query

    document_chunk_mock = MagicMock()
    document_chunk_mock.content = MagicMock()
    document_chunk_mock.content.ilike = MagicMock(return_value=MagicMock())
    document_chunk_mock.embedding = MagicMock()
    document_chunk_mock.embedding.cosine_distance = MagicMock()
    document_chunk_mock.created_at = MagicMock()

    class FakeEmbeddingService:
        def __init__(self, user_id: int, db):
            self.user_id = user_id
            self.db = db

        async def embed_query(self, query: str):
            raise ValueError("Google API key not found for embeddings.")

    with patch("app.models.document.has_vector", True):
        with patch(
            "app.services.rag_service.sa.or_", side_effect=lambda *args: sa.text("1=1")
        ):
            with (
                patch("app.services.rag_service.DocumentChunk", document_chunk_mock),
                patch("app.services.rag_service.SessionDocument", MagicMock()),
                patch(
                    "app.services.rag_service.rerank_service.rerank",
                    side_effect=lambda q, c, top_n: c[:top_n],
                ),
            ):
                with patch(
                    "app.services.embedding_service.EmbeddingService",
                    FakeEmbeddingService,
                ):
                    result = await rag_service.get_relevant_chunks(
                        "find this", session_id, user_id, db, limit=5
                    )

    assert "DOCUMENT CONTEXT (RAG)" in result["text"]
    assert "doc.pdf" in result["text"]
    assert result["sources"] == [{"id": 1, "filename": "doc.pdf"}]
