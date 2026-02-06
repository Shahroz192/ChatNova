# Repository Guidelines

## Project Structure & Module Organization

- `backend/`: FastAPI app, SQLAlchemy models, Alembic migrations (`backend/alembic/`).
- `frontend/`: Vite + React UI.
- `tests/`: Pytest suites (unit + integration).
- `docs/`: Project docs.
- `docker-compose.yml`, `DOCKER_SETUP.md`: Docker setup.

## Build, Test, and Development Commands

- Backend dev server (from `backend/`):
  - `uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
- Frontend dev server (from `frontend/`):
  - `pnpm dev`
- Frontend build (from `frontend/`):
  - `pnpm build`
- Backend tests:
  - `./run_tests_with_coverage.sh` (coverage)
  - `cd backend && uv run pytest`

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
