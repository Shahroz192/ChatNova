# Repository Guidelines

## Project Structure & Module Organization

- `backend/`: FastAPI app, SQLAlchemy models, Alembic migrations (`backend/alembic/`).
- `frontend/`: Vite + React UI.
- `tests/`: Pytest suites (unit + integration).
- `docs/`: Project docs.
- `docker-compose.yml`, `DOCKER_SETUP.md`: Docker setup.

## Build, Test, and Development Commands

### **IMPORTANT: Run Full Project**

- **Backend dev server (from `backend/`):**
  - `uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- **Frontend dev server (from `frontend/`):**
  - `pnpm dev`
- **Run migrations (from `backend/`):**
  - `uv run python run_migrations.py`

- Frontend build (from `frontend/`):
  - `pnpm build`
- Backend tests (from `backend/`):
  - `PYTHONPATH=. uv run pytest` (Standard)
  - `PYTHONPATH=. uv run pytest tests/unit/test_filename.py` (Specific file)
  - `../run_tests_with_coverage.sh` (Coverage from root or backend)
- Frontend tests (from `frontend/`):
  - `pnpm test` (Watch mode)
  - `pnpm test -- --run` (CI/Run once mode)
  - `pnpm test -- src/components/chat/__tests__/ChatInput.test.tsx --run` (Specific file)

## Workflow Guidelines

### **CRITICAL: Reading Files**

- **ALWAYS** read the file fully using the `read_file` tool before attempting any modification. This ensures you understand the context and don't introduce unintended side effects.

### **CRITICAL: Linting & Type-Checking**

- **ALWAYS** run linting or type-checking after making code changes:
  - **Backend (from `backend/`):** `uv run ruff check .`
  - **Frontend (from `frontend/`):** `pnpm build` (runs `tsc` for type-checking).
- Ensure all tests pass before completing a task.

## Coding Style & Naming Conventions

- Python: 4-space indentation, type hints encouraged.
- Frontend: TypeScript/React; prefer functional components and hooks.
- Alembic revisions live in `backend/alembic/versions/` with descriptive filenames.
- Naming: use `snake_case` for Python, `camelCase` for TS/JS, `PascalCase` for React components.

## Testing Guidelines

- Backend: `pytest` + `pytest-asyncio`.
- Frontend: `vitest` (`pnpm test`) and optional coverage (`pnpm coverage`).
- Test files use `test_*.py` or `*.test.tsx` conventions.

## Commit & Pull Request Guidelines

- Commits follow Conventional Commits (e.g., `feat(frontend): ...`, `fix(backend): ...`, `docs: ...`).
- PRs should include a clear summary, testing performed, and screenshots for UI changes.

## Configuration & Secrets

- Environment variables are defined in `.env` / `.env.example`.
- Avoid committing secrets. Use local `.env` files for API keys.

## Key Technical Decisions

### Streaming & SSE Architecture

- **`chat_stream` endpoint uses `def` (sync), not `async def`.** The inner `stream_response()` is an async generator consumed by `StreamingResponse`. The ASGI server iterates the async generator on the main event loop. Keep `def` (not `async def`) for the endpoint — changing it would alter FastAPI's execution model.

- **Must use `asyncio.get_running_loop()` NOT `asyncio.get_event_loop()`.** The project runs on Python 3.14 where `get_event_loop()` raises `RuntimeError` when called inside async generators consumed by `StreamingResponse`. Always use `get_running_loop()` in async contexts.

- **`bind_tools([generate_ui])` is used in BOTH search and non-search paths** for generative UI (the app's USP). This is intentional. When no tool is called, all providers (Gemini, Cerebras, Groq) return `chunk.content` as a normal string — tool calls only appear when the LLM decides to render UI.

- **Search fallback condition is `if not search_web:` (not `if not search_web or not full_response:`).** The latter caused the non-search LLM to run AGAIN after the search LLM completed, doubling latency. The correct condition only runs the non-search path when search is disabled or failed.

- **UI generation post-processing has a 10s timeout** via `asyncio.wait_for(timeout=10.0)`. The `generate_ui()` call makes an extra LLM call with `with_structured_output()` — if this hangs, `[DONE]` is delayed and the frontend shows infinite loading.

- **Frontend SSE stream has a 90s safety timeout.** The `AbortController` is automatically aborted if the stream doesn't complete within 90s, preventing infinite loading. The catch block checks `error.name === "AbortError"` to avoid duplicate toast messages.
