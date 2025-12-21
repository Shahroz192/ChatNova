# ChatNova

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Python](https://img.shields.io/badge/python-3.12+-blue)
![FastAPI](https://img.shields.io/badge/fastapi-0.118.2+-green)
![React](https://img.shields.io/badge/react-19.2.0-blue)
![TypeScript](https://img.shields.io/badge/typescript-5.9.3-blue)
![License](https://img.shields.io/github/license/shahroz192/ai-chat-pro)

## Description

ChatNova is a robust and modern AI chat application designed to provide a unified interface for interacting with multiple Large Language Models (LLMs). It seamlessly integrates models from providers like Google (Gemini), Cerebras (Qwen), and Groq, allowing users to leverage the best AI tools from a single platform. Beyond standard text chat, ChatNova features "Generative UI" capabilities, enabling the dynamic rendering of charts and image galleries directly within the conversation stream.

Built with performance and scalability in mind, the application employs a high-performance FastAPI backend and a reactive frontend using React 19 and Vite. It includes comprehensive user authentication, chat history management, and detailed performance profiling tools for memory and database optimization.

## Key Features

- **Multi-Provider AI Support**: Interact with models from Google, Cerebras, and Groq via LangChain integration.
- **Generative UI**: Automatically render interactive charts (Bar, Line, Pie) and image galleries based on AI responses.
- **Secure Authentication**: Robust user management system with JWT-based authentication and secure password hashing.
- **Persistent Chat History**: Save and retrieve past conversations with a user-friendly history interface.
- **Performance Profiling**: Built-in tools for monitoring memory usage and database query performance.
- **Responsive Design**: a modern, mobile-friendly interface built with React and Bootstrap.

## Architecture

ChatNova follows a modern client-server architecture:

1.  **Frontend (Client)**: A React-based Single Page Application (SPA) served via Vite. It handles user interactions, renders the Generative UI components, and communicates with the backend via RESTful APIs.
2.  **Backend (API)**: A FastAPI application that serves as the orchestrator. It manages authentication, processes chat requests, integrates with external AI APIs using LangChain, and handles database operations.
3.  **Database**: PostgreSQL is used for persistent storage of user data, chat sessions, and messages.
4.  **AI Integration Layer**: The backend utilizes LangChain and Model Context Protocol (MCP) adapters to standardize interactions with various LLM providers.

## Tech Stack

- **Frontend**:
    - React 19
    - TypeScript 5.9
    - Vite 7
    - Bootstrap 5 & React-Bootstrap
    - Chart.js & React-Chartjs-2
- **Backend**:
    - Python 3.12+
    - FastAPI 0.118+
    - SQLAlchemy & Alembic (Database & Migrations)
    - LangChain (Core, Google, Cerebras, Groq, Community)
    - Pydantic 2.12+
- **Infrastructure & Tools**:
    - Docker & Docker Compose
    - PostgreSQL
    - uv (Python Package Manager)
    - pnpm (Node Package Manager)

## Installation and Setup

### Prerequisites

- **Python**: 3.12 or higher
- **Node.js**: 20 or higher
- **pnpm**: Installed globally (`npm install -g pnpm`)
- **Docker**: For running the database (and full stack via Compose)

### 1. Clone the Repository

```bash
git clone https://github.com/shahroz192/ai-chat-pro.git
cd ai-chat-pro
```

### 2. Configure Environment

Create a `.env` file in the root directory based on the example:

```bash
cp .env.example .env
```

Open `.env` and populate the following critical variables:
- `POSTGRES_PASSWORD`: Set a strong password.
- `GOOGLE_API_KEY`: Your Google Gemini API key.
- `CEREBRAS_API_KEY`: Your Cerebras API key.
- `GROQ_API_KEY`: Your Groq API key.
- `SECRET_KEY` & `FERNET_KEY`: Generate these using the commands found in `DOCKER_SETUP.md`.

### 3. Install Dependencies

**Backend:**
ChatNova uses `uv` for fast Python package management.

```bash
# Install uv if not already installed
pip install uv

# Sync dependencies
uv sync
```
*Alternatively, you can use pip: `pip install -r backend/requirements.txt`*

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

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### Option 2: Local Development

If you prefer running services locally:

1.  **Start the Database**:
    ```bash
    docker-compose up db -d
    ```

2.  **Run Migrations**:
    ```bash
    cd backend
    uv run alembic upgrade head
    ```

3.  **Start Backend**:
    ```bash
    # From backend/ directory
    uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
    ```

4.  **Start Frontend**:
    ```bash
    # From frontend/ directory
    pnpm dev
    ```

### Example Usage (API)

Verify the backend is running with a health check:

```bash
curl http://localhost:8000/
```

## Running Tests

### Backend Tests

Run the backend test suite using `pytest`:

```bash
cd backend
python -m pytest
```

*Note: Frontend tests are currently under development.*

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.