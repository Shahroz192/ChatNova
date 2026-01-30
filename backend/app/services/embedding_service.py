from typing import List
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from sqlalchemy.orm import Session


class EmbeddingService:
    def __init__(self, user_id: int, db: Session):
        self.user_id = user_id
        self.db = db
        from app.services.ai_chat import ai_service

        self.api_key = ai_service.get_provider_key("Google", user_id, db)

    def get_embeddings(self) -> GoogleGenerativeAIEmbeddings:
        if not self.api_key:
            raise ValueError("Google API key not found for embeddings.")

        return GoogleGenerativeAIEmbeddings(
            model="models/text-embedding-004", google_api_key=self.api_key
        )

    async def embed_chunks(self, chunks: List[str]) -> List[List[float]]:
        """Embed a list of text chunks."""
        embeddings_model = self.get_embeddings()
        return await embeddings_model.aembed_documents(chunks)

    async def embed_query(self, query: str) -> List[float]:
        """Embed a single query string."""
        embeddings_model = self.get_embeddings()
        return await embeddings_model.aembed_query(query)
