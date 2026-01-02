import os
import asyncio
import logging
import re
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

        self.llm_configs = {
            "gemini-2.5-flash": {
                "class": ChatGoogleGenerativeAI,
                "model": "gemini-2.5-flash",
                "key_env": "GOOGLE_API_KEY",
            },
            "qwen-3-235b-a22b-instruct-2507": {
                "class": ChatCerebras,
                "model": "qwen-3-235b-a22b-instruct-2507",
                "key_env": "CEREBRAS_API_KEY",
            },
            "qwen-3-235b-a22b-thinking-2507": {
                "class": ChatCerebras,
                "model": "qwen-3-235b-a22b-thinking-2507",
                "key_env": "CEREBRAS_API_KEY",
            },
            "moonshotai/kimi-k2-instruct-0905": {
                "class": ChatGroq,
                "model": "moonshotai/kimi-k2-instruct-0905",
                "key_env": "GROQ_API_KEY",
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
        llm_class = config["class"]
        model = config["model"]

        api_key = None
        if user_id and db:
            user_key_obj = user_api_key.get_by_user_and_model(
                db, user_id=user_id, model_name=model_name
            )
            if user_key_obj:
                try:
                    api_key = decrypt_api_key(user_key_obj.encrypted_key)
                except Exception as e:
                    logging.error(
                        f"Error decrypting API key for user {user_id}, model {model_name}: {e}"
                    )
                    return None

        if not api_key:
            api_key = os.getenv(config["key_env"])

        if not api_key:
            return None

        if llm_class == ChatGoogleGenerativeAI:
            api_key_param = "google_api_key"
        else:
            api_key_param = f"{llm_class.__name__.lower().replace('chat', '')}_api_key"

        # Some classes might not accept streaming kwarg directly in init if strictly typed, but most LangChain Chat models do or accept **kwargs
        kwargs = {api_key_param: api_key}
        if streaming:
            kwargs["streaming"] = True

        return llm_class(
            model=model,
            **kwargs,
        )

    def get_available_models(
        self, user_id: Optional[int] = None, db: Optional[Session] = None
    ):
        available = []
        for model_name in self.llm_configs:
            if self.get_llm(model_name, user_id, db):
                available.append(model_name)
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
                full_input = f"{custom_instructions}Previous conversation context:\n{history_str}\n\nCurrent message: {message}"
                response = await agent.run(full_input)

            else:
                logging.info(
                    "session_id not provided, using default agent prompt without memory"
                )
                agent = MCPAgent(llm=llm, client=user_mcp_client, max_steps=50)
                full_input = f"{custom_instructions}Current message: {sanitized_message}"
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
                self, serialized: Dict[str, Any], input_str: str, **kwargs: Any
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
                full_input = f"{custom_instructions}Previous conversation context:\n{history_str}\n\nCurrent message: {message}"
                input_arg = full_input
            else:
                agent = MCPAgent(
                    llm=llm, client=user_mcp_client, max_steps=50, callbacks=[handler]
                )
                input_arg = f"{custom_instructions}Current message: {sanitized_message}"

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
                        except:
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


ai_service = profile_ai_service(AIChatService)()
