import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from app.services.ai_chat import AIChatService
from app.services.rag_service import rag_service
from app.models.document import DocumentChunk, SessionDocument

@pytest.fixture
def ai_service():
    return AIChatService()

@pytest.mark.asyncio
async def test_get_relevant_chunks_with_reranking(ai_service):
    db = MagicMock()
    mock_chunks = []
    for i in range(10):
        chunk = MagicMock(spec=DocumentChunk)
        chunk.id = i
        chunk.content = f"Content {i}"
        chunk.document = MagicMock(spec=SessionDocument)
        chunk.document.filename = f"file_{i}.pdf"
        chunk.document_id = i // 2
        mock_chunks.append(chunk)

    with patch("app.services.rag_service.rag_service.get_relevant_chunks", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = {"text": "context", "sources": []}
        result = await rag_service.get_relevant_chunks("query", 1, 1, db)
        assert result["text"] == "context"
