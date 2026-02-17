"""
Web Search Service Module
Provides access to DuckDuckGo search tool for LangChain agents.
"""

from datetime import datetime
from typing import Any, Dict, List

from langchain_community.tools import DuckDuckGoSearchResults
import logging
from langchain_community.utilities import DuckDuckGoSearchAPIWrapper

# Configure logging
logger = logging.getLogger(__name__)


class WebSearchService:
    """
    Improved web search service using DuckDuckGo tools.
    """

    def __init__(self):
        self.search_tool = DuckDuckGoSearchResults()
        self.search_wrapper = DuckDuckGoSearchAPIWrapper()
        self.image_search_wrapper = DuckDuckGoSearchAPIWrapper()
        logger.info("WebSearchService initialized with DuckDuckGo tools")

    def get_tool(self):
        """Get the search tool for agent use."""
        return self.search_tool

    def _normalize_result(self, item: Dict[str, Any]) -> Dict[str, str]:
        """Normalize variable DuckDuckGo result keys to a consistent shape."""
        title = item.get("title") or item.get("heading") or "Untitled"
        snippet = (
            item.get("snippet")
            or item.get("body")
            or item.get("description")
            or "No snippet available."
        )
        link = item.get("link") or item.get("href") or item.get("url") or ""
        date = item.get("date") or item.get("published") or item.get("published_at") or ""

        return {
            "title": str(title).strip(),
            "snippet": str(snippet).strip(),
            "link": str(link).strip(),
            "date": str(date).strip(),
        }

    def search_with_metadata(
        self, query: str, max_results: int = 8, retries: int = 2
    ) -> Dict[str, Any]:
        """Run resilient text search and return both metadata and formatted context."""
        errors: List[str] = []
        normalized_results: List[Dict[str, str]] = []

        current_year = datetime.now().year
        variant_queries = [
            query,
            f"{query} latest updates",
            f"{query} {current_year}",
        ]

        # Expand coverage for time-sensitive/event queries by searching both news + text.
        seen_keys = set()
        deduped_results: List[Dict[str, str]] = []
        sources = ("text", "news")

        for attempt_query in variant_queries[: retries + 1]:
            for source in sources:
                try:
                    raw_results = self.search_wrapper.results(
                        attempt_query, max_results, source=source
                    )
                    candidate_results = [
                        self._normalize_result(r) for r in (raw_results or [])
                    ]

                    candidate_results = [
                        r
                        for r in candidate_results
                        if r["title"] != "Untitled"
                        or r["snippet"] != "No snippet available."
                    ]

                    for result in candidate_results:
                        dedup_key = (
                            result["link"].strip().lower()
                            or f"{result['title'].strip().lower()}::{result['snippet'][:120].strip().lower()}"
                        )
                        if dedup_key in seen_keys:
                            continue
                        seen_keys.add(dedup_key)
                        deduped_results.append(result)
                except Exception as e:
                    error_msg = f"{type(e).__name__}: {e}"
                    if "No results found" in str(e):
                        logger.info(
                            f"No results for query '{attempt_query}' (source={source})"
                        )
                        continue
                    errors.append(error_msg)
                    logger.warning(
                        f"Search attempt failed for query '{attempt_query}' (source={source}): {error_msg}"
                    )

        # Prefer dated entries first; then keep the rest.
        with_date = [r for r in deduped_results if r["date"]]
        without_date = [r for r in deduped_results if not r["date"]]
        normalized_results = with_date + without_date

        had_results = len(normalized_results) > 0

        if had_results:
            lines = ["### WEB SEARCH RESULTS"]
            for idx, result in enumerate(normalized_results, start=1):
                lines.append(f"[{idx}] Title: {result['title']}")
                if result["date"]:
                    lines.append(f"Date: {result['date']}")
                lines.append(f"Snippet: {result['snippet']}")
                if result["link"]:
                    lines.append(f"URL: {result['link']}")
                lines.append("")
            formatted = "\n".join(lines).strip()
            status = "ok"
        else:
            error_text = "; ".join(errors) if errors else "No results returned by provider."
            formatted = (
                "### WEB SEARCH RESULTS\n"
                "No reliable search results were retrieved for this query.\n"
                f"Search diagnostics: {error_text}"
            )
            status = "no_results"

        return {
            "status": status,
            "had_results": had_results,
            "query": query,
            "results": normalized_results,
            "formatted_results": formatted,
            "errors": errors,
        }

    def search_many_with_metadata(
        self, queries: List[str], max_results: int = 6, retries: int = 1
    ) -> Dict[str, Any]:
        """Run multiple searches and return a deduplicated merged payload."""
        cleaned_queries = [q.strip() for q in (queries or []) if q and q.strip()]
        if not cleaned_queries:
            return self.search_with_metadata("", max_results=max_results, retries=retries)

        merged_results: List[Dict[str, str]] = []
        merged_errors: List[str] = []
        seen_keys = set()

        for q in cleaned_queries:
            payload = self.search_with_metadata(q, max_results=max_results, retries=retries)
            for error in payload.get("errors", []):
                merged_errors.append(f"{q}: {error}")

            for result in payload.get("results", []):
                enriched = dict(result)
                enriched["query"] = q
                dedup_key = (
                    enriched.get("link", "").strip().lower()
                    or f"{enriched.get('title', '').strip().lower()}::{enriched.get('snippet', '')[:120].strip().lower()}"
                )
                if dedup_key in seen_keys:
                    continue
                seen_keys.add(dedup_key)
                merged_results.append(enriched)

        with_date = [r for r in merged_results if r.get("date")]
        without_date = [r for r in merged_results if not r.get("date")]
        merged_results = with_date + without_date

        had_results = len(merged_results) > 0
        if had_results:
            lines = ["### WEB SEARCH RESULTS (MERGED)"]
            for idx, result in enumerate(merged_results, start=1):
                lines.append(f"[{idx}] Title: {result.get('title', 'Untitled')}")
                if result.get("date"):
                    lines.append(f"Date: {result['date']}")
                lines.append(f"Matched Query: {result.get('query', '')}")
                lines.append(f"Snippet: {result.get('snippet', 'No snippet available.')}")
                if result.get("link"):
                    lines.append(f"URL: {result['link']}")
                lines.append("")
            formatted = "\n".join(lines).strip()
            status = "ok"
        else:
            error_text = "; ".join(merged_errors) if merged_errors else "No results returned by provider."
            formatted = (
                "### WEB SEARCH RESULTS\n"
                "No reliable search results were retrieved for this query set.\n"
                f"Search diagnostics: {error_text}"
            )
            status = "no_results"

        return {
            "status": status,
            "had_results": had_results,
            "queries": cleaned_queries,
            "results": merged_results,
            "formatted_results": formatted,
            "errors": merged_errors,
        }

    def search(self, query: str) -> str:
        """Backward-compatible search API returning formatted string context."""
        return self.search_with_metadata(query)["formatted_results"]

    def search_images(self, query: str, max_results: int = 10) -> list:
        """Run image search and return a list of normalized image objects."""
        try:
            # DuckDuckGoSearchAPIWrapper.results supports source="images"
            raw_results = self.image_search_wrapper.results(query, max_results, source="images")
            
            # Normalize results to match the ImageData schema
            normalized_results = []
            for res in raw_results:
                normalized_results.append({
                    "src": res.get("image") or res.get("thumbnail"),
                    "thumbnail": res.get("thumbnail") or res.get("image"),
                    "alt": res.get("title", "Search image"),
                    "title": res.get("title"),
                    "source": res.get("source"),
                    "url": res.get("url")
                })
            return normalized_results
        except Exception as e:
            logger.error(f"Image search failed: {e}")
            return []


web_search_service = WebSearchService()
