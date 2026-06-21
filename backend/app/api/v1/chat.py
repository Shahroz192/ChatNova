import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, Optional

from app import crud
from app.api.deps import get_current_active_user, get_db
from app.core.input_validation import InputSanitizer
from app.crud.document import document as document_crud
from app.models.user import User
from app.schemas.document import Document as DocumentSchema
from app.schemas.message import Message, MessageCreate, MessagePagination
from app.schemas.session import (
    ChatSession,
    ChatSessionCreate,
    ChatSessionPagination,
    ChatSessionUpdate,
)
from app.services.ai_chat import ai_service
from app.services.llm_service import llm_service
from app.services.document_task_service import process_document_task
from app.services.session_service import session_service
from app.utils.pagination import compute_pagination_meta
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
)
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from starlette.responses import FileResponse

logger = logging.getLogger(__name__)

router = APIRouter()


def _validate_session_ownership(db: Session, session_id: int, user_id: int) -> None:
    session_obj = crud.session.get(db, id=session_id)
    if not session_obj or session_obj.user_id != user_id:
        raise HTTPException(status_code=404, detail="Session not found")


# ---------------------------------------------------------------------------
# Shared SSE helpers
# ---------------------------------------------------------------------------
def _format_sse_data(chunk: str) -> str:
    """Format data as a Server-Sent Event line."""
    lines = chunk.split("\n")
    return "".join(f"data: {line}\n" for line in lines) + "\n"


def _extract_ui_marker(chunk: str) -> Optional[Dict[str, Any]]:
    """Extract generated UI payload from the internal stream marker."""
    marker_start = "__GEN_UI__"
    marker_end = "__END_UI__"
    if not chunk.startswith(marker_start):
        return None

    end_idx = chunk.find(marker_end)
    if end_idx == -1:
        return None

    ui_json_str = chunk[len(marker_start) : end_idx]
    try:
        ui_data = json.loads(ui_json_str)
    except json.JSONDecodeError:
        logger.warning("Generated UI marker contained invalid JSON")
        return None

    if not isinstance(ui_data, dict):
        logger.warning("Generated UI marker payload was not an object")
        return None

    return ui_data


def _update_session_title_if_needed(
    db: Session,
    session_id: int,
    user_message: str,
    max_title_len: int = 60,
) -> None:
    """Update a 'New Chat' session title to the first user message."""
    if not session_id:
        return
    session_obj = crud.session.get(db, id=session_id)
    if session_obj and (
        session_obj.title == "New Chat"
        or not session_obj.title
        or session_obj.title.strip() == ""
    ):
        new_title = user_message[:max_title_len]
        if len(user_message) > max_title_len:
            new_title += "..."
        crud.session.update(
            db, db_obj=session_obj, obj_in=ChatSessionUpdate(title=new_title)
        )


async def _extract_memories_events(
    message: str,
    user_id: int,
    model: str,
    db: Optional[Session] = None,
) -> AsyncGenerator[str, None]:
    """Extract memories and yield SSE-formatted events."""
    try:
        logger.info(f"[MEMORY] Starting memory extraction for user {user_id}...")
        saved_facts = await ai_service.extract_and_save_memories(
            message, user_id, model, db=db
        )
        logger.info(f"[MEMORY] Extraction complete: {len(saved_facts)} facts saved")
        for fact in saved_facts:
            event = json.dumps({"type": "memory_saved", "content": fact})
            yield _format_sse_data(event)
    except Exception as e:
        logger.error(f"[MEMORY] Failed to process memories: {e}")
        import traceback
        logger.error(f"[MEMORY] Traceback:\n{traceback.format_exc()}")


