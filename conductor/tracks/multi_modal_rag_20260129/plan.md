# Implementation Plan: Multi-Modal RAG & Document Support

## Phase 1: Backend Infrastructure (pgvector & Schema)
- [x] Task: Install and Configure `pgvector` [checkpoint: manual]
    - [x] Add `pgvector` and document processing libraries to `backend/requirements.txt`
    - [x] Create an Alembic migration to enable the `vector` extension in PostgreSQL
    - [x] Define the `DocumentChunk` and `SessionDocument` models in SQLAlchemy
- [x] Task: Write Tests for Vector Storage
    - [x] Create tests to verify `pgvector` operations (insert, similarity search)

## Phase 2: Document Processing & Indexing Service
- [x] Task: Implement Document Extraction Service [checkpoint: manual]
    - [x] Write failing tests for PDF, DOCX, and TXT extraction
    - [x] Implement `DocumentProcessor` using `PyMuPDF` and `python-docx`
    - [x] Verify tests pass
- [x] Task: Implement Embedding & Vectorization Logic [checkpoint: manual]
    - [x] Write tests for chunking and embedding generation
    - [x] Implement recursive character text splitting
    - [x] Integrate embedding model (e.g., Google's `text-embedding-004`)

## Phase 3: AI Service Integration (RAG Flow)
- [x] Task: Update AI Chat Service for Context Retrieval [checkpoint: manual]
    - [x] Write tests for session-aware context retrieval
    - [x] Modify `AIChatService` to perform similarity search before LLM invocation
    - [x] Update prompt templates to include retrieved context and citation instructions
- [x] Task: Multi-Modal Logic & Citations [checkpoint: manual]
    - [x] Write tests for Gemini multi-modal input vs. Qwen/Kimi text-only
    - [x] Implement image-to-LLM forwarding for Gemini
    - [x] Implement citation extraction and formatting logic

## Phase 4: Frontend UI (Upload & Constraints)
- [x] Task: Implement File Upload Component [checkpoint: manual]
    - [x] Create `FileUpload` component with progress state
    - [x] Add API utility to handle multi-part file uploads
- [x] Task: Implement Model-Aware UI Constraints [checkpoint: manual]
    - [x] Add logic to disable image uploads for non-multi-modal models
    - [x] Update `ChatInput` to show file attachments
- [x] Task: Render Citations & Sources [checkpoint: manual]
    - [x] Create `SourceList` component for chat messages
    - [x] Update message rendering to handle inline citations
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Frontend UI' (Protocol in workflow.md)

## Phase 5: Final Verification & Performance
- [x] Task: End-to-End RAG Testing [checkpoint: manual]
    - [x] Verify full flow: Upload -> Index -> Ask -> Cited Response
- [x] Task: Performance Profiling [checkpoint: manual]
    - [x] Measure latency of vector search and embedding generation
- [x] Task: Conductor - User Manual Verification 'Final Verification' (Protocol in workflow.md)
