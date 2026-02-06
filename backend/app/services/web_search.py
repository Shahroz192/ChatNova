"""
Web Search Service Module
Provides access to DuckDuckGo search tool for LangChain agents.
"""

from langchain_community.tools import DuckDuckGoSearchResults
from langchain_community.utilities import DuckDuckGoSearchAPIWrapper
import logging
import json

# Configure logging
logger = logging.getLogger(__name__)


class WebSearchService:
    """
    Improved web search service using DuckDuckGo tools.
    """

    def __init__(self):
        self.search_tool = DuckDuckGoSearchResults()
        self.image_search_wrapper = DuckDuckGoSearchAPIWrapper()
        logger.info("WebSearchService initialized with DuckDuckGo tools")

    def get_tool(self):
        """Get the search tool for agent use."""
        return self.search_tool

    def search(self, query: str) -> str:
        """Run search and return formatted string of results."""
        try:
            return self.search_tool.run(query)
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return f"Search failed: {str(e)}"

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
