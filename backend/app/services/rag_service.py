import logging
import re
import sqlalchemy as sa
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.models.document import SessionDocument, DocumentChunk
from app.services.rerank_service import rerank_service


class RAGService:
    async def get_relevant_chunks(
        self,
        query: str,
        session_id: int,
        user_id: int,
        db: Session,
        limit: int = 5,
        document_ids: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        """Retrieve and rerank relevant document chunks using the raw query."""
        try:
            from app.models.document import has_vector

            candidate_limit = limit * 3

            # Extract key terms for keyword matching
            search_terms = [
                t for t in re.findall(r"\w+", query) if len(t) > 3
            ]
            if not search_terms:
                search_terms = [query[:50]]
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
                    query_embedding = await embedding_service.embed_query(query)

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

            # Rerank candidates
            reranked_candidates = rerank_service.rerank(
                query, candidates, top_n=max(limit * 2, len(document_ids or []))
            )

            chunks = []
            covered_docs = set()

            # First pass: prefer at least one chunk from each document
            for chunk in reranked_candidates:
                if chunk.document_id in covered_docs:
                    continue
                chunks.append(chunk)
                covered_docs.add(chunk.document_id)
                if len(chunks) >= limit:
                    break

            # Second pass: fill remaining slots by relevance
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
