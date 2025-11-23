# ChatNova

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Python](https://img.shields.io/badge/python-3.12+-blue)
![FastAPI](https://img.shields.io/badge/fastapi-0.118.2+-green)
![React](https://img.shields.io/badge/react-19.2.0-blue)
![TypeScript](https://img.shields.io/badge/typescript-5.9.3-blue)
![License](https://img.shields.io/github/license/shahroz192/ai-chat-pro)

## Description

ChatNova is a comprehensive chat application that provides access to multiple large language models (LLMs) from different providers in a single interface. It enables users to interact with state-of-the-art AI models including Google's Gemini, Cerebras' Qwen, and Groq's models, all from one convenient platform. The application features user authentication, chat history, and a clean, intuitive interface for seamless AI interactions.

The platform is built with modern web technologies to ensure high performance, security, and scalability while providing an easy-to-use interface for interacting with various AI models.

## Key Features

- **Multi-Model Support**: Access to popular AI models from providers like Google, Cerebras, and Groq
- **User Management**: Complete authentication system with JWT-based security and user profiles
- **LangChain Integration**: Built-in support for LangChain tools and Model Context Protocol (MCP) adapters
- **Modern UI**: React-based frontend with TypeScript for type safety and Bootstrap for responsive styling
- **Chat History**: Track and manage your conversations with AI models
- **Performance Optimization**: Memory and database profiling for optimal performance
- **Cross-Platform**: Works seamlessly across desktop and mobile devices
- **Security**: Encrypted data transmission, JWT tokens, and password hashing with bcrypt

## Tech Stack

- **Backend**: FastAPI, Python 3.12+, SQLAlchemy, PostgreSQL
- **Frontend**: React 19, TypeScript 5.9.3, Bootstrap, Vite, Axios, React-Router-DOM
- **AI/ML**: LangChain, LangChain Google GenAI, LangChain Cerebras, LangChain Groq, LangChain MCP Adapters
- **Database**: PostgreSQL, Alembic (for migrations)
- **Authentication**: JWT, Bcrypt, python-jose
- **Development**: uv, Docker, Docker Compose, pnpm
- **Performance**: psutil, memory profiling, database query monitoring

## Installation and Setup

### Prerequisites

- Python 3.12+
- Node.js 20+ and pnpm
- Docker and Docker Compose
- PostgreSQL (or Docker to run PostgreSQL in a container)
- API keys for supported AI models (Google, Cerebras, Groq)

### Clone

```bash
git clone https://github.com/shahroz192/ai-chat-pro.git
cd ai-chat-pro
```

### Install Backend Dependencies

For the backend, install Python dependencies using uv (recommended):

```bash
# Using uv (recommended)
uv sync

# Or using pip
pip install -r backend/requirements.txt
```

### Install Frontend Dependencies

For the frontend, install JavaScript dependencies using pnpm:

```bash
cd frontend
pnpm install
```

### Configure Environment

1. Create a `.env` file based on the example:

   ```bash
   cp .env.example .env
   ```

2. Update the `.env` file with your actual API keys and configuration values:

   ```
   POSTGRES_DB=ChatNova
   POSTGRES_USER=chatnova_user
   POSTGRES_PASSWORD=your_strong_password

   GOOGLE_API_KEY=your-google-api-key
   CEREBRAS_API_KEY=your-cerebras-api-key
   GROQ_API_KEY=your-groq-api-key

   FERNET_KEY=generate_using_provided_command
   SECRET_KEY=generate_using_provided_command
   ```

   See [DOCKER_SETUP.md](./DOCKER_SETUP.md) for detailed instructions.

## Usage

### Docker Compose (Recommended for Production)

For the easiest setup with all services containerized:

```bash
# 1. Create and configure .env file
cp .env.example .env
# Edit .env with your values

# 2. Build and start all services
docker-compose up --build
```

The backend API will be available at `http://localhost:8000`.

For detailed Docker setup and commands, see [DOCKER_SETUP.md](./DOCKER_SETUP.md).

### Local Development Mode

For development with live reload:

1. **Start PostgreSQL** (using Docker):

   ```bash
   docker-compose up db -d
   ```

2. **Configure local environment**:

   ```bash
   # Update DATABASE_URL to use localhost instead of db container
   # DATABASE_URL=postgresql://chatnova_user:your_password@localhost:5432/ChatNova
   ```

3. **Run database migrations**:

   ```bash
   cd backend
   uv run alembic upgrade head
   ```

4. **Start the backend server** (with auto-reload):

   ```bash
   cd backend
   uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

5. **Start the frontend** (in a new terminal):

   ```bash
   cd frontend
   pnpm install  # if not already installed
   pnpm dev
   ```

The backend API will be available at `http://localhost:8000` and the frontend at `http://localhost:5173`.

### Available Endpoints

- `GET /` - Health check endpoint
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/chat/send` - Send a message to AI models
- `GET /api/v1/users/me` - Get current user info
- `GET /api/v1/chat/history` - Get chat history

Example API call to the root endpoint:

```bash
curl http://localhost:8000/
```

## Running Tests

### Backend Tests

Run backend tests using pytest:

```bash
# From the backend directory
cd backend
python -m pytest
```

### Frontend Tests

Run frontend tests using the test script:

```bash
# From the frontend directory
cd frontend
pnpm test
```

### Linting and Type Checking

Check frontend code quality:

```bash
# From the frontend directory
cd frontend
pnpm lint
pnpm tsc --noEmit
```

## Performance Monitoring

ChatNova includes performance monitoring capabilities:

- **Memory Profiling**: Tracks memory usage and helps identify leaks
- **Database Query Monitoring**: Monitors SQL queries for optimization opportunities
- **Request Profiling**: Measures API endpoint performance

To view performance dashboards:

```bash
# Generate flame graphs for performance analysis
cd backend
python generate_flame_graph.py
```

## Architecture

The application follows a clean architecture pattern with a clear separation of concerns:

- `backend/app/api/v1/` - API endpoint definitions (auth, chat, users)
- `backend/app/models/` - Database models with SQLAlchemy
- `backend/app/schemas/` - Pydantic schemas for request/response validation
- `backend/app/crud/` - Database operations (Create, Read, Update, Delete)
- `backend/app/services/` - Business logic implementations
- `backend/app/core/` - Configuration, security, and utility functions
- `backend/app/database.py` - Database connection setup
- `frontend/src/components/` - React components
- `frontend/src/hooks/` - Custom React hooks
- `frontend/src/services/` - API service functions
- `frontend/src/types/` - TypeScript type definitions

## Project Status

This project is under active development. We are continuously working on:

- Adding support for more AI models
- Improving UI/UX
- Adding advanced features like conversation threading
- Performance optimizations
- Comprehensive testing
