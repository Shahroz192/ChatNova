"""
Web Search Service Module
Provides access to DuckDuckGo search tool for LangChain agents.
"""

from langchain_community.tools import DuckDuckGoSearchResults
import logging

# Configure logging
logger = logging.getLogger(__name__)


class WebSearchService:
    """
    Improved web search service using DuckDuckGoSearchResults.
    """

    def __init__(self):
        self.search_tool = DuckDuckGoSearchResults()
        logger.info("WebSearchService initialized with DuckDuckGoSearchResults")

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


web_search_service = WebSearchService()
