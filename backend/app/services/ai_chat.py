import os
import asyncio
import logging
import re
import tempfile
from io import BytesIO
from dotenv import load_dotenv
from app.core.generative_ui import GENERATIVE_UI_INSTRUCTION
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain.memory import ConversationBufferMemory
from mcp_use import MCPClient, MCPAgent
from typing import Dict, Any, Optional, AsyncGenerator, List
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_cerebras import ChatCerebras
from langchain_groq import ChatGroq
import groq
from app.core.config import mcp_path
from app.core.ai_profiler import profile_ai_service
from app.core.cache import cache_manager
from app.core.security import decrypt_api_key
from app.crud.user import user_api_key, user_mcp_server
from app.crud.message import message as message_crud
from app.services.web_search import web_search_service
from sqlalchemy.orm import Session
import json

load_dotenv()


def sanitize_user_input(user_input: str) -> str:
    """
    Sanitize user input to prevent basic security issues.

    Args:
        user_input: Raw user input string

    Returns:
        Sanitized user input string
    """
    if not user_input:
        return user_input

    sanitized = user_input

    # Remove null bytes and other control characters
    sanitized = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", sanitized)

    # Limit length to prevent DOS attacks
    max_length = 5000
    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length]

    return sanitized.strip()


class AIChatService:
    def __init__(self):
        self.mcp_client = None
        try:
            self.mcp_client = MCPClient.from_config_file(mcp_path)
        except Exception as e:
            logging.error(f"Error initializing MCP client: {e}")

        # Mapping of providers to their API key parameter names
        self.provider_configs = {
            "Google": {"api_key_param": "google_api_key"},
            "Cerebras": {"api_key_param": "cerebras_api_key"},
            "Groq": {"api_key_param": "groq_api_key"},
        }

        self.llm_configs = {
            "gemini-2.5-flash": {
                "class": ChatGoogleGenerativeAI,
                "model": "gemini-2.5-flash",
                "provider": "Google",
            },
            "qwen-3-235b-a22b-instruct-2507": {
                "class": ChatCerebras,
                "model": "qwen-3-235b-a22b-instruct-2507",
                "provider": "Cerebras",
            },
            "qwen-3-235b-a22b-thinking-2507": {
                "class": ChatCerebras,
                "model": "qwen-3-235b-a22b-thinking-2507",
                "provider": "Cerebras",
            },
            "moonshotai/kimi-k2-instruct-0905": {
                "class": ChatGroq,
                "model": "moonshotai/kimi-k2-instruct-0905",
                "provider": "Groq",
            },
        }

        self.session_memories = {}

        self.prompt = ChatPromptTemplate.from_messages(
            [
                ("system", "You are a helpful AI assistant."),
                MessagesPlaceholder(variable_name="chat_history"),
                ("human", "{input}"),
                ("placeholder", "{agent_scratchpad}"),
            ]
        )
        self.parser = StrOutputParser()

    def get_user_mcp_config(self, user_id: int, db: Session) -> Dict[str, Any]:
        """Get MCP configuration for a user."""
        user_servers = user_mcp_server.get_by_user(db, user_id=user_id)
        if not user_servers:
            return {"mcpServers": {}}

        try:
            config = json.loads(user_servers[0].mcp_servers_config)
            return config
        except (json.JSONDecodeError, IndexError):
            logging.error(f"Invalid MCP server configuration for user {user_id}")
            return {"mcpServers": {}}

    def get_provider_key(
        self, provider: str, user_id: Optional[int] = None, db: Optional[Session] = None
    ) -> Optional[str]:
        """Get API key for a specific provider."""
        if provider not in self.provider_configs:
            return None

        # Check user DB key first (BYOK)
        if user_id and db:
            user_key_obj = user_api_key.get_by_user_and_model(
                db, user_id=user_id, model_name=provider
            )
            if user_key_obj:
                try:
                    return decrypt_api_key(user_key_obj.encrypted_key)
                except Exception as e:
                    logging.error(
                        f"Error decrypting API key for user {user_id}, provider {provider}: {e}"
                    )

        # Fallback to env vars
        from app.core.config import settings

        env_map = {
            "Google": settings.GOOGLE_API_KEY,
            "Cerebras": settings.CEREBRAS_API_KEY,
            "Groq": settings.GROQ_API_KEY,
        }
        return env_map.get(provider)

    def get_llm(
        self,
        model_name: str,
        user_id: Optional[int] = None,
        db: Optional[Session] = None,
        streaming: bool = False,
    ):
        if model_name not in self.llm_configs:
            return None

        config = self.llm_configs[model_name]
        provider = config["provider"]
        llm_class = config["class"]
        model = config["model"]

        api_key = self.get_provider_key(provider, user_id, db)

        if not api_key:
            return None

        provider_config = self.provider_configs[provider]
        api_key_param = provider_config["api_key_param"]

        kwargs = {api_key_param: api_key}
        if streaming:
            kwargs["streaming"] = True

        return llm_class(
            model=model,
            **kwargs,
        )

    def get_llm_by_provider(self, provider: str, api_key: str):
        """Get LLM instance for a provider with a provided API key (for validation)."""
        if provider not in self.provider_configs:
            return None

        config = self.provider_configs[provider]
        api_key_param = config["api_key_param"]

        # Get the model name for this provider
        model_name = None
        for name, cfg in self.llm_configs.items():
            if cfg.get("provider") == provider:
                model_name = name
                break

        if not model_name:
            return None

        llm_config = self.llm_configs[model_name]
        llm_class = llm_config["class"]
        model = llm_config["model"]

        kwargs = {api_key_param: api_key}
        return llm_class(model=model, **kwargs)

    def get_available_models(
        self,
        user_id: Optional[int] = None,
        db: Optional[Session] = None,
    ):
        available = []
        for model_name, config in self.llm_configs.items():
            provider = config["provider"]

            if self.get_provider_key(provider, user_id, db):
                available.append(model_name)
                continue

        return available

    def get_session_memory(self, session_id: int) -> ConversationBufferMemory:
        """Get or create memory for a session"""
        if session_id not in self.session_memories:
            self.session_memories[session_id] = ConversationBufferMemory(
                return_messages=True, memory_key="chat_history"
            )
        return self.session_memories[session_id]

    def clear_session_memory(self, session_id: int):
        """Clear memory for a session"""
        if session_id in self.session_memories:
            del self.session_memories[session_id]

    def load_session_history(
        self, session_id: int, db: Session
    ) -> ConversationBufferMemory:
        """Load conversation history into memory for a session"""
        memory = self.get_session_memory(session_id)

        messages = message_crud.get_by_session(db, session_id=session_id)

        memory.clear()

        for msg in messages:
            memory.chat_memory.add_user_message(msg.content)
            memory.chat_memory.add_ai_message(msg.response)

        return memory

    async def _optimize_search_query(
        self, message: str, chat_history: List[Any], llm: Any
    ) -> str:
        """Optimize the user's message into a search-engine friendly query."""
        opt_prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "You are a search expert. Convert the user's request into a single, concise, and highly effective search engine query. "
                    "If there is relevant conversation history, use it to make the query more specific. "
                    "Output ONLY the optimized query string, no quotes or explanation.",
                ),
                MessagesPlaceholder(variable_name="chat_history"),
                ("human", "{input}"),
            ]
        )
        chain = opt_prompt | llm | StrOutputParser()
        optimized_query = await chain.ainvoke(
            {"input": message, "chat_history": chat_history}
        )
        return optimized_query.strip().strip('"')

    async def get_relevant_memories(
        self, query: str, user_id: int, db: Session, llm: Any
    ) -> str:
        """Retrieve and filter relevant memories for the current query."""
        from app.crud.memory import memory as memory_crud

        # 1. Fetch all memories for the user
        memories = memory_crud.get_by_user(db, user_id=user_id, limit=100)
        if not memories:
            return ""

        # 2. Optimization: If few memories, provide them all directly to save an LLM call latency
        memory_list = [f"- {m.content}" for m in memories]
        if len(memories) <= 5:
            return "\n\n### User Context (Memories)\n" + "\n".join(memory_list)

        # 3. If many memories, use LLM to filter them
        memory_text = "\n".join(memory_list)

        filter_prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "You are a context manager. Given a list of user memories and a new user query, select only the memories that are relevant to answering the query. "
                    "If none are relevant, output 'NONE'. "
                    "Output the selected memories exactly as they appear in the list, one per line. "
                    "Memories:\n{memories}",
                ),
                ("human", "{query}"),
            ]
        )

        chain = filter_prompt | llm | StrOutputParser()
        try:
            filtered_memories = await chain.ainvoke(
                {"memories": memory_text, "query": query}
            )
            if filtered_memories.strip() == "NONE":
                return ""
            return f"\n\n### User Context (Memories)\n{filtered_memories}"
        except Exception as e:
            logging.error(f"Error filtering memories: {e}")
            return "\n\n### User Context (Memories)\n" + "\n".join(memory_list[:5])

    async def extract_and_save_memories(
        self,
        message: str,
        user_id: int,
        model_name: str = "gemini-2.5-flash",
    ):
        """Extract permanent facts from a user message and save them to memory."""
        from app.crud.memory import memory as memory_crud
        from app.schemas.memory import MemoryCreate
        from app.database import SessionLocal

        llm = self.get_llm(model_name)
        if not llm:
            return

        extract_prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "You are a memory assistant. Extract any new, permanent facts about the user from the message. "
                    "Focus on facts like identity, location, job, family, pets, and strong preferences. "
                    "Ignore temporary feelings, questions, or greetings. "
                    "Output each fact as a simple, standalone sentence. If no new facts found, output 'NONE'.",
                ),
                ("human", "{message}"),
            ]
        )

        chain = extract_prompt | llm | StrOutputParser()
        try:
            result = await chain.ainvoke({"message": message})
            if result.strip() == "NONE":
                return

            facts = [f.strip("- ").strip() for f in result.split("\n") if f.strip()]

            with SessionLocal() as db:
                # Get existing memories to avoid duplicates
                existing_memories = memory_crud.get_by_user(
                    db, user_id=user_id, limit=100
                )
                existing_contents = [m.content.lower() for m in existing_memories]

                for fact in facts:
                    if fact.lower() not in existing_contents and fact != "NONE":
                        memory_crud.create_with_user(
                            db, obj_in=MemoryCreate(content=fact), user_id=user_id
                        )
                        logging.info(f"Saved new memory for user {user_id}: {fact}")

        except Exception as e:
            logging.error(f"Error extracting memories: {e}")

    async def simple_chat(
        self,
        message: str,
        model_name: str,
        user_id: Optional[int] = None,
        db: Optional[Session] = None,
        session_id: Optional[int] = None,
        search_web: bool = False,
    ) -> AsyncGenerator[str, None]:
        sanitized_message = sanitize_user_input(message)

        llm = self.get_llm(model_name, user_id, db, streaming=True)
        if not llm:
            available_models = ", ".join(self.get_available_models(user_id, db))
            raise ValueError(
                f"Invalid model '{model_name}' or API key not available. Available models: {available_models}"
            )

        cached_response = None
        if user_id:
            if session_id:
                pass
            else:
                cache_key = f"{sanitized_message}:search:{search_web}"
                cached_response = cache_manager.get_llm_response(
                    user_id, cache_key, model_name
                )

        if cached_response:
            logging.info(f"Cache hit for user {user_id}")
            for chunk in cached_response:
                yield chunk
                await asyncio.sleep(0.01)
            return

        full_response = ""
        chat_history = []
        if session_id and db:
            memory = self.load_session_history(session_id, db)
            chat_history = memory.chat_memory.messages

        # Get custom instructions
        custom_instructions = ""
        if user_id and db:
            from app.crud.user import user as user_crud

            db_user = user_crud.get(db, id=user_id)
            if db_user and db_user.custom_instructions:
                custom_instructions = (
                    f"\n\n### User Custom Instructions\n{db_user.custom_instructions}"
                )

        # Get relevant memories
        relevant_memories = ""
        if user_id and db:
            relevant_memories = await self.get_relevant_memories(
                sanitized_message, user_id, db, llm
            )

        if search_web:
            try:
                logging.info(f"Performing web search for: {sanitized_message[:50]}...")

                optimized_query = await self._optimize_search_query(
                    sanitized_message, chat_history, llm
                )
                logging.info(f"Optimized query: {optimized_query}")
                search_results = web_search_service.search(optimized_query)

                system_prompt = (
                    f"You are a sophisticated AI assistant with real-time web access.\n\n"
                    f"{GENERATIVE_UI_INSTRUCTION}\n\n"
                    "Citations: When using information from search results, cite them clearly using [Source Name/Number].\n"
                    "Tone: Professional, helpful, and concise.\n"
                    "Formatting: Use rich markdown. If multiple search results are relevant, you may use 'search_results' or 'news_card' UI components where appropriate, alongside your textual response."
                    f"{custom_instructions}"
                    f"{relevant_memories}"
                )

                prompt = ChatPromptTemplate.from_messages(
                    [
                        ("system", system_prompt),
                        MessagesPlaceholder(variable_name="chat_history"),
                        (
                            "human",
                            "Current Search Results:\n{search_results}\n\nUser Question: {input}",
                        ),
                    ]
                )

                chain = prompt | llm | StrOutputParser()

                async for chunk in chain.astream(
                    {
                        "input": sanitized_message,
                        "chat_history": chat_history,
                        "search_results": search_results,
                    }
                ):
                    full_response += chunk
                    yield chunk

            except Exception as e:
                logging.error(
                    f"Web search flow failed: {e}. Falling back to standard chat."
                )
                search_web = False
        if not search_web or (not full_response and not search_web):
            system_prompt = (
                f"You are a helpful AI assistant.\n\n{GENERATIVE_UI_INSTRUCTION}"
                f"{custom_instructions}"
                f"{relevant_memories}"
            )

            prompt = ChatPromptTemplate.from_messages(
                [
                    ("system", system_prompt),
                    MessagesPlaceholder(variable_name="chat_history"),
                    ("human", "{input}"),
                ]
            )
            chain = prompt | llm | StrOutputParser()

            async for chunk in chain.astream(
                {"input": sanitized_message, "chat_history": chat_history}
            ):
                full_response += chunk
                yield chunk

        if full_response:
            if session_id:
                memory = self.get_session_memory(session_id)
                memory.chat_memory.add_user_message(sanitized_message)
                memory.chat_memory.add_ai_message(full_response)

            if user_id and not session_id:
                cache_key = f"{sanitized_message}:search:{search_web}"
                cache_manager.set_llm_response(
                    user_id, cache_key, model_name, full_response
                )

    async def agent_chat(
        self,
        message: str,
        model_name: str,
        user_id: Optional[int] = None,
        db: Optional[Session] = None,
        session_id: Optional[int] = None,
    ) -> str:
        # Sanitize user input to prevent prompt injection
        sanitized_message = sanitize_user_input(message)

        try:
            mcp_config = (
                self.get_user_mcp_config(user_id, db)
                if user_id and db
                else {"mcpServers": {}}
            )
            if not mcp_config["mcpServers"]:
                raise ValueError("No MCP servers configured for user.")

            user_mcp_client = MCPClient.from_dict(mcp_config)

            llm = self.get_llm(model_name, user_id, db)
            if not llm:
                available_models = ", ".join(self.get_available_models(user_id, db))
                raise ValueError(
                    f"Invalid model '{model_name}' or API key not available. Available models: {available_models}"
                )

            # Get custom instructions
            custom_instructions = ""
            if user_id and db:
                from app.crud.user import user as user_crud

                db_user = user_crud.get(db, id=user_id)
                if db_user and db_user.custom_instructions:
                    custom_instructions = (
                        f"USER CUSTOM INSTRUCTIONS:\n{db_user.custom_instructions}\n\n"
                    )

            # Get relevant memories
            relevant_memories = ""
            if user_id and db:
                relevant_memories = await self.get_relevant_memories(
                    sanitized_message, user_id, db, llm
                )

            cached_response = None
            if user_id and not session_id:
                cached_response = cache_manager.get_llm_response(
                    user_id, sanitized_message, model_name
                )

            if cached_response:
                logging.info(
                    f"Cache hit for agent chat user {user_id} with message: {sanitized_message[:50]}..."
                )
                return cached_response

            if session_id:
                memory = self.load_session_history(session_id, db)
                agent = MCPAgent(llm=llm, client=user_mcp_client, max_steps=50)
                history_str = "\n".join(
                    [
                        f"{'Human' if m.type == 'human' else 'AI'}: {m.content}"
                        for m in memory.chat_memory.messages
                    ]
                )
                full_input = f"{custom_instructions}{relevant_memories}\n\nPrevious conversation context:\n{history_str}\n\nCurrent message: {message}"
                response = await agent.run(full_input)

            else:
                logging.info(
                    "session_id not provided, using default agent prompt without memory"
                )
                agent = MCPAgent(llm=llm, client=user_mcp_client, max_steps=50)
                full_input = f"{custom_instructions}{relevant_memories}\n\nCurrent message: {sanitized_message}"
                response = await agent.run(full_input)

            if user_id and not session_id:
                cache_manager.set_llm_response(
                    user_id, sanitized_message, model_name, response
                )

            return response
        except Exception as e:
            logging.error(f"Error in agent chat: {e}")
            return "Error in agent chat: " + str(e)

    async def agent_chat_stream(
        self,
        message: str,
        model_name: str,
        user_id: Optional[int] = None,
        db: Optional[Session] = None,
        session_id: Optional[int] = None,
    ) -> AsyncGenerator[str, None]:
        # Define callback handler locally or use a helper class
        from langchain_core.callbacks import AsyncCallbackHandler

        class AgentStreamingCallbackHandler(AsyncCallbackHandler):
            def __init__(self, queue: asyncio.Queue):
                self.queue = queue

            async def on_tool_start(
                self,
                serialized: Dict[str, Any],
                input_str: str,
                **kwargs: Any,
            ) -> None:
                event = {
                    "type": "tool_start",
                    "tool": serialized.get("name"),
                    "input": input_str,
                }
                await self.queue.put(json.dumps(event))

            async def on_tool_end(self, output: str, **kwargs: Any) -> None:
                event = {"type": "tool_end", "output": output}
                await self.queue.put(json.dumps(event))

            async def on_llm_new_token(self, token: str, **kwargs: Any) -> None:
                event = {"type": "content", "content": token}
                await self.queue.put(json.dumps(event))

        sanitized_message = sanitize_user_input(message)

        try:
            mcp_config = (
                self.get_user_mcp_config(user_id, db)
                if user_id and db
                else {"mcpServers": {}}
            )
            if not mcp_config["mcpServers"]:
                yield json.dumps(
                    {"type": "error", "content": "No MCP servers configured for user."}
                )
                return

            user_mcp_client = MCPClient.from_dict(mcp_config)

            # Use streaming=True
            llm = self.get_llm(model_name, user_id, db, streaming=True)
            if not llm:
                available_models = ", ".join(self.get_available_models(user_id, db))
                yield json.dumps(
                    {
                        "type": "error",
                        "content": f"Invalid model '{model_name}'. Available: {available_models}",
                    }
                )
                return

            # Get custom instructions
            custom_instructions = ""
            if user_id and db:
                from app.crud.user import user as user_crud

                db_user = user_crud.get(db, id=user_id)
                if db_user and db_user.custom_instructions:
                    custom_instructions = (
                        f"USER CUSTOM INSTRUCTIONS:\n{db_user.custom_instructions}\n\n"
                    )

            # Get relevant memories
            relevant_memories = ""
            if user_id and db:
                relevant_memories = await self.get_relevant_memories(
                    sanitized_message, user_id, db, llm
                )

            # Check cache
            cached_response = None
            if user_id and not session_id:
                cached_response = cache_manager.get_llm_response(
                    user_id, sanitized_message, model_name
                )

            if cached_response:
                yield json.dumps({"type": "content", "content": cached_response})
                return

            queue = asyncio.Queue()
            handler = AgentStreamingCallbackHandler(queue)

            # Initialize agent with callback
            if session_id:
                memory = self.load_session_history(session_id, db)
                agent = MCPAgent(
                    llm=llm, client=user_mcp_client, max_steps=50, callbacks=[handler]
                )
                history_str = "\n".join(
                    [
                        f"{'Human' if m.type == 'human' else 'AI'}: {m.content}"
                        for m in memory.chat_memory.messages
                    ]
                )
                full_input = f"{custom_instructions}{relevant_memories}\n\nPrevious conversation context:\n{history_str}\n\nCurrent message: {message}"
                input_arg = full_input
            else:
                agent = MCPAgent(
                    llm=llm, client=user_mcp_client, max_steps=50, callbacks=[handler]
                )
                input_arg = f"{custom_instructions}{relevant_memories}\n\nCurrent message: {sanitized_message}"

            # Run agent in background
            task = asyncio.create_task(agent.run(input_arg))

            full_response = ""

            # Loop until task is done OR queue is empty
            while not task.done() or not queue.empty():
                try:
                    try:
                        item = await asyncio.wait_for(queue.get(), timeout=0.1)
                        yield item

                        try:
                            data = json.loads(item)
                            if data.get("type") == "content":
                                full_response += data.get("content", "")
                        except (json.JSONDecodeError, KeyError):
                            pass

                    except asyncio.TimeoutError:
                        continue

                except Exception as e:
                    logging.error(f"Error in stream loop: {e}")
                    break

            if task.done() and task.exception():
                e = task.exception()
                logging.error(f"Agent task failed: {e}")
                yield json.dumps({"type": "error", "content": str(e)})

            if full_response:
                if session_id:
                    memory = self.get_session_memory(session_id)
                    memory.chat_memory.add_user_message(sanitized_message)
                    memory.chat_memory.add_ai_message(full_response)

                if user_id and not session_id:
                    cache_manager.set_llm_response(
                        user_id, sanitized_message, model_name, full_response
                    )

        except Exception as e:
            logging.error(f"Error in agent chat stream: {e}")
            yield json.dumps({"type": "error", "content": str(e)})

    async def compare_models(
        self,
        message: str,
        user_id: Optional[int] = None,
        db: Optional[Session] = None,
        search_web: bool = False,
    ) -> Dict[str, str]:
        """Compare responses from all available models for the same input"""
        results = {}

        available_models = self.get_available_models(user_id, db)

        tasks = []
        for model_name in available_models:
            task = asyncio.create_task(
                self._collect_model_response(
                    message, model_name, user_id, db, search_web
                )
            )
            tasks.append((model_name, task))

        for model_name, task in tasks:
            try:
                response = await task
                results[model_name] = response
            except Exception as e:
                results[model_name] = f"Error: {str(e)}"

        return results

    async def _collect_model_response(
        self,
        message: str,
        model_name: str,
        user_id: Optional[int] = None,
        db: Optional[Session] = None,
        search_web: bool = False,
    ) -> str:
        """Helper method to collect the full response from an async generator"""
        full_response = ""
        # Sanitize the message before processing
        sanitized_message = sanitize_user_input(message)
        async for chunk in self.simple_chat(
            sanitized_message, model_name, user_id, db, search_web=search_web
        ):
            full_response += chunk
        return full_response

    def transcribe_audio(
        self,
        audio_file: bytes,
        filename: str = "audio.wav",
        api_key: Optional[str] = None,
        user_id: Optional[int] = None,
        db: Optional[Session] = None,
    ) -> str:
        """
        Transcribe audio using Groq's Whisper model.

        Args:
            audio_file: Audio file content as bytes
            filename: Name of the audio file
            api_key: Groq API key (optional, will use user's saved key if not provided)
            user_id: User ID to fetch API key for
            db: Database session to fetch API key

        Returns:
            Transcribed text
        """
        if not api_key and user_id and db:
            api_key = self.get_provider_key("Groq", user_id, db)

        if not api_key:
            raise ValueError(
                "Groq API key not found. Please add your API key in settings."
            )

        try:
            client = groq.Groq(api_key=api_key)

            # Create a temporary file-like object from the audio bytes
            audio_io = BytesIO(audio_file)
            audio_io.name = filename

            response = client.audio.transcriptions.create(
                file=audio_io,
                model="whisper-large-v3",
                language="en",
            )

            return response.text
        except Exception as e:
            logging.error(f"Error transcribing audio: {e}")
            raise ValueError(f"Transcription failed: {str(e)}")


ai_service = profile_ai_service(AIChatService)()
