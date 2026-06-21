import pytest
from unittest.mock import AsyncMock

from app.services.web_search import WebSearchService


class FakeExaResult:
    """Simulates an Exa result object."""

    def __init__(self, title, url, published_date, text=None, image=None):
        self.title = title
        self.url = url
        self.published_date = published_date
        self.text = text
        self.image = image


class FakeExaResponse:
    """Simulates an Exa search response."""

    def __init__(self, results):
        self.results = results


@pytest.mark.asyncio
async def test_search_formats_results():
    service = WebSearchService(api_key="test-key")
    service._client = AsyncMock()
    service._client.search.return_value = FakeExaResponse(
        results=[
            FakeExaResult(
                title="Event happened",
                url="https://example.com/event",
                published_date="2026-02-10",
                text="Confirmed by source",
            )
        ]
    )

    result = await service.search("did event happen")

    assert result["had_results"] is True
    assert result["status"] == "ok"
    assert "WEB SEARCH RESULTS" in result["formatted_results"]
    assert "Event happened" in result["formatted_results"]
    assert "https://example.com/event" in result["formatted_results"]


@pytest.mark.asyncio
async def test_search_returns_no_results_status_on_errors():
    service = WebSearchService(api_key="test-key")
    service._client = AsyncMock()
    service._client.search.side_effect = RuntimeError("provider down")

    result = await service.search("failing query")

    assert result["had_results"] is False
    assert result["status"] == "no_results"
    assert service._client.search.call_count == 1


@pytest.mark.asyncio
async def test_search_skips_provider_without_api_key():
    service = WebSearchService(api_key="")
    service._client = AsyncMock()

    result = await service.search("latest news")

    assert result["had_results"] is False
    assert result["status"] == "error"
    assert "EXA_API_KEY not configured" in str(result.get("formatted_results", ""))
    service._client.search.assert_not_called()


@pytest.mark.asyncio
async def test_search_returns_single_result_for_single_query():
    service = WebSearchService(api_key="test-key")
    service._client = AsyncMock()
    service._client.search.return_value = FakeExaResponse(
        results=[
            FakeExaResult(
                title="Samsung tri-fold launched",
                url="https://example.com/samsung-trifold",
                published_date="2026-02-12",
                text="Launch confirmed",
            )
        ]
    )

    result = await service.search("samsung tri-fold phone launch")

    assert result["had_results"] is True
    assert len(result["results"]) == 1


@pytest.mark.asyncio
async def test_search_many_with_metadata_merges_and_deduplicates():
    service = WebSearchService(api_key="test-key")
    service._client = AsyncMock()
    service._client.search.return_value = FakeExaResponse(
        results=[
            FakeExaResult(
                title="Kimi 2.5 released",
                url="https://example.com/kimi-2-5",
                published_date="2026-02-15",
                text="Moonshot announcement",
            )
        ]
    )

    result = await service.search_many_with_metadata(
        ["latest kimi release", "moonshot kimi 2.5"]
    )

    assert result["status"] == "ok"
    assert result["had_results"] is True
    assert len(result["results"]) == 1
    assert "WEB SEARCH RESULTS" in result["formatted_results"]


@pytest.mark.asyncio
async def test_search_with_empty_api_key():
    service = WebSearchService(api_key="")
    service._client = AsyncMock()

    result = await service.search("test query")

    assert result["had_results"] is False
    assert result["status"] == "error"
    assert "EXA_API_KEY not configured" in str(result.get("formatted_results", ""))


@pytest.mark.asyncio
async def test_search_with_empty_query():
    service = WebSearchService(api_key="test-key")
    service._client = AsyncMock()

    result = await service.search("")

    assert result["had_results"] is False
    assert result["status"] == "no_results"
    assert "No valid query" in str(result.get("formatted_results", ""))


@pytest.mark.asyncio
async def test_search_uses_highlights_and_extras():
    service = WebSearchService(api_key="test-key")
    service._client = AsyncMock()
    service._client.search.return_value = FakeExaResponse(results=[])

    await service.search("test query", max_results=5)

    service._client.search.assert_called_once_with(
        "test query",
        num_results=5,
        contents={"highlights": {"query": "test query", "max_characters": 500}, "extras": {"image_links": 2}},
    )


@pytest.mark.asyncio
async def test_search_with_metadata_aliases_search():
    service = WebSearchService(api_key="test-key")
    service._client = AsyncMock()
    service._client.search.return_value = FakeExaResponse(results=[])

    result = await service.search_with_metadata("test query")

    assert "formatted_results" in result
    assert "results" in result


@pytest.mark.asyncio
async def test_search_returns_query_in_response():
    service = WebSearchService(api_key="test-key")
    service._client = AsyncMock()
    service._client.search.return_value = FakeExaResponse(results=[])

    result = await service.search("my search query")

    assert result["query"] == "my search query"
