# Docker Setup Guide

## Prerequisites

- Docker and Docker Compose installed
- All required API keys (Google, Cerebras, Groq)

## Setup Steps

### 1. Create `.env` file from template

```bash
cp .env.example .env
```

### 2. Edit `.env` with your values

```bash
# Update these in .env:
POSTGRES_DB=ChatNova
POSTGRES_USER=chatnova_user
POSTGRES_PASSWORD=your_strong_password_here  # Change this!

GOOGLE_API_KEY=xxx
CEREBRAS_API_KEY=xxx
GROQ_API_KEY=xxx

# Generate FERNET_KEY (encryption):
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Generate SECRET_KEY (JWT):
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 3. Build and start containers

```bash
docker-compose up --build
```

This will:

- Build the backend image
- Start PostgreSQL database
- Run database migrations automatically (alembic upgrade head)
- Start the backend server

### 4. Access the application

- Backend API: <http://localhost:8000>
- API Docs: <http://localhost:8000/docs>

## Useful Commands

```bash
# View logs
docker-compose logs -f backend
docker-compose logs -f db

# Stop containers
docker-compose down

# Remove all data (reset database)
docker-compose down -v

# Rebuild images
docker-compose build --no-cache

# Run migrations manually
docker-compose exec backend alembic upgrade head

# Access database shell
docker-compose exec db psql -U chatnova_user -d ChatNova
```

## Database Connection

From inside Docker:

- Host: `db` (service name)
- Port: `5432`
- User: `${POSTGRES_USER}`
- Password: `${POSTGRES_PASSWORD}`
- Database: `${POSTGRES_DB}`

## Notes

- Database uses health checks before starting backend
- Migrations run automatically on container startup
- Volume `postgres_data` persists database between restarts
- Remove `--reload` flag in production (currently disabled in docker-compose)
