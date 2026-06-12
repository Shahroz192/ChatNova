import logging
import re
import sqlalchemy as sa
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser

from app.models.document import SessionDocument, DocumentChunk
from app.services.rerank_service import rerank_service


class RAGService:
    async def optimize_query(
        self, message: str, chat_history: List[Any], llm: Any
    ) -> str:
        """Optimize the user's message into a better query for document retrieval."""
        opt_prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "You are a retrieval expert. Convert the user's request into a query that is optimized for finding relevant information in technical or informative documents. "
                    "Focus on the core keywords and entities. If there is relevant conversation history, use it to disambiguate the query. "
                    "Output ONLY the optimized query string, no quotes or explanation.",
                ),
                MessagesPlaceholder(variable_name="chat_history"),
                ("human", "{input}"),
            ]
        )
        chain = opt_prompt | llm | StrOutputParser()
        try:
            optimized_query = await chain.ainvoke(
                {"input": message, "chat_history": chat_history}
            )
            return optimized_query.strip().strip('"')
        except Exception as e:
            logging.error(f"Error optimizing RAG query: {e}")
            return message

    async def get_relevant_chunks(
        self,
        query: str,
        session_id: int,
        user_id: int,
        db: Session,
        limit: int = 5,
        llm: Optional[Any] = None,
        chat_history: Optional[List[Any]] = None,
        document_ids: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """Retrieve and rerank relevant document chunks for the current query and session."""
        try:
            from app.models.document import has_vector

            # 1. Optimize Query for RAG
            optimized_query = query
            if llm:
                optimized_query = await self.optimize_query(
                    query, chat_history or [], llm
                )
                logging.info(f"🔍 Optimized RAG Query: {optimized_query}")

            # 2. Fetch Candidates (fetch more than the final limit for reranking)
            candidate_limit = limit * 3

            # Extract key terms for keyword matching
            search_terms = [
                t for t in re.findall(r"\w+", optimized_query) if len(t) > 3
            ]
            if not search_terms:
                search_terms = [optimized_query[:50]]
            query_filter = sa.or_(
                *[DocumentChunk.content.ilike(f"%{term}%") for term in search_terms]
            )
            document_filter = []
            if document_ids:
                document_filter.append(SessionDocument.id.in_(document_ids))

            if has_vector:
                from app.services.embedding_service import EmbeddingService

                try:
                    embedding_service = EmbeddingService(user_id, db)
                    query_embedding = await embedding_service.embed_query(
                        optimized_query
                    )

                    # Vector search
                    vector_chunks = (
                        db.query(DocumentChunk)
                        .join(SessionDocument)
                        .filter(
                            SessionDocument.session_id == session_id,
                            SessionDocument.user_id == user_id,
                            *document_filter,
                        )
                        .order_by(
                            DocumentChunk.embedding.cosine_distance(query_embedding)
                        )
                        .limit(candidate_limit)
                        .all()
                    )

                    # Keyword search
                    keyword_chunks = (
                        db.query(DocumentChunk)
                        .join(SessionDocument)
                        .filter(
                            SessionDocument.session_id == session_id,
                            SessionDocument.user_id == user_id,
                            *document_filter,
                        )
                        .filter(query_filter)
                        .limit(candidate_limit // 2)
                        .all()
                    )

                    # Merge and deduplicate
                    seen_ids = set()
                    candidates = []
                    for c in vector_chunks + keyword_chunks:
                        if c.id not in seen_ids:
                            candidates.append(c)
                            seen_ids.add(c.id)
                except ValueError as e:
                    logging.warning(f"Embeddings unavailable for user {user_id}: {e}")
                    candidates = (
                        db.query(DocumentChunk)
                        .join(SessionDocument)
                        .filter(
                            SessionDocument.session_id == session_id,
                            SessionDocument.user_id == user_id,
                            *document_filter,
                        )
                        .filter(query_filter)
                        .limit(candidate_limit)
                        .all()
                    )
            else:
                candidates = (
                    db.query(DocumentChunk)
                    .join(SessionDocument)
                    .filter(
                        SessionDocument.session_id == session_id,
                        SessionDocument.user_id == user_id,
                        *document_filter,
                    )
                    .filter(query_filter)
                    .limit(candidate_limit)
                    .all()
                )

            if not candidates:
                # Greedy Fallback
                candidates = (
                    db.query(DocumentChunk)
                    .join(SessionDocument)
                    .filter(
                        SessionDocument.session_id == session_id,
                        SessionDocument.user_id == user_id,
                        *document_filter,
                    )
                    .order_by(DocumentChunk.created_at.desc())
                    .limit(limit)
                    .all()
                )

            if not candidates:
                return {"text": "", "sources": []}

            # 3. Rerank Candidates. Pull a wider set, then keep coverage across files
            reranked_candidates = rerank_service.rerank(
                optimized_query, candidates, top_n=max(limit * 2, len(document_ids or []))
            )

            chunks = []
            covered_docs = set()

            # First pass: prefer at least one chunk from each document when possible.
            for chunk in reranked_candidates:
                if chunk.document_id in covered_docs:
                    continue
                chunks.append(chunk)
                covered_docs.add(chunk.document_id)
                if len(chunks) >= limit:
                    break

            # Second pass: fill any remaining slots by relevance.
            if len(chunks) < limit:
                selected_chunk_ids = {chunk.id for chunk in chunks}
                for chunk in reranked_candidates:
                    if chunk.id in selected_chunk_ids:
                        continue
                    chunks.append(chunk)
                    selected_chunk_ids.add(chunk.id)
                    if len(chunks) >= limit:
                        break

            context_parts = []
            sources = []
            seen_docs = set()

            for i, chunk in enumerate(chunks, 1):
                filename = chunk.document.filename
                context_parts.append(
                    f"[{i}] Source File: {filename}\nContent: {chunk.content}"
                )
                if chunk.document_id not in seen_docs:
                    sources.append({"id": i, "filename": filename})
                    seen_docs.add(chunk.document_id)

            return {
                "text": "\n\n### DOCUMENT CONTEXT (RAG)\n"
                "Use the following information from the user's uploaded files to answer their question. "
                "If the answer is found here, prioritize it. "
                f"Attached files for this turn: {', '.join(sorted({chunk.document.filename for chunk in chunks}))}.\n\n"
                + "\n---\n".join(context_parts),
                "sources": sources,
            }
        except Exception as e:
            logging.error(f"Error retrieving relevant chunks: {e}")
            return {"text": "", "sources": []}


rag_service = RAGService()