# Session Management Endpoints
@router.post("/sessions", response_model=ChatSession)
def create_session(
    session_in: ChatSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Create a new chat session.
    """
    session_data = session_service.create_session(
        db, current_user, session_in.title, session_in.description
    )
    return ChatSession(**session_data)


@router.get("/sessions", response_model=ChatSessionPagination)
def get_user_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Number of records to return"),
    newest_first: bool = Query(
        True, description="Order by newest first (true) or oldest first (false)"
    ),
    search: str = Query(
        None, description="Search term to filter sessions by title or description"
    ),
):
    """
    Get all chat sessions for the current user with message counts.
    """
    sessions = session_service.get_user_sessions(
        db,
        current_user,
        skip=skip,
        limit=limit,
        newest_first=newest_first,
        search=search,
    )

    total_count = crud.session.count_by_user(
        db, user_id=current_user.id, search=search
    )

    return ChatSessionPagination(
        data=sessions,
        meta=compute_pagination_meta(skip, limit, total_count),
    )


@router.get("/sessions/{session_id}", response_model=ChatSession)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get a specific chat session by ID.
    """
    session_data = session_service.get_session_by_id(db, session_id, current_user)
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")
    return ChatSession(**session_data)


@router.put("/sessions/{session_id}", response_model=ChatSession)
def update_session(
    session_id: int,
    session_update: ChatSessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Update a chat session.
    """
    session_data = session_service.update_session(
        db, session_id, current_user, session_update
    )
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")
    return ChatSession(**session_data)


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Delete a chat session.
    """
    success = session_service.delete_session(db, session_id, current_user)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"message": "Session deleted successfully"}


@router.get("/sessions/{session_id}/messages", response_model=MessagePagination)
def get_session_messages(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Number of records to return"),
    newest_first: bool = Query(
        True, description="Order by newest first (true) or oldest first (false)"
    ),
):
    """
    Get messages for a specific session.
    """
    # Check if session exists and belongs to user
    session_data = session_service.get_session_by_id(db, session_id, current_user)
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = session_service.get_session_messages(
        db, session_id, current_user, skip=skip, limit=limit, newest_first=newest_first
    )

    total_count = crud.message.count_by_user(
        db, user_id=current_user.id, session_id=session_id
    )

    return MessagePagination(
        data=messages,
        meta=compute_pagination_meta(skip, limit, total_count),
    )


@router.delete("/sessions/{session_id}/messages")
def delete_session_messages(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    before_date: Optional[str] = Query(
        None, description="Delete messages before this date (ISO format)"
    ),
):
    """
    Delete messages in a specific session.
    """
    # Check if session exists and belongs to user
    session_data = session_service.get_session_by_id(db, session_id, current_user)
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")

    deleted_count = session_service.delete_session_messages(
        db, session_id, current_user, before_date=before_date
    )
    return {
        "message": f"Deleted {deleted_count} messages from session",
        "deleted_count": deleted_count,
    }


@router.post("/chat", response_model=Message)
async def chat(
    message_in: MessageCreate,
    background_tasks: BackgroundTasks,
    session_id: Optional[int] = Query(
        None, description="Session ID for conversation context"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Create a new chat message and get AI response.
    Supports response compression for large outputs.
    Optionally associate with a session for conversation context.
    """
    if session_id is not None:
        _validate_session_ownership(db, session_id, current_user.id)

    response = ""
    ui_data = None
    async for chunk in ai_service.simple_chat(
        message_in.content,
        message_in.model,
        current_user.id,
        db,
        session_id,
        message_in.search_web,
        images=message_in.images,
        document_ids=message_in.document_ids,
    ):
        extracted_ui = _extract_ui_marker(chunk)
        if extracted_ui is not None:
            ui_data = extracted_ui
            continue
        response += chunk
    msg = crud.message.create(
        db,
        obj_in=message_in,
        response=response,
        user_id=current_user.id,
        session_id=session_id,
    )
    if ui_data is not None:
        msg = crud.message.update(db, db_obj=msg, obj_in={"ui_data": ui_data})

    # Update session title from 'New Chat' to the first message if needed
    _update_session_title_if_needed(db, session_id, message_in.content)

    # Extract memories from the user message
    saved_memories = []
    try:
        saved_memories = await ai_service.extract_and_save_memories(
            message_in.content,
            current_user.id,
            message_in.model,
        )
    except Exception as e:
        logger.error(f"Failed to extract memories in chat: {e}")

    msg.saved_memories = saved_memories
    return msg


@router.post("/chat-with-tools", response_model=Message)
async def chat_with_tools(
    message_in: MessageCreate,
    background_tasks: BackgroundTasks,
    session_id: Optional[int] = Query(
        None, description="Session ID for conversation context"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Create a chat message with tools/agents enabled.
    Optionally associate with a session for conversation context.
    """
    if session_id is not None:
        _validate_session_ownership(db, session_id, current_user.id)

    response = await ai_service.agent_chat(
        message_in.content, message_in.model, current_user.id, db, session_id
    )
    msg = crud.message.create(
        db,
        obj_in=message_in,
        response=response,
        user_id=current_user.id,
        session_id=session_id,
    )

    # Update session title from 'New Chat' to the first message if needed
    _update_session_title_if_needed(db, session_id, message_in.content)

    # Extract memories from the user message
    saved_memories = []
    try:
        saved_memories = await ai_service.extract_and_save_memories(
            message_in.content,
            current_user.id,
            message_in.model,
        )
    except Exception as e:
        logger.error(f"Failed to extract memories in chat-with-tools: {e}")

    msg.saved_memories = saved_memories
    return msg


@router.post("/chat/stream")
async def chat_stream(
    message_in: MessageCreate,
    session_id: Optional[int] = Query(
        None, description="Session ID for conversation context"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Stream AI response in real-time using Server-Sent Events.
    All content chunks are wrapped in JSON for clean multiline handling.
    """
    if session_id is not None:
        _validate_session_ownership(db, session_id, current_user.id)

    async def stream_response():
        from app.database import SessionLocal

        stream_db = SessionLocal()
        msg = None
        full_response = ""
        try:
            msg = crud.message.create(
                stream_db,
                obj_in=message_in,
                response="",
                user_id=current_user.id,
                session_id=session_id,
            )
            yield _format_sse_data(
                json.dumps({"type": "metadata", "message_id": msg.id})
            )
            logger.info(f"[STREAM] Created message {msg.id}, starting simple_chat (search_web={message_in.search_web}, model={message_in.model})")

            _update_session_title_if_needed(stream_db, session_id, message_in.content)

            ui_data = None
            content_chunks = 0
            _t_stream_start = asyncio.get_running_loop().time()
            async for chunk in ai_service.simple_chat(
                message_in.content,
                message_in.model,
                current_user.id,
                stream_db,
                session_id,
                message_in.search_web,
                images=message_in.images,
                document_ids=message_in.document_ids,
            ):
                ui_data_from_marker = _extract_ui_marker(chunk)
                if ui_data_from_marker is not None:
                    ui_data = ui_data_from_marker
                    yield _format_sse_data(
                        json.dumps({"type": "ui", "data": ui_data})
                    )
                    logger.info(f"[STREAM] UI data yielded for message {msg.id}")
                    continue
                full_response += chunk
                content_chunks += 1
                # Wrap in JSON so multiline content doesn't break SSE boundaries
                yield _format_sse_data(
                    json.dumps({"type": "content", "content": chunk})
                )

            _t_stream_end = asyncio.get_running_loop().time()
            logger.info(f"[STREAM] simple_chat completed: total_chunks={content_chunks}, response_len={len(full_response)}, stream_duration={_t_stream_end-_t_stream_start:.3f}s for message {msg.id}")

            if msg:
                update_data: Dict[str, Any] = {"response": full_response}
                if ui_data is not None:
                    update_data["ui_data"] = ui_data
                crud.message.update(stream_db, db_obj=msg, obj_in=update_data)
                logger.info(f"[STREAM] Message {msg.id} updated in DB")

            # Yield memory events
            _t_mem_start = asyncio.get_running_loop().time()
            logger.info(f"[STREAM] Extracting memories for message {msg.id}...")
            async for mem_event in _extract_memories_events(
                message_in.content, current_user.id, message_in.model, stream_db
            ):
                yield mem_event
            _t_mem_end = asyncio.get_running_loop().time()
            logger.info(f"[STREAM] Memories done ({_t_mem_end-_t_mem_start:.3f}s), yielding [DONE] for message {msg.id}")

            yield "data: [DONE]\n\n"
            logger.info(f"[STREAM] [DONE] yielded for message {msg.id}")

        except Exception as e:
            logger.error(f"[STREAM] Streaming error: {e}")
            import traceback
            logger.error(f"[STREAM] Traceback:\n{traceback.format_exc()}")
            yield f"data: ERROR: {str(e)}\n\n"
        finally:
            try:
                if msg and not full_response.strip():
                    crud.message.remove(stream_db, id=msg.id)
                    logger.info(f"[STREAM] Cleaned up empty/failed message record {msg.id}")
            except Exception as cleanup_err:
                logger.error(f"[STREAM] Failed to cleanup message {msg.id}: {cleanup_err}")
            finally:
                stream_db.close()

    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Headers": "Cache-Control",
        },
    )


@router.post("/chat/agent-stream")
async def chat_agent_stream(
    message_in: MessageCreate,
    session_id: Optional[int] = Query(
        None, description="Session ID for conversation context"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Stream Agent response with tool execution details using Server-Sent Events.
    Events are JSON objects with types: 'tool_start', 'tool_end', 'content'.
    """
    if session_id is not None:
        _validate_session_ownership(db, session_id, current_user.id)

    async def stream_response():
        from app.database import SessionLocal

        stream_db = SessionLocal()
        msg = None
        full_response = ""
        try:
            msg = crud.message.create(
                stream_db,
                obj_in=message_in,
                response="",
                user_id=current_user.id,
                session_id=session_id,
            )
            yield _format_sse_data(
                json.dumps({"type": "metadata", "message_id": msg.id})
            )

            _update_session_title_if_needed(stream_db, session_id, message_in.content)

            async for chunk in ai_service.agent_chat_stream(
                message_in.content,
                message_in.model,
                current_user.id,
                stream_db,
                session_id,
            ):
                yield _format_sse_data(chunk)

                try:
                    data = json.loads(chunk)
                    if data.get("type") == "content":
                        full_response += data.get("content", "")
                except (json.JSONDecodeError, Exception):
                    pass

            if msg:
                crud.message.update(stream_db, db_obj=msg, obj_in={"response": full_response})

            async for mem_event in _extract_memories_events(
                message_in.content, current_user.id, message_in.model, stream_db
            ):
                yield mem_event

            yield "data: [DONE]\n\n"

        except Exception as e:
            logging.error(f"Agent streaming error: {e}")
            error_event = json.dumps({"type": "error", "content": str(e)})
            yield f"data: {error_event}\n\n"
        finally:
            try:
                if msg and not full_response.strip():
                    crud.message.remove(stream_db, id=msg.id)
                    logging.info(
                        f"Cleaned up empty/failed agent message record {msg.id}"
                    )
            except Exception as cleanup_err:
                logging.error(
                    f"Failed to cleanup agent message {msg.id}: {cleanup_err}"
                )
            finally:
                stream_db.close()

    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Headers": "Cache-Control",
        },
    )


@router.get("/chat/history", response_model=MessagePagination)
def get_chat_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Number of records to return"),
    newest_first: bool = Query(
        True, description="Order by newest first (true) or oldest first (false)"
    ),
    fields: str = Query(
        None,
        description="Comma-separated list of fields to include (e.g., 'id,content,created_at')",
    ),
    search: str = Query(None, description="Search term to filter messages by content"),
    session_id: Optional[int] = Query(
        None, description="Filter messages by session ID"
    ),
):
    """
    Get paginated chat history for the current user with metadata.
    Includes field filtering, search capabilities, and optional session filtering.
    """
    # Get messages with specified parameters
    messages = crud.message.get_by_user(
        db,
        user_id=current_user.id,
        skip=skip,
        limit=limit,
        newest_first=newest_first,
        search=search,
        session_id=session_id,
    )

    # Get total count for pagination metadata
    total_count = crud.message.count_by_user(
        db, user_id=current_user.id, search=search, session_id=session_id
    )

    # Apply field filtering if specified
    if fields:
        selected_fields = [f.strip() for f in fields.split(",")]
        # Ensure mandatory fields for Message schema are always included
        # to avoid validation errors, unless we switch to a different schema.
        mandatory_fields = [
            "id",
            "content",
            "response",
            "model",
            "user_id",
            "created_at",
        ]
        for field in mandatory_fields:
            if field not in selected_fields:
                selected_fields.append(field)

        filtered_messages = []
        for msg in messages:
            filtered_msg = {
                field: getattr(msg, field)
                for field in selected_fields
                if hasattr(msg, field)
            }
            filtered_messages.append(filtered_msg)
        messages = filtered_messages

    return MessagePagination(
        data=messages,
        meta=compute_pagination_meta(skip, limit, total_count),
    )


@router.delete("/chat/history")
def delete_chat_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    before_date: Optional[str] = Query(
        None, description="Delete messages before this date (ISO format)"
    ),
):
    """
    Delete chat history for the current user.
    Can delete all messages or messages before a specific date.
    """
    deleted_count = crud.message.delete_by_user(
        db, user_id=current_user.id, before_date=before_date
    )
    return {
        "message": f"Deleted {deleted_count} messages",
        "deleted_count": deleted_count,
    }


@router.delete("/chat/history/{message_id}")
def delete_chat_message(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Delete a specific chat message by ID for the current user.
    """
    # Check if the message belongs to the current user
    message = crud.message.get(db, id=message_id)
    if not message:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Message not found")

    if message.user_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to delete this message"
        )

    # Delete the message
    crud.message.remove(db, id=message_id)

    return {
        "message": "Message deleted successfully",
        "deleted_id": message_id,
    }


@router.post("/chat/models/test", response_model=Dict[str, Any])
async def test_ai_models(
    test_input: str = Query(
        "Hello, how are you?", description="Test input for all models"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Test all available AI models with a single input and return their responses.
    Helpful for comparing model outputs and performance.
    """
    available_models = llm_service.get_available_models(current_user.id, db)
    results = {}

    for model in available_models:
        try:
            # Consume the async generator to get the complete response
            response = ""
            async for chunk in ai_service.simple_chat(
                test_input, model, current_user.id, db
            ):
                response += chunk
            results[model] = {"response": response, "status": "success"}
        except Exception as e:
            results[model] = {"response": None, "error": str(e), "status": "error"}

    return {
        "input": test_input,
        "results": results,
        "total_models": len(available_models),
    }


@router.post("/chat/models/test/{provider}")
async def test_provider_key(
    provider: str,
    request: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Test a provider's API key by making a simple validation call.
    """
    api_key = request.get("api_key")
    if not api_key:
        raise HTTPException(status_code=400, detail="API key is required")

    # Get a model for this provider
    provider_models = {
        "Google": "gemini-2.5-flash",
        "Cerebras": "zai-glm-4.7",
        "Groq": "moonshotai/kimi-k2-instruct-0905",
    }

    model_name = provider_models.get(provider)
    if not model_name:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")

    llm = llm_service.get_llm_by_provider(provider, api_key)
    if not llm:
        raise HTTPException(
            status_code=400, detail=f"Failed to initialize {provider} client"
        )

    # Make a simple test call
    from langchain_core.messages import HumanMessage

    try:
        llm.invoke([HumanMessage(content="Hi")])
        return {"status": "success", "message": f"{provider} API key is valid!"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"API call failed: {str(e)}")


@router.get("/chat/models", response_model=Dict[str, Any])
def get_available_models(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_active_user
    ),  # Authentication still required
):
    """
    Get list of available AI models.
    """
    return {
        "models": llm_service.get_available_models(current_user.id, db),
        "total": len(llm_service.get_available_models(current_user.id, db)),
    }


@router.post("/chat/upload", response_model=DocumentSchema)
async def upload_file(
    background_tasks: BackgroundTasks,
    session_id: int = Query(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Upload a document to a chat session.
    Processes the document in the background for RAG.
    """
    _validate_session_ownership(db, session_id, current_user.id)

    file_type = file.filename.split(".")[-1] if "." in file.filename else "txt"
    doc_in = {
        "filename": file.filename,
        "file_type": file_type,
        "session_id": session_id,
        "user_id": current_user.id,
    }
    doc_record = document_crud.create(db, obj_in=doc_in)

    backend_dir = Path(__file__).resolve().parents[3]
    upload_dir = backend_dir / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)

    sanitized_filename = InputSanitizer.sanitize_filename(file.filename)
    stored_path = upload_dir / f"{doc_record.id}_{sanitized_filename}"
    with open(stored_path, "wb") as f:
        f.write(await file.read())

    doc_record.file_path = str(stored_path)
    db.add(doc_record)
    db.commit()
    db.refresh(doc_record)

    from app.database import SessionLocal

    background_tasks.add_task(
        process_document_task,
        str(stored_path),
        doc_record.id,
        current_user.id,
        SessionLocal,
    )

    return doc_record


@router.get("/chat/documents/{document_id}/preview")
def preview_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    doc_record = document_crud.get(db, id=document_id)
    if not doc_record or doc_record.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc_record.file_type.lower() != "pdf":
        raise HTTPException(status_code=400, detail="Preview only supported for PDF")

    if not doc_record.file_path or not os.path.exists(doc_record.file_path):
        raise HTTPException(status_code=404, detail="File not available for preview")

    filename = doc_record.filename or f"document_{doc_record.id}.pdf"
    return FileResponse(
        doc_record.file_path,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/chat/documents/{document_id}/status")
def get_document_status(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get the processing status of a document.
    Returns: pending, processing, completed, or failed
    """
    doc_record = document_crud.get(db, id=document_id)
    if not doc_record or doc_record.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")

    return {
        "document_id": document_id,
        "status": doc_record.processing_status,
        "filename": doc_record.filename,
    }


@router.post("/chat/transcribe")
def transcribe_audio(
    audio: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Transcribe audio using Groq's Whisper model.
    Accepts an audio file and returns the transcribed text.
    Max file size: 25MB to prevent DOS.
    """
    MAX_AUDIO_SIZE = 25 * 1024 * 1024  # 25MB
    try:
        # Check Content-Length before reading to avoid buffering huge files
        if audio.size and audio.size > MAX_AUDIO_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"Audio file too large. Maximum size is {MAX_AUDIO_SIZE // (1024 * 1024)}MB.",
            )
        audio_content = audio.file.read()
        if len(audio_content) > MAX_AUDIO_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"Audio file too large. Maximum size is {MAX_AUDIO_SIZE // (1024 * 1024)}MB.",
            )
        transcription = ai_service.transcribe_audio(
            audio_content, audio.filename or "audio.wav", user_id=current_user.id, db=db
        )
        return {"text": transcription}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
