"""
Web Search Service Module
Provides access to DuckDuckGo search tool for LangChain agents.
"""

from concurrent.futures import ThreadPoolExecutor
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
        self._executor = None
        logger.info("WebSearchService initialized with DuckDuckGo tools")

    def start(self):
        """Start the thread pool executor. Called by FastAPI lifespan."""
        if self._executor is None:
            self._executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="duckduckgo")
            logger.info("WebSearchService thread pool started")

    def shutdown(self):
        """Shutdown the thread pool executor. Called by FastAPI lifespan."""
        if self._executor is not None:
            self._executor.shutdown(wait=True)
            self._executor = None
            logger.info("WebSearchService thread pool shut down")

    @property
    def executor(self):
        """Lazily create executor if accessed before lifespan start (dev fallback)."""
        if self._executor is None:
            self._executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="duckduckgo")
            logger.warning("WebSearchService thread pool lazily initialized — prefer lifespan start()")
        return self._executor

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
        date = (
            item.get("date") or item.get("published") or item.get("published_at") or ""
        )

        return {
            "title": str(title).strip(),
            "snippet": str(snippet).strip(),
            "link": str(link).strip(),
            "date": str(date).strip(),
        }

    def _search_single_query(
        self, query: str, max_results: int
    ) -> Dict[str, Any]:
        """Run single text search and return results with metadata."""
        try:
            raw_results = self.search_wrapper.results(
                query, max_results, source="text"
            )
            candidate_results = [
                self._normalize_result(r) for r in (raw_results or [])
            ]

            # Filter out useless results
            candidate_results = [
                r
                for r in candidate_results
                if r["title"] != "Untitled"
                or r["snippet"] != "No snippet available."
            ]

            return {
                "status": "ok" if candidate_results else "no_results",
                "had_results": len(candidate_results) > 0,
                "query": query,
                "results": candidate_results,
                "errors": [],
            }
        except Exception as e:
            error_msg = f"{type(e).__name__}: {e}"
            if "No results found" in str(e):
                logger.info(f"No results for query '{query}'")
                return {
                    "status": "no_results",
                    "had_results": False,
                    "query": query,
                    "results": [],
                    "errors": [],
                }
            logger.warning(f"Search failed for query '{query}': {error_msg}")
            return {
                "status": "error",
                "had_results": False,
                "query": query,
                "results": [],
                "errors": [error_msg],
            }

    def search_with_metadata(
        self, query: str, max_results: int = 8
    ) -> Dict[str, Any]:
        """Run resilient text search and return both metadata and formatted context."""
        if not query or not query.strip():
            return {
                "status": "no_results",
                "had_results": False,
                "query": "",
                "results": [],
                "formatted_results": "### WEB SEARCH RESULTS\nNo query provided.",
                "errors": ["Empty query"],
            }

        payload = self._search_single_query(query.strip(), max_results)
        normalized_results = payload["results"]

        # Prefer dated entries first; then keep the rest.
        with_date = [r for r in normalized_results if r["date"]]
        without_date = [r for r in normalized_results if not r["date"]]
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
            error_text = (
                "; ".join(payload["errors"]) if payload["errors"] else "No results returned by provider."
            )
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
            "errors": payload["errors"],
        }

    def search_many_with_metadata(
        self, queries: List[str], max_results: int = 6
    ) -> Dict[str, Any]:
        """Run multiple searches in parallel and return a deduplicated merged payload."""
        cleaned_queries = [q.strip() for q in (queries or []) if q and q.strip()]
        if not cleaned_queries:
            return self.search_with_metadata(
                "", max_results=max_results
            )

        # Execute searches in parallel using thread pool
        futures = []
        for q in cleaned_queries:
            future = self.executor.submit(
                self._search_single_query, q, max_results
            )
            futures.append((q, future))

        # Collect results
        merged_results: List[Dict[str, str]] = []
        merged_errors: List[str] = []
        seen_keys = set()

        for q, future in futures:
            try:
                payload = future.result(timeout=12.0)
            except TimeoutError:
                logger.warning(f"Search future timed out for query '{q}' (12s)")
                payload = {
                    "status": "timeout",
                    "had_results": False,
                    "query": q,
                    "results": [],
                    "errors": ["Timed out after 12s"],
                }
            except Exception as e:
                logger.error(f"Search future failed for query '{q}': {e}")
                payload = {
                    "status": "error",
                    "had_results": False,
                    "query": q,
                    "results": [],
                    "errors": [f"{type(e).__name__}: {e}"],
                }

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
                lines.append(
                    f"Snippet: {result.get('snippet', 'No snippet available.')}"
                )
                if result.get("link"):
                    lines.append(f"URL: {result['link']}")
                lines.append("")
            formatted = "\n".join(lines).strip()
            status = "ok"
        else:
            error_text = (
                "; ".join(merged_errors)
                if merged_errors
                else "No results returned by provider."
            )
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
            raw_results = self.image_search_wrapper.results(
                query, max_results, source="images"
            )

            # Normalize results to match the ImageData schema
            normalized_results = []
            for res in raw_results:
                normalized_results.append(
                    {
                        "src": res.get("image") or res.get("thumbnail"),
                        "thumbnail": res.get("thumbnail") or res.get("image"),
                        "alt": res.get("title", "Search image"),
                        "title": res.get("title"),
                        "source": res.get("source"),
                        "url": res.get("url"),
                    }
                )
            return normalized_results
        except Exception as e:
            logger.error(f"Image search failed: {e}")
            return []


web_search_service = WebSearchService()
