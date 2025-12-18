"""
Web Search Service Module
Provides access to DuckDuckGo search tool for LangChain agents.
"""

from langchain_community.tools import DuckDuckGoSearchRun
import logging
from typing import List, Optional, Dict, Any, Union
from enum import Enum
from dataclasses import dataclass, asdict

# Configure logging
logger = logging.getLogger(__name__)

# --- Re-exporting Type Definitions for Compatibility ---

class SearchType(Enum):
    """Enumeration of supported search types."""
    GENERAL = "general"
    NEWS = "news"
    IMAGES = "images"

@dataclass
class SearchResult:
    """Standardized search result structure."""
    title: str
    url: str
    snippet: str
    source: str
    timestamp: Optional[str] = None
    relevance_score: float = 0.0
    content_type: str = "webpage"
    metadata: Optional[Dict[str, Any]] = None

@dataclass
class SearchResponse:
    """Comprehensive search response structure."""
    query: str
    search_type: SearchType
    results: List[SearchResult]
    total_results: int
    search_time_ms: float
    cached: bool = False
    metadata: Optional[Dict[str, Any]] = None

# --------------------------------------------------------

class WebSearchService:
    """
    Simplified web search service.
    """
    
    def __init__(self):
        self.search_tool = DuckDuckGoSearchRun()
        logger.info("WebSearchService initialized with DuckDuckGo")
    
    def get_tool(self):
        """Get the search tool for agent use."""
        return self.search_tool

# Create global web search service instance
web_search_service = WebSearchService()