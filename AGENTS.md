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
