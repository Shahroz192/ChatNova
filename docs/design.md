# System Design: ChatNova

**Last Updated:** January 22, 2026

## 1. Introduction

ChatNova is a multi-provider AI chat platform bridging LLM text outputs and interactive visual experiences. It utilizes a **Bring Your Own Key (BYOK)** architecture and Generative UI to render charts dynamically.

---

## 2. Architectural Views

### 2.1. Logical View

This diagram illustrates the high-level logical components and their interactions.

```mermaid
graph TB
    subgraph ClientLayer [Client Layer]
        SPA[React SPA]
    end

    subgraph ServerLayer [Server Layer]
        Gateway[FastAPI Gateway]
        Auth[Auth Service]
        Orch[AI Orchestrator]
        Mem[Memory Manager]
        GenUI[Generative UI Engine]
    end

    subgraph DataPersistence [Data Persistence]
        DB[(PostgreSQL DB)]
    end

    subgraph ExternalServices [External Services]
        Gemini[Google Gemini API]
        Groq[Groq API]
        Cerebras[Cerebras API]
        Search[Web Search API]
    end

    SPA --> Gateway
    Gateway --> Auth
    Gateway --> Orch
    Orch --> Mem
    Orch --> GenUI
    Orch --> ExternalServices
    Mem --> DB
    Auth --> DB

```

### 2.2. Development View

The organization of the source code follows a strict separation of concerns between the React frontend and modular Python backend.

```mermaid
graph TD
    subgraph Frontend [frontend/src]
        Components[components/]
        Hooks[hooks/]
        Contexts[contexts/]
        App[App.tsx]
    end

    subgraph Backend [backend/app]
        API[api/v1/]
        Core[core/]
        Models[models/]
        Services[services/]
        Main[main.py]
    end

    Main --> API
    API --> Services
    Services --> Core
    Services --> Models
    Components --> Hooks
    Components --> Contexts

```

### 2.3. Process View

**Use Case 1: Chat Message Flow with Memory**

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as FastAPI Backend
    participant D as Database
    participant L as External LLM

    U->>F: Sends Message
    F->>B: POST /chat/
    
    rect rgb(240, 240, 240)
        B->>D: Fetch History & Memory
        B->>D: Decrypt API Key
    end
    
    B->>L: Stream Prompt
    
    loop Streaming
        L-->>B: Chunk
        B-->>F: SSE Event
    end
    
    rect rgb(240, 255, 240)
        B->>B: Extract Facts
        B->>D: Save Memory & Message
    end

```

---

## 3. Data Design

### 3.1. Core Data Model

The database schema centers around the `User`, who owns `ChatSessions`, `APIKeys`, and `Memories`.

```mermaid
classDiagram
    direction LR
    class User {
        +int id
        +string email
        +string hashed_password
    }
    class ChatSession {
        +int id
        +int user_id
        +string title
    }
    class Message {
        +int id
        +int session_id
        +text content
    }
    class UserAPIKey {
        +int id
        +string encrypted_key
    }
    class UserMemory {
        +int id
        +text content
    }

    User "1" -- "*" ChatSession
    ChatSession "1" -- "*" Message
    User "1" -- "*" UserAPIKey
    User "1" -- "*" UserMemory

```
