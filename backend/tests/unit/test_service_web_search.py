from unittest.mock import MagicMock

from app.services.web_search import WebSearchService


def test_search_with_metadata_formats_results():
    service = WebSearchService()
    service.search_wrapper = MagicMock()
    service.search_wrapper.results.return_value = [
        {
            "title": "Event happened",
            "body": "Confirmed by source",
            "link": "https://example.com/event",
            "date": "2026-02-10",
        }
    ]

    result = service.search_with_metadata("did event happen")

    assert result["had_results"] is True
    assert result["status"] == "ok"
    assert "WEB SEARCH RESULTS" in result["formatted_results"]
    assert "Event happened" in result["formatted_results"]
    assert "https://example.com/event" in result["formatted_results"]


def test_search_with_metadata_returns_no_results_status_on_errors():
    service = WebSearchService()
    service.search_wrapper = MagicMock()
    service.search_wrapper.results.side_effect = RuntimeError("provider down")

    result = service.search_with_metadata("failing query", retries=2)

    assert result["had_results"] is False
    assert result["status"] == "no_results"
    assert "No reliable search results were retrieved" in result["formatted_results"]
    # 3 query variants * 2 sources(news,text)
    assert service.search_wrapper.results.call_count == 6


def test_search_with_metadata_deduplicates_across_sources_and_variants():
    service = WebSearchService()
    service.search_wrapper = MagicMock()
    service.search_wrapper.results.return_value = [
        {
            "title": "Samsung tri-fold launched",
            "body": "Launch confirmed",
            "link": "https://example.com/samsung-trifold",
            "date": "2026-02-12",
        }
    ]

    result = service.search_with_metadata("samsung tri-fold phone launch", retries=2)

    assert result["had_results"] is True
    assert len(result["results"]) == 1


def test_search_many_with_metadata_merges_and_deduplicates():
    service = WebSearchService()
    service.search_wrapper = MagicMock()
    service.search_wrapper.results.return_value = [
        {
            "title": "Kimi 2.5 released",
            "body": "Moonshot announcement",
            "link": "https://example.com/kimi-2-5",
            "date": "2026-02-15",
        }
    ]

    result = service.search_many_with_metadata(
        ["latest kimi release", "moonshot kimi 2.5"]
    )

    assert result["status"] == "ok"
    assert result["had_results"] is True
    assert len(result["results"]) == 1
    assert "WEB SEARCH RESULTS (MERGED)" in result["formatted_results"]
