import asyncio
import gzip
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

from app import crud
from app.api.deps import get_current_active_user, get_db
from app.core.input_validation import InputSanitizer
from app.core.profiler import request_profiler
from app.crud.document import chunk as chunk_crud
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
from app.services.document_processor import DocumentProcessor
from app.services.embedding_service import EmbeddingService
from app.services.session_service import session_service
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

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


router = APIRouter()


def _validate_session_ownership(db: Session, session_id: int, user_id: int) -> None:
    session_obj = crud.session.get(db, id=session_id)
    if not session_obj or session_obj.user_id != user_id:
        raise HTTPException(status_code=404, detail="Session not found")


# Session Management Endpoints
@router.post("/sessions", response_model=ChatSession)
@request_profiler.profile_endpoint("/sessions", "POST")
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
@request_profiler.profile_endpoint("/sessions", "GET")
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

    # Get total count for pagination metadata (with search filter if provided)
    total_count = crud.session.count_by_user(db, user_id=current_user.id, search=search)

    # Calculate pagination metadata
    has_more = (skip + limit) < total_count
    current_page = (skip // limit) + 1
    total_pages = (total_count + limit - 1) // limit

    return ChatSessionPagination(
        data=sessions,
        meta={
            "total": total_count,
            "page": current_page,
            "per_page": limit,
            "total_pages": total_pages,
            "has_more": has_more,
            "skip": skip,
            "limit": limit,
        },
    )


@router.get("/sessions/{session_id}", response_model=ChatSession)
@request_profiler.profile_endpoint("/sessions/{session_id}", "GET")
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
@request_profiler.profile_endpoint("/sessions/{session_id}", "PUT")
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
@request_profiler.profile_endpoint("/sessions/{session_id}", "DELETE")
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
@request_profiler.profile_endpoint("/sessions/{session_id}/messages", "GET")
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

    # Get total count for pagination metadata
    total_count = crud.message.count_by_user(
        db, user_id=current_user.id, session_id=session_id
    )

    # Calculate pagination metadata
    has_more = (skip + limit) < total_count
    current_page = (skip // limit) + 1
    total_pages = (total_count + limit - 1) // limit

    return MessagePagination(
        data=messages,
        meta={
            "total": total_count,
            "page": current_page,
            "per_page": limit,
            "total_pages": total_pages,
            "has_more": has_more,
            "skip": skip,
            "limit": limit,
        },
    )


@router.delete("/sessions/{session_id}/messages")
@request_profiler.profile_endpoint("/sessions/{session_id}/messages", "DELETE")
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
@request_profiler.profile_endpoint("/chat", "POST")
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
    async for chunk in ai_service.simple_chat(
        message_in.content,
        message_in.model,
        current_user.id,
        db,
        session_id,
        message_in.search_web,
        images=message_in.images,
    ):
        response += chunk
    msg = crud.message.create(
        db,
        obj_in=message_in,
        response=response,
        user_id=current_user.id,
        session_id=session_id,
    )

    # If this is a new session or the session has "New Chat" as title, update it with the first message
    if session_id:
        session_obj = crud.session.get(db, id=session_id)
        if session_obj and (
            session_obj.title == "New Chat"
            or not session_obj.title
            or session_obj.title.strip() == ""
        ):
            # Truncate title to 60 characters to match frontend
            new_title = message_in.content[:60]
            if len(message_in.content) > 60:
                new_title += "..."
            crud.session.update(
                db, db_obj=session_obj, obj_in=ChatSessionUpdate(title=new_title)
            )

    # Extract memories from the user message synchronously
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
@request_profiler.profile_endpoint("/chat-with-tools", "POST")
def chat_with_tools(
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

    response = asyncio.run(
        ai_service.agent_chat(
            message_in.content, message_in.model, current_user.id, db, session_id
        )
    )
    msg = crud.message.create(
        db,
        obj_in=message_in,
        response=response,
        user_id=current_user.id,
        session_id=session_id,
    )

    # If this is a new session or the session has "New Chat" as title, update it with the first message
    if session_id:
        session_obj = crud.session.get(db, id=session_id)
        if session_obj and (
            session_obj.title == "New Chat"
            or not session_obj.title
            or session_obj.title.strip() == ""
        ):
            # Truncate title to 60 characters to match frontend
            new_title = message_in.content[:60]
            if len(message_in.content) > 60:
                new_title += "..."
            crud.session.update(
                db, db_obj=session_obj, obj_in=ChatSessionUpdate(title=new_title)
            )

    # Extract memories from the user message synchronously
    saved_memories = []
    try:
        # Since this endpoint is def (sync), we use asyncio.run to call the async extract method
        saved_memories = asyncio.run(
            ai_service.extract_and_save_memories(
                message_in.content,
                current_user.id,
                message_in.model,
            )
        )
    except Exception as e:
        logger.error(f"Failed to extract memories in chat-with-tools: {e}")

    msg.saved_memories = saved_memories
    return msg


@router.post("/chat/stream")
@request_profiler.profile_endpoint("/chat/stream", "POST")
def chat_stream(
    message_in: MessageCreate,
    background_tasks: BackgroundTasks,
    session_id: Optional[int] = Query(
        None, description="Session ID for conversation context"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Stream AI response in real-time using Server-Sent Events.
    Optionally associate with a session for conversation context.
    """
    if session_id is not None:
        _validate_session_ownership(db, session_id, current_user.id)

    def _format_sse_data(chunk: str) -> str:
        # SSE requires each line to be prefixed with "data: "
        # Preserve empty lines by emitting an empty data field.
        lines = chunk.split("\n")
        return "".join(f"data: {line}\n" for line in lines) + "\n"

    async def stream_response():
        try:
            # Create message record first
            msg = crud.message.create(
                db,
                obj_in=message_in,
                response="",  # Empty initial response
                user_id=current_user.id,
                session_id=session_id,
            )

            # If this is a new session or the session has "New Chat" as title, update it with the first message
            if session_id:
                session_obj = crud.session.get(db, id=session_id)
                if session_obj and (
                    session_obj.title == "New Chat"
                    or not session_obj.title
                    or session_obj.title.strip() == ""
                ):
                    # Truncate title to 60 characters to match frontend
                    new_title = message_in.content[:60]
                    if len(message_in.content) > 60:
                        new_title += "..."
                    crud.session.update(
                        db,
                        db_obj=session_obj,
                        obj_in=ChatSessionUpdate(title=new_title),
                    )

            # Stream the AI response
            full_response = ""
            async for chunk in ai_service.simple_chat(
                message_in.content,
                message_in.model,
                current_user.id,
                db,
                session_id,
                message_in.search_web,
                images=message_in.images,
            ):
                full_response += chunk

                # Send chunk to client
                yield _format_sse_data(chunk)

            # Update the message with the complete response
            crud.message.update(db, db_obj=msg, obj_in={"response": full_response})

            # Extract memories and yield notification events
            try:
                saved_facts = await ai_service.extract_and_save_memories(
                    message_in.content,
                    current_user.id,
                    message_in.model,
                )
                for fact in saved_facts:
                    memory_event = json.dumps({"type": "memory_saved", "content": fact})
                    yield _format_sse_data(memory_event)
            except Exception as e:
                logging.error(f"Failed to process memories in stream: {e}")

            # Send completion signal
            yield "data: [DONE]\n\n"

        except Exception as e:
            yield f"data: ERROR: {str(e)}\n\n"

    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control",
        },
    )


@router.post("/chat/agent-stream")
@request_profiler.profile_endpoint("/chat/agent-stream", "POST")
def chat_agent_stream(
    message_in: MessageCreate,
    background_tasks: BackgroundTasks,
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

    def _format_sse_data(chunk: str) -> str:
        lines = chunk.split("\n")
        return "".join(f"data: {line}\n" for line in lines) + "\n"

    async def stream_response():
        try:
            msg = crud.message.create(
                db,
                obj_in=message_in,
                response="",  # Empty initial response
                user_id=current_user.id,
                session_id=session_id,
            )

            if session_id:
                session_obj = crud.session.get(db, id=session_id)
                if session_obj and (
                    session_obj.title == "New Chat"
                    or not session_obj.title
                    or session_obj.title.strip() == ""
                ):
                    new_title = message_in.content[:60]
                    if len(message_in.content) > 60:
                        new_title += "..."
                    crud.session.update(
                        db,
                        db_obj=session_obj,
                        obj_in=ChatSessionUpdate(title=new_title),
                    )

            full_response = ""
            async for chunk in ai_service.agent_chat_stream(
                message_in.content,
                message_in.model,
                current_user.id,
                db,
                session_id,
            ):
                yield _format_sse_data(chunk)

                try:
                    data = json.loads(chunk)
                    if data.get("type") == "content":
                        full_response += data.get("content", "")
                except (json.JSONDecodeError, Exception):
                    pass

            crud.message.update(db, db_obj=msg, obj_in={"response": full_response})

            # Extract memories and yield notification events
            try:
                saved_facts = await ai_service.extract_and_save_memories(
                    message_in.content,
                    current_user.id,
                    message_in.model,
                )
                for fact in saved_facts:
                    memory_event = json.dumps({"type": "memory_saved", "content": fact})
                    yield _format_sse_data(memory_event)
            except Exception as e:
                logging.error(f"Failed to process memories in agent stream: {e}")

            yield "data: [DONE]\n\n"

        except Exception as e:
            error_event = json.dumps({"type": "error", "content": str(e)})
            yield f"data: {error_event}\n\n"

    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control",
        },
    )


@router.get("/chat/history", response_model=MessagePagination)
@request_profiler.profile_endpoint("/chat/history", "GET")
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
        filtered_messages = []
        for msg in messages:
            filtered_msg = {
                field: getattr(msg, field)
                for field in selected_fields
                if hasattr(msg, field)
            }
            filtered_messages.append(filtered_msg)
        messages = filtered_messages

    # Calculate pagination metadata
    has_more = (skip + limit) < total_count
    current_page = (skip // limit) + 1
    total_pages = (total_count + limit - 1) // limit

    return MessagePagination(
        data=messages,
        meta={
            "total": total_count,
            "page": current_page,
            "per_page": limit,
            "total_pages": total_pages,
            "has_more": has_more,
            "skip": skip,
            "limit": limit,
        },
    )


@router.get("/chat/history/stream", response_class=StreamingResponse)
@request_profiler.profile_endpoint("/chat/history/stream", "GET")
def stream_chat_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(50, ge=1, le=100, description="Number of records to return"),
    newest_first: bool = Query(
        True, description="Order by newest first (true) or oldest first (false)"
    ),
    compress: bool = Query(False, description="Compress response with gzip"),
):
    """
    Stream chat history for the current user.
    Useful for large datasets where client handles decompression.
    """
    messages = crud.message.get_by_user(
        db, user_id=current_user.id, skip=skip, limit=limit, newest_first=newest_first
    )

    def generate():
        # Send messages as JSON lines
        for msg in messages:
            msg_dict = msg.__dict__
            # Remove SQLAlchemy internal attributes
            msg_dict = {k: v for k, v in msg_dict.items() if not k.startswith("_")}

            line = json.dumps(msg_dict) + "\n"

            if compress:
                yield gzip.compress(line.encode("utf-8"))
            else:
                yield line.encode("utf-8")

    if compress:
        return StreamingResponse(
            generate(),
            media_type="application/x-ndjson",
            headers={"Content-Encoding": "gzip"},
        )
    else:
        return StreamingResponse(generate(), media_type="application/x-ndjson")


@router.delete("/chat/history")
@request_profiler.profile_endpoint("/chat/history", "DELETE")
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
@request_profiler.profile_endpoint("/chat/history/{message_id}", "DELETE")
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
@request_profiler.profile_endpoint("/chat/models/test", "POST")
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
    available_models = ai_service.get_available_models(current_user.id, db)
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
@request_profiler.profile_endpoint("/chat/models/test/{provider}", "POST")
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
        "Cerebras": "qwen-3-235b-a22b-instruct-2507",
        "Groq": "moonshotai/kimi-k2-instruct-0905",
    }

    model_name = provider_models.get(provider)
    if not model_name:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")

    llm = ai_service.get_llm_by_provider(provider, api_key)
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
@request_profiler.profile_endpoint("/chat/models", "GET")
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
        "models": ai_service.get_available_models(current_user.id, db),
        "total": len(ai_service.get_available_models(current_user.id, db)),
    }


async def process_document_task(
    file_path: str, document_id: int, user_id: int, db_session_factory: Any
):
    """Background task to process, chunk, and index a document."""
    db = db_session_factory()
    try:
        doc_record = document_crud.get(db, id=document_id)
        if not doc_record:
            return

        text = DocumentProcessor.extract_text(file_path, doc_record.file_type)
        if not text:
            logging.warning(f"No text extracted from {file_path}")
            return

        chunks = DocumentProcessor.chunk_text(text)

        from app.models.document import has_vector

        embeddings = None
        if has_vector:
            embedding_service = EmbeddingService(user_id, db)
            embeddings = await embedding_service.embed_chunks(chunks)

        for i, content in enumerate(chunks):
            chunk_data = {
                "document_id": document_id,
                "content": content,
            }
            if embeddings and i < len(embeddings):
                chunk_data["embedding"] = embeddings[i]

            chunk_crud.create(
                db,
                obj_in=chunk_data,
            )
        logging.info(f"Processed document {document_id}: {len(chunks)} chunks indexed.")
    except Exception as e:
        logging.error(f"Error processing document {document_id}: {e}")
    finally:
        db.close()


@router.post("/chat/upload", response_model=DocumentSchema)
@request_profiler.profile_endpoint("/chat/upload", "POST")
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


@router.post("/chat/transcribe")
@request_profiler.profile_endpoint("/chat/transcribe", "POST")
def transcribe_audio(
    audio: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Transcribe audio using Groq's Whisper model.
    Accepts an audio file and returns the transcribed text.
    """
    try:
        audio_content = audio.file.read()
        transcription = ai_service.transcribe_audio(
            audio_content, audio.filename or "audio.wav", user_id=current_user.id, db=db
        )
        return {"text": transcription}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
