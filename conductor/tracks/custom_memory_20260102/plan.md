# Plan: Custom Instructions & Long-term Memory

## Phase 1: Backend - Custom Instructions
- [x] Task: Update User Model for Custom Instructions [cafcc8e]
    - [x] Subtask: Write Tests: Create tests for `custom_instructions` field in User model and CRUD updates.
    - [x] Subtask: Implement Feature: Add `custom_instructions` column to `User` model via Alembic migration and update Pydantic schemas (`UserUpdate`, `User`).
- [x] Task: API for Custom Instructions [5a62ea4]
    - [x] Subtask: Write Tests: Create API tests for `PATCH /users/me/instructions`.
    - [x] Subtask: Implement Feature: Update `users.py` router to handle instruction updates.
- [ ] Task: Integrate Instructions into AI Context
    - [ ] Subtask: Write Tests: Create unit tests for `AIChatService` verifying system prompt includes custom instructions.
    - [ ] Subtask: Implement Feature: Modify `AIChatService` (or `generative_ui.py` system prompt builder) to append the user's custom instructions.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Backend - Custom Instructions' (Protocol in workflow.md)

## Phase 2: Backend - Long-term Memory System
- [ ] Task: Create UserMemory Model
    - [ ] Subtask: Write Tests: Create tests for `UserMemory` model creation and retrieval.
    - [ ] Subtask: Implement Feature: Create `UserMemory` SQLAlchemy model and Alembic migration.
- [ ] Task: Memory CRUD API
    - [ ] Subtask: Write Tests: Create API tests for GET, POST, DELETE `/users/me/memories`.
    - [ ] Subtask: Implement Feature: Implement `memories.py` router and CRUD service for managing user memories.
- [ ] Task: Memory Injection Logic
    - [ ] Subtask: Write Tests: Create tests verifying that relevant memories are retrieved and formatted for the LLM prompt.
    - [ ] Subtask: Implement Feature: Add logic to fetch user memories and format them into a "Context/Memory" section in the system prompt.
- [ ] Task: Basic Fact Extraction (Auto-Memory)
    - [ ] Subtask: Write Tests: Create tests for a helper function that extracts facts from text (using a mocked LLM call).
    - [ ] Subtask: Implement Feature: Implement a lightweight extraction step (e.g., async task after message) that asks the LLM to identify "permanent facts" and saves them to `UserMemory`.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Backend - Long-term Memory System' (Protocol in workflow.md)

## Phase 3: Frontend - Personalization UI
- [ ] Task: Settings UI - Custom Instructions
    - [ ] Subtask: Write Tests: Create component tests for the Custom Instructions input form.
    - [ ] Subtask: Implement Feature: Add "Personalization" tab to Settings modal. Implement text area for updating `custom_instructions`.
- [ ] Task: Settings UI - Memory Management
    - [ ] Subtask: Write Tests: Create component tests for the Memory List and Delete actions.
    - [ ] Subtask: Implement Feature: Implement a list view of memories in the Settings modal with delete functionality. Connect to `useAuth` or a new `useMemory` hook.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Frontend - Personalization UI' (Protocol in workflow.md)
