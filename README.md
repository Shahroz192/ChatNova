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

## Key Features

- **Multi-Provider AI Support**: Interact with models from Google, Cerebras, and Groq via LangChain integration.
- **Multi-Modal RAG Support**: Upload documents (PDF, DOCX, TXT, MD) and images (Gemini models) to provide session-bound context for AI responses with automatic inline citations.
- **Web Search Integration**: Real-time web access to supplement AI responses with up-to-date information.
- **Model Context Protocol (MCP)**: Implements MCP adapters to standardize interactions and extend capabilities with various tools and resources.
- **Generative UI**: Automatically render interactive charts (Bar, Line, Pie) and image galleries based on AI responses using Recharts and React components.
- **Custom Instructions**: Users can define personalized system instructions to tailor the AI's persona and response style.
- **Secure Authentication**: Robust user management system with JWT-based authentication and secure password hashing.
- **Persistent Chat History**: Save and retrieve past conversations with a user-friendly history interface.
- **Performance Profiling**: Built-in tools for monitoring memory usage and database query performance.
- **Responsive Design**: A modern, mobile-friendly interface built with React, Bootstrap, and Lucide icons.

## Architecture

ChatNova follows a modern client-server architecture:

1. **Frontend (Client)**: A React-based Single Page Application (SPA) served via Vite. It handles user interactions, renders the Generative UI components, and communicates with the backend via RESTful APIs.
2. **Backend (API)**: A FastAPI application that serves as the orchestrator. It manages authentication, processes chat requests, performs document chunking/embedding, and integrates with external AI APIs.
3. **Database**: PostgreSQL with the **pgvector** extension is used for persistent storage and high-performance vector similarity search for RAG.
4. **AI Integration Layer**: The backend utilizes LangChain and Model Context Protocol (MCP) adapters to standardize interactions with various LLM providers.

## Tech Stack

**Frontend:**

- **Framework**: React 19, TypeScript 5.9
- **Build Tool**: Vite 7
- **Styling**: Bootstrap 5, React-Bootstrap
- **Visualization**: Recharts, Chart.js
- **Icons**: Lucide React
- **Package Manager**: pnpm

**Backend:**

- **Framework**: Python 3.12+, FastAPI 0.118+
- **Database**: PostgreSQL 16, pgvector, SQLAlchemy 2.0, Alembic
- **AI/ML**: LangChain (Core, Google, Cerebras, Groq), MCP Adapters
- **Document Processing**: PyMuPDF (fitz), python-docx
- **Security**: OAuth2 (JWT), Passlib (Bcrypt), Bleach (Sanitization)
- **Utilities**: SlowAPI (Rate Limiting), Pydantic V2
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

- `POSTGRES_PASSWORD`: Set a strong password.
- `GOOGLE_API_KEY`: Your Google Gemini API key.
- `CEREBRAS_API_KEY`: Your Cerebras API key.
- `GROQ_API_KEY`: Your Groq API key.
- `SECRET_KEY` & `FERNET_KEY`: Generate these using the commands found in `DOCKER_SETUP.md`.

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

### Option 1: Docker Compose (Recommended)

The easiest way to run the entire application is with Docker Compose.

```bash
docker-compose up --build
```

- **Frontend**: <http://localhost:5173>
- **Backend API**: <http://localhost:8000>
- **API Docs**: <http://localhost:8000/docs>

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

Run the backend test suite using `pytest` or the provided script:

```bash
# Using the convenience script (includes coverage)
./run_tests_with_coverage.sh

# Or directly with uv/pytest
cd backend
uv run pytest
```

## License

This project is licensed under the MIT License.
