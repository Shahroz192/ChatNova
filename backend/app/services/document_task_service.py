"""Background document processing service.

Extracted from the API router (chat.py) to maintain clean architectural
boundaries between transport and business logic.
"""

import logging
from typing import Any, Optional

from app.crud.document import chunk as chunk_crud
from app.crud.document import document as document_crud
from app.services.document_processor import DocumentProcessor
from app.services.embedding_service import EmbeddingService
from app.models.document import has_vector

logger = logging.getLogger(__name__)


async def process_document_task(
    file_path: str,
    document_id: int,
    user_id: int,
    db_session_factory: Any,
    api_key: Optional[str] = None,
) -> None:
    """Background task to process, chunk, and index a document.

    Args:
        file_path: Path to the uploaded file on disk.
        document_id: Database ID of the ``SessionDocument`` record.
        user_id: ID of the owning user.
        db_session_factory: A callable that returns a new ``Session``
            (e.g. ``SessionLocal``).
        api_key: Optional API key for the embedding provider. If ``None``
            the ``EmbeddingService`` will resolve it internally (legacy path).
    """
    db = db_session_factory()
    try:
        doc_record = document_crud.get(db, id=document_id)
        if not doc_record:
            return

        # Update status to processing
        doc_record.processing_status = "processing"
        db.add(doc_record)
        db.commit()

        text = DocumentProcessor.extract_text(file_path, doc_record.file_type)
        if not text:
            logger.warning("No text extracted from %s", file_path)
            doc_record.processing_status = "failed"
            db.add(doc_record)
            db.commit()
            return

        chunks = DocumentProcessor.chunk_text(text)

        embeddings = None
        if has_vector:
            embedding_service = EmbeddingService(user_id, db, api_key=api_key)
            embeddings = await embedding_service.embed_chunks(chunks)

        for i, content in enumerate(chunks):
            chunk_data: dict[str, Any] = {
                "document_id": document_id,
                "content": content,
            }
            if embeddings and i < len(embeddings):
                chunk_data["embedding"] = embeddings[i]

            chunk_crud.create(db, obj_in=chunk_data)

        doc_record.processing_status = "completed"
        db.add(doc_record)
        db.commit()
        logger.info(
            "Processed document %d: %d chunks indexed.",
            document_id,
            len(chunks),
        )
    except Exception as e:
        logger.error("Error processing document %d: %s", document_id, e)
        _safe_mark_failed(document_crud, db, document_id)
    finally:
        db.close()


def _safe_mark_failed(
    document_crud: Any,
    db: Any,
    document_id: int,
) -> None:
    """Best-effort status update to ``failed`` when processing errors out."""
    try:
        doc_record = document_crud.get(db, id=document_id)
        if doc_record:
            doc_record.processing_status = "failed"
            db.add(doc_record)
            db.commit()
    except Exception as inner_e:
        logger.error(
            "Failed to update error status for document %d: %s",
            document_id,
            inner_e,
        )
