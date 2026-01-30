# Specification: Multi-Modal RAG & Document Support

## Overview
This track implements a Retrieval-Augmented Generation (RAG) system for ChatNova. It enables users to upload various document types and images to a chat session. The system will extract content, index it using vector search, and allow models to use this context in their responses. Multi-modal capabilities (images) will be restricted to models that support it (Gemini).

## Functional Requirements
- **Unified File Upload:** A frontend component to upload documents (PDF, TXT, MD, DOCX, etc.) and images (PNG, JPG, WEBP).
- **Model-Aware Constraints:** 
    - Enable image uploads ONLY when a multi-modal model (Gemini) is selected.
    - Disable image uploads (but keep document uploads enabled) for non-multi-modal models (Qwen, Kimi).
- **Document Processing Service:**
    - Text extraction from documents using libraries like `PyMuPDF` or `python-docx`.
    - Image processing for multi-modal models.
- **Vector Search (RAG):**
    - Implementation of `pgvector` in PostgreSQL for document indexing.
    - Session-specific context isolation: Documents uploaded to a session are only used within that session.
- **Contextual AI Responses:**
    - AI will use retrieved document chunks to answer queries.
    - Responses will include inline citations (e.g., [1], [2]) pointing to a "Sources" list.

## Tech Stack Changes
- **Database:** Add `pgvector` extension to PostgreSQL.
- **Backend Libraries:** 
    - `langchain-postgres` or `pgvector` for vector storage.
    - `PyMuPDF` (fitz) for PDF extraction.
    - `python-docx` for Word documents.
    - `sentence-transformers` or Gemini embeddings for vectorization.

## Acceptance Criteria
- [ ] Users can upload files to a specific chat session.
- [ ] Image upload is disabled for Cerebras (Qwen) and Groq (Kimi) models.
- [ ] The AI correctly retrieves and cites information from uploaded documents.
- [ ] Document context is isolated per session.
- [ ] Citations appear as inline numbers with a corresponding sources list.

## Out of Scope
- User-level "Permanent Library" (Knowledge Base) - files are session-bound.
- Collaborative document editing.
- OCR for handwriting (standard OCR for typed text is included).
