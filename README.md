# ChatNova

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Python](https://img.shields.io/badge/python-3.12+-blue)
![FastAPI](https://img.shields.io/badge/fastapi-0.118+-green)
![React](https://img.shields.io/badge/react-19.2+-blue)
![TypeScript](https://img.shields.io/badge/typescript-5.9-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Description

ChatNova is a robust and modern AI chat application designed to provide a unified interface for interacting with multiple Large Language Models (LLMs). It seamlessly integrates models from providers like Google (Gemini), Cerebras (Qwen), and Groq, allowing users to leverage the best AI tools from a single platform.

Beyond standard text chat, ChatNova features **Multi-Modal RAG (Retrieval-Augmented Generation)** capabilities, allowing users to upload documents and images to provide session-specific context. The application also includes **Web Search** integration for real-time information retrieval and "Generative UI" for dynamic rendering of charts and image galleries directly within the conversation stream.

ChatNova supports **Agent (Tool-Enabled) Chat** via MCP servers, **Audio Transcription** through Groq Whisper, **Long-term User Memories** for persistent context, and **Bring Your Own Key (BYOK)** for users to supply their own API keys.

## Key Features

- **Multi-Provider AI Support**: Interact with models from Google (Gemini), Cerebras (Qwen), and Groq via LangChain integration.
- **Agent (Tool-Enabled) Chat**: ReAct agent loop with MCP tool integration for multi-step reasoning and external tool use.
- **Multi-Modal RAG Support**: Upload documents (PDF, DOCX, TXT, MD) and images (Gemini models) to provide session-bound context for AI responses with automatic inline citations. RAG results are re-ranked via FlashRank for higher relevance.
- **Web Search Integration**: Real-time web access via DuckDuckGo to supplement AI responses with up-to-date information.
- **Model Context Protocol (MCP)**: Manage and connect to MCP servers for standardized tool access and resource interaction.
- **Generative UI**: Automatically render interactive charts (Bar, Line, Pie) and image galleries based on AI responses using Recharts and React components.
- **Long-term User Memories**: Persistent memory system that auto-extracts and retrieves relevant memories across sessions for personalized interactions.
- **Audio Transcription**: Transcribe voice input using Groq Whisper (whisper-large-v3).
- **Bring Your Own Key (BYOK)**: Users can supply their own API keys for supported providers, encrypted at rest via Fernet.
- **Model Testing**: Test model connectivity and response quality from a dedicated interface.
- **Custom Instructions**: Users can define personalized system instructions to tailor the AI's persona and response style.
- **Secure Authentication**: Robust user management system with JWT-based authentication, token blacklisting, and secure password hashing.
- **Persistent Chat History**: Save and retrieve past conversations with search/filtering and message regeneration support.
- **Responsive Design**: A modern, mobile-friendly interface with dark/light theme support, built with React, Bootstrap, and Lucide icons.

## Architecture

ChatNova follows a modern client-server architecture:

1. **Frontend (Client)**: A React-based Single Page Application (SPA) served via Vite. It handles user interactions, renders the Generative UI components, and communicates with the backend via RESTful APIs.
2. **Backend (API)**: A FastAPI application that serves as the orchestrator. It manages authentication, processes chat requests, performs document chunking/embedding, and integrates with external AI APIs.
3. **Database**: PostgreSQL with the **pgvector** extension is used for persistent storage and high-performance vector similarity search for RAG.
4. **AI Integration Layer**: The backend utilizes LangChain and Model Context Protocol (MCP) adapters to standardize interactions with various LLM providers.

## Tech Stack

**Frontend:**

- **Framework**: React 19, TypeScript 5.9
- **Routing**: React Router DOM v7
- **Build Tool**: Vite 7
- **Styling**: Bootstrap 5, React-Bootstrap
- **Visualization**: Recharts, Chart.js
- **Icons**: Lucide React
- **Markdown**: react-markdown, react-syntax-highlighter, remark-gfm
- **HTTP Client**: Axios
- **Theming**: next-themes (dark/light mode)
- **Testing**: Vitest, Testing Library, jsdom
- **Package Manager**: pnpm

**Backend:**

- **Framework**: Python 3.12+, FastAPI 0.118+
- **Database**: PostgreSQL 16, pgvector, SQLAlchemy 2.0, Alembic, psycopg2-binary
- **AI/ML**: LangChain (Core, Google, Cerebras, Groq), langchain-mcp-adapters, sentence-transformers, flashrank (RAG re-ranking)
- **Audio**: Groq Whisper (whisper-large-v3) for transcription
- **Document Processing**: PyMuPDF (fitz), python-docx
- **Security**: OAuth2 (JWT), Passlib (Bcrypt), Bleach (Sanitization), python-jose, cryptography (Fernet)
- **Web Search**: duckduckgo-search
- **Utilities**: SlowAPI (Rate Limiting), Pydantic V2, httpx
- **Package Manager**: uv

**Infrastructure:**

- Docker & Docker Compose

## Installation and Setup

### Prerequisites

- **Python**: 3.12 or higher
- **Node.js**: 20 or higher
- **pnpm**: Installed globally (`npm install -g pnpm`)
- **Docker**: For running the database (and full stack via Compose)

### 1. Clone the Repository

```bash
git clone https://github.com/shahroz192/ChatNova.git
cd ChatNova
```

### 2. Configure Environment

Create a `.env` file in the root directory based on the example:

```bash
cp .env.example .env
```

Open `.env` and populate the critical variables:

- `POSTGRES_PASSWORD`: Set a strong password (min 12 characters).
- `FERNET_KEY`: Generate with:
  ```bash
  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
  ```
- `SECRET_KEY`: Generate with:
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(32))"
  ```
- `GOOGLE_API_KEY`: Your Google Gemini API key.
- `CEREBRAS_API_KEY`: Your Cerebras API key.
- `GROQ_API_KEY`: Your Groq API key.

### 3. Install Dependencies

**Backend:**
ChatNova uses `uv` for extremely fast Python package management.

```bash
# Install uv if not already installed
pip install uv

# Sync dependencies
uv sync
```

**Frontend:**

```bash
cd frontend
pnpm install
cd ..
```

## Usage

### Option 1: Docker Compose (Backend + Database)

Docker Compose runs the database and backend services. The frontend must be started separately.

```bash
docker-compose up --build
```

- **Backend API**: <http://localhost:8000>
- **API Docs**: <http://localhost:8000/docs>

Then in a separate terminal, start the frontend:

```bash
cd frontend && pnpm dev
```

- **Frontend**: <http://localhost:5173>

### Option 2: Local Development

If you prefer running services locally:

1. **Start the Database**:

    ```bash
    docker-compose up db -d
    ```

2. **Run Migrations**:

    ```bash
    cd backend
    uv run alembic upgrade head
    ```

3. **Start Backend**:

    ```bash
    # From backend/ directory
    uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
    ```

4. **Start Frontend**:

    ```bash
    # From frontend/ directory
    pnpm dev
    ```

### Example Usage (API)

Verify the backend is running with a health check:

```bash
curl -X GET http://localhost:8000/ -H "accept: application/json"
```

## Running Tests

### Backend Tests

Backend tests run against an in-memory SQLite database (no PostgreSQL needed).

```bash
# Using the convenience script (includes coverage)
./run_tests_with_coverage.sh

# Or directly with uv/pytest
cd backend
uv run pytest

# Run a specific test file
cd backend && PYTHONPATH=. uv run pytest tests/unit/test_filename.py
```

### Frontend Tests

```bash
# Watch mode
cd frontend && pnpm test

# CI/Run once mode
cd frontend && pnpm test -- --run

# Specific file
cd frontend && pnpm test -- src/components/chat/__tests__/ChatInput.test.tsx --run
```

## License

This project is licensed under the MIT License.
