import os
import asyncio
import logging
import re
from dotenv import load_dotenv
from app.core.config import settings
from app.core.generative_ui import GENERATIVE_UI_INSTRUCTION
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain.memory import ConversationBufferMemory
from mcp_use import MCPClient, MCPAgent
from typing import Dict, Any, Optional, AsyncGenerator
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_cerebras import ChatCerebras
from langchain_groq import ChatGroq
from app.core.config import mcp_path
from app.core.ai_profiler import profile_ai_service
from app.core.cache import cache_manager
from app.core.security import decrypt_api_key
from app.crud.user import user_api_key, user_mcp_server
from app.crud.message import message as message_crud
from app.services.web_search import web_search_service, SearchType
from sqlalchemy.orm import Session
import json
from langchain.agents import initialize_agent, AgentType
from langchain_community.tools import DuckDuckGoSearchRun

load_dotenv()


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

        return llm_class(
            model=model,
            **{api_key_param: api_key},
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

    async def simple_chat(
        self,
        message: str,
        model_name: str,
        user_id: Optional[int] = None,
        db: Optional[Session] = None,
        session_id: Optional[int] = None,
        search_web: bool = False,
    ) -> AsyncGenerator[str, None]:
        llm = self.get_llm(model_name, user_id, db)
        if not llm:
            available_models = ", ".join(self.get_available_models(user_id, db))
            raise ValueError(
                f"Invalid model '{model_name}' or API key not available. Available models: {available_models}"
            )

        cached_response = None
        if user_id:
            cached_response = cache_manager.get_llm_response(user_id, f"{message}:search:{search_web}", model_name)

        if cached_response:
            print(f"Cache hit for user {user_id} with message: {message[:50]}...")
            for chunk in cached_response:
                yield chunk
                await asyncio.sleep(0.01)
            return

        full_response = ""

        if search_web:
            try:
                logging.info("using web search")
                search_tool = web_search_service.get_tool()
                agent = initialize_agent(
                    tools=[search_tool],
                    llm=llm,
                    agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
                    verbose=True,
                    handle_parsing_errors=True
                )
                
                response = await agent.arun(message)
                full_response = response
                yield response

            except Exception as e:
                logging.error(f"Agent search failed: {e}. Falling back to standard chat.")
                yield f"Error performing search: {str(e)}"
                return

        else:
            system_prompt = f"You are a helpful AI assistant.\n\n{GENERATIVE_UI_INSTRUCTION}"
            
            if session_id:
                memory = self.load_session_history(session_id, db)
                prompt = ChatPromptTemplate.from_messages(
                    [
                        ("system", system_prompt),
                        MessagesPlaceholder(variable_name="chat_history"),
                        ("human", "{input}"),
                    ]
                )
                chain = prompt | llm | StrOutputParser()
                async for chunk in chain.astream(
                    {
                        "input": message,
                        "chat_history": memory.chat_memory.messages
                    }
                ):
                    full_response += chunk
                    yield chunk
            else:
                prompt = ChatPromptTemplate.from_messages(
                    [
                        ("system", system_prompt),
                        ("human", "{input}"),
                    ]
                )
                chain = prompt | llm | StrOutputParser()
                async for chunk in chain.astream({"input": message}):
                    full_response += chunk
                    yield chunk

        if full_response:
            if session_id:
                memory = self.get_session_memory(session_id)
                memory.chat_memory.add_user_message(message)
                memory.chat_memory.add_ai_message(full_response)

            if user_id:
                cache_manager.set_llm_response(user_id, f"{message}:search:{search_web}", model_name, full_response)

    async def agent_chat(
        self,
        message: str,
        model_name: str,
        user_id: Optional[int] = None,
        db: Optional[Session] = None,
        session_id: Optional[int] = None,
    ) -> str:
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

            cached_response = None
            if user_id:
                cached_response = cache_manager.get_llm_response(
                    user_id, message, model_name
                )

            if cached_response:
                print(
                    f"Cache hit for agent chat user {user_id} with message: {message[:50]}..."
                )
                return cached_response

            if session_id:
                memory = self.load_session_history(session_id, db)
                agent = MCPAgent(llm=llm, client=user_mcp_client, max_steps=50)
                history_str = "\n".join(
                    [str(m.content) for m in memory.chat_memory.messages]
                )
                full_input = f"Previous conversation context:\\n{history_str}\\n\\nCurrent message: {message}"
                response = await agent.run(full_input)

            else:
                logging.info(
                    "session_id not provided, using default agent prompt without memory"
                )
                agent = MCPAgent(llm=llm, client=user_mcp_client, max_steps=50)
                response = await agent.run(message)

            if user_id:
                cache_manager.set_llm_response(user_id, message, model_name, response)

            return response
        except Exception as e:
            print(f"Error in agent chat: {e}")
            return "Error in agent chat: " + str(e)

    async def compare_models(
        self, message: str, user_id: Optional[int] = None, db: Optional[Session] = None, search_web: bool = False
    ) -> Dict[str, str]:
        """Compare responses from all available models for the same input"""
        results = {}

        available_models = self.get_available_models(user_id, db)

        tasks = []
        for model_name in available_models:
            task = asyncio.create_task(
                self._collect_model_response(message, model_name, user_id, db, search_web)
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
        async for chunk in self.simple_chat(message, model_name, user_id, db, search_web=search_web):
            full_response += chunk
        return full_response


ai_service = profile_ai_service(AIChatService)()