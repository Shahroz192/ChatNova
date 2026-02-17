import logging
from typing import List, Any
from flashrank import Ranker, RerankRequest

class RerankService:
    def __init__(self, model_name: str = "ms-marco-MiniLM-L-12-v2"):
        """
        Initialize the RerankService with a FlashRank model.
        
        Args:
            model_name: The name of the FlashRank model to use.
        """
        try:
            self.ranker = Ranker(model_name=model_name, cache_dir="/tmp/flashrank_cache")
            logging.info(f"✅ RerankService initialized with model: {model_name}")
        except Exception as e:
            logging.error(f"❌ Failed to initialize RerankService: {e}")
            self.ranker = None

    def rerank(self, query: str, chunks: List[Any], top_n: int = 5) -> List[Any]:
        """
        Rerank a list of document chunks based on a query.
        
        Args:
            query: The user query.
            chunks: A list of DocumentChunk objects.
            top_n: The number of top chunks to return.
            
        Returns:
            A list of reranked DocumentChunk objects.
        """
        if not self.ranker or not chunks:
            return chunks[:top_n]

        try:
            # Prepare data for FlashRank
            passages = []
            for i, chunk in enumerate(chunks):
                passages.append({
                    "id": i,
                    "text": chunk.content,
                    "meta": {"chunk_id": chunk.id}
                })

            rerank_request = RerankRequest(query=query, passages=passages)
            results = self.ranker.rerank(rerank_request)

            # Map results back to original chunk objects
            reranked_chunks = []
            for result in results[:top_n]:
                original_idx = result["id"]
                reranked_chunks.append(chunks[original_idx])

            logging.info(f"✅ Reranked {len(chunks)} candidates down to {len(reranked_chunks)}")
            return reranked_chunks
        except Exception as e:
            logging.error(f"❌ Error during reranking: {e}")
            return chunks[:top_n]

rerank_service = RerankService()
