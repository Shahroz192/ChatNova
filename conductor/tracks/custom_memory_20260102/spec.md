# Specification: Custom Instructions & Long-term Memory

## 1. Overview
This track implements personalization features similar to ChatGPT, allowing users to define "Custom Instructions" that apply globally to their chats and a "Long-term Memory" system that stores and retrieves relevant facts across sessions.

## 2. User Stories
- **Custom Instructions**: As a user, I want to define a set of instructions (e.g., "Always code in Python", "Be concise") that the AI follows in every new conversation without me repeating them.
- **Memory Storage**: As a user, I want the AI to remember key facts about me (e.g., "I live in London", "I am a software engineer") so I don't have to repeat context.
- **Memory Management**: As a user, I want to view and delete specific memories to control what the AI knows about me.

## 3. Technical Components

### 3.1 Backend (Python/FastAPI)
- **Database Models**:
    - Update `User` model to include `custom_instructions` (text).
    - New `UserMemory` model: `id`, `user_id`, `content` (text), `created_at`, `last_accessed_at`.
- **API Endpoints**:
    - `PATCH /api/v1/users/me/instructions`: Update custom instructions.
    - `GET /api/v1/users/me/memories`: List memories.
    - `POST /api/v1/users/me/memories`: Manually add a memory (optional, mostly for testing or explicit user addition).
    - `DELETE /api/v1/users/me/memories/{id}`: Delete a memory.
- **AI Service Integration**:
    - **System Prompt Construction**: Append `custom_instructions` to the base system prompt.
    - **Memory Injection**: Before sending a prompt to the LLM, retrieve relevant memories (initially all, or top-k based on simple semantic search/recency if the list is long) and inject them into the context.
    - **Fact Extraction (Auto-Memory)**: Implement a background task or secondary LLM call to extract persistent facts from the user's messages and save them to `UserMemory`.

### 3.2 Frontend (React)
- **Settings Interface**:
    - New "Personalization" section in Settings.
    - Text area for "Custom Instructions".
    - "Manage Memory" interface: List of stored facts with "Delete" buttons.
- **State Management**:
    - Update User context/stores to handle the new fields.

## 4. Design Guidelines
- **Privacy**: Users must be able to see exactly what is stored.
- **Transparency**: The UI should clearly indicate when Custom Instructions or Memory are active (optional, but good for UX).
- **Simplicity**: Start with a simple "List of Facts" for memory rather than a complex vector DB unless necessary for scale. Given the current scope, a standard DB table with per-user association is sufficient for MVP.

## 5. Security Implications
- Custom instructions and memories are sensitive user data. Ensure they are protected by existing authentication (JWT) and RLS (Row Level Security logic in API).
