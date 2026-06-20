from unittest.mock import MagicMock

from app.services.web_search import WebSearchService


class FakeExaResult:
    """Simulates an Exa result object."""

    def __init__(self, title, url, published_date, text=None):
        self.title = title
        self.url = url
        self.published_date = published_date
        self.text = text
        self.image = None


class FakeExaResponse:
    """Simulates an Exa search response."""

    def __init__(self, results):
        self.results = results


def test_search_with_metadata_formats_results():
    service = WebSearchService(api_key="test-key")
    service.client = MagicMock()
    service.client.search.return_value = FakeExaResponse(
        results=[
            FakeExaResult(
                title="Event happened",
                url="https://example.com/event",
                published_date="2026-02-10",
                text="Confirmed by source",
            )
        ]
    )

    result = service.search_with_metadata("did event happen")

    assert result["had_results"] is True
    assert result["status"] == "ok"
    assert "WEB SEARCH RESULTS" in result["formatted_results"]
    assert "Event happened" in result["formatted_results"]
    assert "https://example.com/event" in result["formatted_results"]


def test_search_with_metadata_returns_no_results_status_on_errors():
    service = WebSearchService(api_key="test-key")
    service.client = MagicMock()
    service.client.search.side_effect = RuntimeError("provider down")

    result = service.search_with_metadata("failing query")

    assert result["had_results"] is False
    assert result["status"] == "no_results"
    assert "No reliable search results were retrieved" in result["formatted_results"]
    assert service.client.search.call_count == 1


def test_search_with_metadata_skips_provider_without_api_key():
    service = WebSearchService(api_key="")
    service.client = MagicMock()

    result = service.search_with_metadata("latest news")

    assert result["had_results"] is False
    assert result["status"] == "no_results"
    assert "EXA_API_KEY is not configured" in result["formatted_results"]
    service.client.search.assert_not_called()


def test_search_with_metadata_deduplicates_across_sources_and_variants():
    service = WebSearchService(api_key="test-key")
    service.client = MagicMock()
    service.client.search.return_value = FakeExaResponse(
        results=[
            FakeExaResult(
                title="Samsung tri-fold launched",
                url="https://example.com/samsung-trifold",
                published_date="2026-02-12",
                text="Launch confirmed",
            )
        ]
    )

    result = service.search_with_metadata("samsung tri-fold phone launch")

    assert result["had_results"] is True
    assert len(result["results"]) == 1


def test_search_many_with_metadata_merges_and_deduplicates():
    service = WebSearchService(api_key="test-key")
    service.client = MagicMock()
    service.client.search.return_value = FakeExaResponse(
        results=[
            FakeExaResult(
                title="Kimi 2.5 released",
                url="https://example.com/kimi-2-5",
                published_date="2026-02-15",
                text="Moonshot announcement",
            )
        ]
    )

    result = service.search_many_with_metadata(
        ["latest kimi release", "moonshot kimi 2.5"]
    )

    assert result["status"] == "ok"
    assert result["had_results"] is True
    assert len(result["results"]) == 1
    assert "WEB SEARCH RESULTS (MERGED)" in result["formatted_results"]
