import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from app.services.ai_chat import AIChatService, sanitize_user_input


def test_sanitize_user_input():
    assert sanitize_user_input("  hello  ") == "hello"
    assert sanitize_user_input("hello\x00world") == "helloworld"
    long_input = "a" * 6000
    assert len(sanitize_user_input(long_input)) == 5000
    assert sanitize_user_input(None) is None


@pytest.fixture
def ai_service():
    service = AIChatService()
    return service


def test_get_provider_key(ai_service):
    db = MagicMock()
    user_id = 1
    provider = "Google"

    mock_key_obj = MagicMock()
    mock_key_obj.encrypted_key = "encrypted_key"

    with patch(
        "app.services.ai_chat.user_api_key.get_by_user_and_model"
    ) as mock_get_key:
        mock_get_key.return_value = mock_key_obj
        with patch("app.services.ai_chat.decrypt_api_key") as mock_decrypt:
            mock_decrypt.return_value = "decrypted_key"

            key = ai_service.get_provider_key(provider, user_id, db)
            assert key == "decrypted_key"


def test_get_llm(ai_service):
    db = MagicMock()
    user_id = 1
    model_name = "gemini-2.5-flash"

    with patch.object(ai_service, "get_provider_key", return_value="test_api_key"):
        mock_llm_class = MagicMock()
        ai_service.llm_configs[model_name]["class"] = mock_llm_class

        llm = ai_service.get_llm(model_name, user_id, db)
        assert llm is not None
        mock_llm_class.assert_called_once()


def test_get_session_memory(ai_service):
    session_id = 123
    memory = ai_service.get_session_memory(session_id)
    assert hasattr(memory, "messages")
    assert ai_service.get_session_memory(session_id) is memory


@pytest.mark.asyncio
async def test_simple_chat_skips_cache_for_web_search(ai_service):
    async def mock_astream(*args, **kwargs):
        yield "search response"

    mock_chain = MagicMock()
    mock_chain.astream = MagicMock(side_effect=mock_astream)

    with (
        patch.object(ai_service, "get_llm", return_value=MagicMock()),
        patch.object(
            ai_service,
            "_build_search_queries",
            new_callable=AsyncMock,
            return_value=["test query", "test query latest", "test query 2026"],
        ),
        patch.object(
            ai_service,
            "_should_search_images",
            new_callable=AsyncMock,
            return_value=False,
        ),
        patch(
            "app.services.ai_chat.web_search_service.search_many_with_metadata",
            return_value={
                "status": "ok",
                "had_results": True,
                "formatted_results": "### WEB SEARCH RESULTS\n[1] Title: Example",
                "results": [{"title": "Example"}],
                "errors": [],
                "queries": ["test query", "test query latest", "test query 2026"],
            },
        ),
        patch(
            "app.services.ai_chat.ChatPromptTemplate.from_messages"
        ) as mock_prompt_builder,
    ):
        mock_prompt_builder.return_value.__or__.return_value.__or__.return_value = (
            mock_chain
        )

        responses = []
        async for chunk in ai_service.simple_chat(
            "latest update", "gemini-2.5-flash", user_id=1, search_web=True
        ):
            responses.append(chunk)

        assert "".join(responses) == "search response"


@pytest.mark.asyncio
async def test_build_search_queries_has_generic_fallback_variants(ai_service):
    llm = MagicMock()

    with patch("app.services.ai_chat.ChatPromptTemplate.from_messages") as mock_prompt:
        mock_chain = AsyncMock()
        mock_chain.ainvoke.side_effect = Exception("LLM failed")
        mock_prompt.return_value.__or__.return_value.__or__.return_value = mock_chain

        queries = await ai_service._build_search_queries(
            message="compare latest model releases across providers",
            chat_history=[],
            llm=llm,
            max_queries=3,
        )

    assert len(queries) <= 3
    assert any("compare latest model releases across providers" in q for q in queries)
    assert any(q.endswith(" latest") for q in queries)
    assert any("2026" in q for q in queries)


@pytest.mark.asyncio
async def test_get_relevant_memories_small(ai_service):
    db = MagicMock()
    user_id = 1
    llm = MagicMock()

    with patch("app.crud.memory.memory.get_by_user") as mock_get_by_user:
        mock_mem = MagicMock()
        mock_mem.content = "I like apples"
        mock_get_by_user.return_value = [mock_mem]

        result = await ai_service.get_relevant_memories("query", user_id, db, llm)
        assert "I like apples" in result


@pytest.mark.asyncio
async def test_get_relevant_memories_large(ai_service):
    db = MagicMock()
    user_id = 1
    llm = AsyncMock()

    memories = [MagicMock(content=f"Fact {i}") for i in range(6)]

    with patch("app.crud.memory.memory.get_by_user", return_value=memories):
        with patch(
            "app.services.ai_chat.ChatPromptTemplate.from_messages"
        ) as mock_prompt:
            mock_chain = AsyncMock()
            mock_chain.ainvoke.return_value = "Fact 1\nFact 2"
            mock_prompt.return_value.__or__.return_value.__or__.return_value = (
                mock_chain
            )

            result = await ai_service.get_relevant_memories("query", user_id, db, llm)
            assert "Fact 1" in result
            assert "Fact 2" in result
            assert "Fact 0" not in result
