import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from app.services.ai_chat import AIChatService
from app.models.document import DocumentChunk, SessionDocument

@pytest.fixture
def ai_service():
    return AIChatService()

@pytest.mark.asyncio
async def test_get_relevant_chunks_with_reranking(ai_service):
    # Setup
    db = MagicMock()
    llm = MagicMock() # Use MagicMock for the model
    
    # Mock database queries
    mock_chunks = []
    for i in range(10):
        chunk = MagicMock(spec=DocumentChunk)
        chunk.id = i
        chunk.content = f"Content for chunk {i}"
        chunk.document = MagicMock(spec=SessionDocument)
        chunk.document.filename = f"file_{i}.pdf"
        chunk.document_id = i // 2
        mock_chunks.append(chunk)
    
    # Mock vector search results
    query_mock = db.query.return_value.join.return_value.filter.return_value.order_by.return_value.limit.return_value
    query_mock.all.return_value = mock_chunks[:8]
    
    # Mock internal methods and services
    with patch.object(ai_service, "_optimize_rag_query", new_callable=AsyncMock) as mock_optimize:
        mock_optimize.return_value = "optimized query"
        with patch("app.services.ai_chat.rerank_service") as mock_rerank_service:
            mock_rerank_service.rerank.side_effect = lambda q, c, top_n: c[:top_n]
            
            # Execute
            result = await ai_service.get_relevant_chunks(
                query="test query",
                session_id=1,
                user_id=1,
                db=db,
                limit=3,
                llm=llm
            )
            
            # Verify
            assert "text" in result
            assert "sources" in result
            assert len(result["sources"]) <= 3
            
            # Check if optimize was called
            assert mock_optimize.called
            
            # Check if rerank was called
            assert mock_rerank_service.rerank.called
            args, kwargs = mock_rerank_service.rerank.call_args
            assert args[0] == "optimized query"

@pytest.mark.asyncio
async def test_optimize_rag_query(ai_service):
    # Setup
    llm = MagicMock()
    
    # Mock the chain execution
    # AIChatService._optimize_rag_query creates a chain and calls ainvoke
    # We can patch the chain's ainvoke or just mock the whole method if we want to test its call, 
    # but here we want to test the logic.
    
    with patch("langchain_core.prompts.ChatPromptTemplate.from_messages") as mock_prompt:
        mock_chain = MagicMock()
        mock_chain.ainvoke = AsyncMock(return_value="Refined Query")
        mock_prompt.return_value.__or__.return_value.__or__.return_value = mock_chain
        
        # Execute
        result = await ai_service._optimize_rag_query("Original Query", [], llm)
        
        # Verify
        assert result == "Refined Query"
        assert mock_chain.ainvoke.called
