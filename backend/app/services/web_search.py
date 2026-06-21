"""Web search service using Exa API."""

import asyncio
import logging
import os
from typing import Any, Dict, List, Optional

from exa_py import AsyncExa

logger = logging.getLogger(__name__)


class WebSearchService:
    """Web search service using Exa API."""

    def __init__(self, api_key: str | None = None):
        self.api_key = os.getenv("EXA_API_KEY", "") if api_key is None else api_key
        self._client: Optional[AsyncExa] = None

    def start(self):
        """No-op: AsyncExa has no lifecycle management."""

    def shutdown(self):
        """No-op: AsyncExa has no lifecycle management."""

    @property
    def client(self) -> AsyncExa:
        if self._client is None:
            self._client = AsyncExa(api_key=self.api_key)
        return self._client

    def _normalize(self, result) -> Dict[str, str]:
        """Normalize an Exa result to a consistent dict."""
        return {
            "title": (getattr(result, "title", None) or "Untitled").strip(),
            "snippet": (getattr(result, "text", None) or "").strip(),
            "link": (getattr(result, "url", None) or "").strip(),
            "date": (getattr(result, "published_date", None) or "").strip(),
            "image_url": (getattr(result, "image", None) or "").strip(),
        }

    def _fmt(self, results: List[Dict[str, str]]) -> str:
        """Format results into a concise markdown string."""
        if not results:
            return "### WEB SEARCH RESULTS\nNo results found."
        lines = ["### WEB SEARCH RESULTS"]
        for i, r in enumerate(results, 1):
            lines.append(f"[{i}] **{r['title']}**")
            if r.get("date"):
                lines.append(f"    _Date_: {r['date']}")
            lines.append(f"    {r['snippet'][:500]}")
            if r.get("link"):
                lines.append(f"    _URL_: {r['link']}")
            if r.get("image_url"):
                lines.append(f"    _Image_: {r['image_url']}")
        return "\n".join(lines)

    async def search(
        self, query: str, max_results: int = 8
    ) -> Dict[str, Any]:
        """Run a single Exa search and return results with metadata.

        Returns:
            Dict with keys: status, had_results, query, results, formatted_results, errors
        """
        if not self.api_key:
            return {
                "status": "error", "had_results": False,
                "formatted_results": "### WEB SEARCH RESULTS\nEXA_API_KEY not configured.",
                "results": [], "errors": ["EXA_API_KEY not configured"],
            }
        q = (query or "").strip()
        if not q:
            return {
                "status": "no_results", "had_results": False,
                "formatted_results": "### WEB SEARCH RESULTS\nNo valid query.",
                "results": [], "errors": ["No valid query"],
            }

        try:
            resp = await self.client.search(
                q,
                num_results=max_results,
                contents={"highlights": {"query": q, "max_characters": 500}, "extras": {"image_links": 2}},
            )
            results = [self._normalize(r) for r in (resp.results or []) if getattr(r, "title", None) or getattr(r, "text", None)]
            results.sort(key=lambda r: r["date"] or "", reverse=True)
            had = len(results) > 0
            return {
                "status": "ok" if had else "no_results", "had_results": had,
                "query": q, "results": results,
                "formatted_results": self._fmt(results), "errors": [],
            }
        except Exception as e:
            logger.error(f"Exa search failed: '{q}' {e}")
            return {
                "status": "no_results", "had_results": False, "query": q,
                "results": [], "formatted_results": self._fmt([]),
                "errors": [f"{type(e).__name__}: {e}"],
            }

    async def search_with_metadata(self, query: str, max_results: int = 8) -> Dict[str, Any]:
        """Alias for search()."""
        return await self.search(query, max_results=max_results)

    async def search_many_with_metadata(self, queries: List[str], max_results: int = 6) -> Dict[str, Any]:
        """Run multiple searches in parallel, deduplicated. Kept for backward compat."""
        if not queries:
            return await self.search("", max_results=max_results)
        cleaned = [q.strip() for q in queries if q and q.strip()]
        if not cleaned:
            return await self.search("", max_results=max_results)

        async def _search(q: str) -> List[Dict[str, str]]:
            result = await self.search(q, max_results=max_results)
            return result.get("results", [])

        raw = await asyncio.gather(*[_search(q) for q in cleaned], return_exceptions=True)
        seen, merged = set(), []
        for batch in raw:
            if isinstance(batch, Exception):
                continue
            for r in batch:
                key = r["link"].lower() or r["title"].lower()[:60]
                if key not in seen:
                    seen.add(key)
                    merged.append(r)
        merged.sort(key=lambda r: r["date"] or "", reverse=True)
        had = len(merged) > 0
        return {
            "status": "ok" if had else "no_results", "had_results": had,
            "queries": cleaned, "results": merged,
            "formatted_results": self._fmt(merged), "errors": [],
        }


web_search_service = WebSearchService()
