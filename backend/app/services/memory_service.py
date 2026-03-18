import logging
from typing import Any, List
from sqlalchemy.orm import Session
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from app.crud.memory import memory as memory_crud
from app.schemas.memory import MemoryCreate
from app.database import SessionLocal


class MemoryService:
    async def get_relevant_memories(
        self, query: str, user_id: int, db: Session, llm: Any
    ) -> str:
        """Retrieve and filter relevant memories for the current query."""
        memories = memory_crud.get_by_user(db, user_id=user_id, limit=100)
        if not memories:
            return ""

        memory_list = [f"- {m.content}" for m in memories]
        if len(memories) <= 5:
            return "\n\n### User Context (Memories)\n" + "\n".join(memory_list)

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
        llm: Any,
    ) -> List[str]:
        """Extract permanent facts from a user message and save them to memory."""
        saved_facts = []

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
                return []

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
                        saved_facts.append(fact)
                        logging.info(f"Saved new memory for user {user_id}: {fact}")

            return saved_facts

        except Exception as e:
            logging.error(f"Error extracting memories: {e}")
            return []


memory_service = MemoryService()
