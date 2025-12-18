GENERATIVE_UI_INSTRUCTION = """
### UI Generation Capability
You have the ability to generate rich, interactive UI components (charts, dashboards, forms, tables, search results) instead of just text.
If the user's request is best served by a visual interface (e.g., "Show me a bar chart", "Create a dashboard", "Design a signup form", "Display search results"), or if they explicitly ask for it, you should generate a UI specification.

**Response Format for UI:**
You must output a SINGLE valid JSON object matching the `UIContainer` schema below. Do not include any markdown formatting (like ```json ... ```) or explanatory text outside the JSON. The response should be parseable as raw JSON.

**Schema:**
The root object must be a `UIContainer`:
```typescript
interface UIContainer {{
  type: 'container';
  children: UIComponent[];
}}

type UIComponent = {{
  type: ComponentType;
  props: ComponentProps;
}}

type ComponentType = 
  | 'layout' | 'data' | 'content' | 'form' | 'container' | 'row' | 'card' | 'slides' 
  | 'table' | 'chart' | 'text' | 'image' | 'alert' | 'input' | 'textarea' 
  | 'checkbox' | 'radio' | 'select' | 'button' | 'search_results' | 'news_card' 
  | 'image_gallery' | 'source_citation' | 'search_summary' | 'related_searches' 
  | 'search_controls' | 'tag_cloud' | 'timeline' | 'geographic' | 'loading' | 'error';

interface ComponentProps {{
  label?: string;
  width?: string; // e.g. "1/2", "full"
  children?: UIComponent[];
  // Data
  data?: {{ name: string; value: number }}[]; // CRITICAL: For charts, you MUST use 'name' (string) and 'value' (number) keys only.
  headers?: string[]; // For tables
  rows?: string[][]; // For tables
  chartType?: 'bar' | 'line' | 'pie';
  // Content
  text?: string;
  src?: string; // Image URL
  alt?: string;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'danger';
  // Form
  placeholder?: string;
  options?: string[]; // Select/Radio options
  name?: string;
  value?: string;
  // Search-specific props
  source_url?: string; // Link to original source
  timestamp?: string; // ISO format timestamp
  snippet?: string; // Search result snippet
  thumbnail?: string; // Thumbnail image URL
  relevance_score?: number; // 0.0 to 1.0
  content_type?: string; // 'webpage', 'news', 'image', 'video'
  source_name?: string; // Source domain/site name
  author?: string; // Content author
  read_time?: string; // Estimated read time
  tags?: string[]; // Content tags/keywords
  location?: string; // Geographic location
  category?: string; // Content category
  actions?: string[]; // Available actions: 'open_link', 'save', 'share', 'copy'
  // Search result props
  results?: SearchResultData[];
  search_query?: string;
  total_results?: number;
  search_time_ms?: number;
  search_type?: 'general' | 'news' | 'images';
  pagination?: PaginationData;
  filters?: FilterData[];
  sorting?: SortingData;
  // Visualization props
  chart_data?: ChartData[];
  timeline_data?: TimelineData[];
  tag_data?: TagData[];
  geo_data?: GeographicData[];
  // Layout props
  grid_layout?: 'list' | 'grid' | 'cards' | 'masonry';
  columns?: number;
  responsive?: boolean;
}}

interface SearchResultData {{
  title: string;
  url: string;
  snippet: string;
  source: string;
  timestamp?: string;
  relevance_score?: number;
  content_type?: string;
  thumbnail?: string;
  source_url?: string;
}}

interface PaginationData {{
  current_page: number;
  total_pages: number;
  page_size: number;
  has_next: boolean;
  has_previous: boolean;
}}

interface FilterData {{
  field: string;
  label: string;
  options: string[];
  selected?: string[];
}}

interface SortingData {{
  field: string;
  direction: 'asc' | 'desc';
  label: string;
}}

interface ChartData {{
  name: string;
  value: number;
  category?: string;
  color?: string;
}}

interface TimelineData {{
  date: string;
  title: string;
  description: string;
  category?: string;
  importance?: number;
}}

interface TagData {{
  name: string;
  count: number;
  category?: string;
  trending?: boolean;
}}

interface GeographicData {{
  location: string;
  latitude?: number;
  longitude?: number;
  value: number;
  label?: string;
}}
```

**CRITICAL RULES FOR CHARTS:**
1. The `data` array for charts MUST use `name` and `value` keys.
2. Example: `[{{ "name": "A", "value": 10 }}, {{ "name": "B", "value": 20 }}]`
3. DO NOT use keys like "category", "count", "label", "amount", etc. ALWAYS map them to "name" and "value".

**Search Result Component Usage:**
- Use 'search_results' for displaying multiple search results with pagination
- Use 'news_card' for individual news article display
- Use 'image_gallery' for image search results
- Use 'source_citation' for citing sources in results
- Use 'search_summary' for search analytics and statistics
- Use 'related_searches' for showing related search suggestions
- Use 'search_controls' for filtering and sorting controls
- Use 'tag_cloud' for topic visualization
- Use 'timeline' for time-based news/results
- Use 'geographic' for location-based results
- Use 'loading' for search loading states
- Use 'error' for search error handling

**Examples:**
1. **Search Results**:
{{
  "type": "container",
  "children": [
    {{
      "type": "search_results",
      "props": {{
        "label": "Search Results for 'AI Technology'",
        "search_query": "AI Technology",
        "search_type": "general",
        "total_results": 25,
        "search_time_ms": 234,
        "results": [
          {{
            "title": "Understanding AI Technology",
            "url": "https://example.com/ai-tech",
            "snippet": "Comprehensive guide to artificial intelligence technology...",
            "source": "TechCrunch",
            "timestamp": "2025-12-15T10:30:00Z",
            "relevance_score": 0.95,
            "content_type": "webpage"
          }}
        ],
        "pagination": {{
          "current_page": 1,
          "total_pages": 3,
          "page_size": 10,
          "has_next": true,
          "has_previous": false
        }}
      }}
    }}
  ]
}}

2. **News Card**:
{{
  "type": "news_card",
  "props": {{
    "title": "Breaking: AI Breakthrough in Machine Learning",
    "source_url": "https://example.com/news/ai-breakthrough",
    "snippet": "Scientists have achieved a significant breakthrough in machine learning...",
    "source_name": "Reuters",
    "timestamp": "2025-12-15T14:22:00Z",
    "author": "John Smith",
    "read_time": "3 min read",
    "tags": ["AI", "Machine Learning", "Technology"],
    "actions": ["open_link", "share", "save"],
    "variant": "primary"
  }}
}}

3. **Search Analytics Chart**:
{{
  "type": "chart",
  "props": {{
    "label": "Search Results by Source",
    "chartType": "pie",
    "data": [
      {{"name": "Tech Sites", "value": 45}},
      {{"name": "News Sites", "value": 30}},
      {{"name": "Blogs", "value": 25}}
    ]
  }}
}}

**Decision Logic:**
- If the user asks for a visualization, dashboard, UI component, or search results -> Generate JSON.
- If the user asks a question, code explanation, or general chat -> Generate standard Markdown text.
"""

import json
import logging
from typing import Dict, List, Optional, Any, Union
from datetime import datetime
from dataclasses import dataclass, asdict
import re

from app.services.web_search import SearchResult, SearchResponse, SearchType

logger = logging.getLogger(__name__)


class SearchResultTemplate:
    """Templates for different search result display formats."""
    
    @staticmethod
    def create_search_results_list(
        search_response: SearchResponse,
        layout: str = "list",
        show_analytics: bool = False
    ) -> Dict[str, Any]:
        """Create a comprehensive search results container."""
        
        # Create pagination data
        page_size = min(search_response.metadata.get('page_size', 10), len(search_response.results))
        total_pages = max(1, (search_response.total_results + page_size - 1) // page_size)
        
        pagination = {
            "current_page": 1,
            "total_pages": total_pages,
            "page_size": page_size,
            "has_next": len(search_response.results) == page_size,
            "has_previous": False
        }
        
        # Convert search results to UI format
        ui_results = [
            SearchResultTemplate._convert_result_to_ui(result)
            for result in search_response.results
        ]
        
        children = [
            {
                "type": "search_results",
                "props": {
                    "label": f"Search Results for '{search_response.query}'",
                    "search_query": search_response.query,
                    "search_type": search_response.search_type.value,
                    "total_results": search_response.total_results,
                    "search_time_ms": search_response.search_time_ms,
                    "results": ui_results,
                    "pagination": pagination,
                    "grid_layout": layout,
                    "responsive": True
                }
            }
        ]
        
        # Add analytics if requested
        if show_analytics:
            analytics_components = SearchResultTemplate._create_search_analytics(search_response)
            children.extend(analytics_components)
        
        return {
            "type": "container",
            "children": children
        }
    
    @staticmethod
    def create_news_card(result: SearchResult) -> Dict[str, Any]:
        """Create a news card component."""
        return {
            "type": "news_card",
            "props": {
                "title": result.title,
                "source_url": result.url,
                "snippet": result.snippet,
                "source_name": result.source,
                "timestamp": result.timestamp,
                "relevance_score": result.relevance_score,
                "content_type": result.content_type,
                "tags": result.metadata.get('tags', []) if result.metadata else [],
                "actions": ["open_link", "share", "save"],
                "variant": "primary",
                "width": "full"
            }
        }
    
    @staticmethod
    def create_image_gallery(
        search_response: SearchResponse,
        columns: int = 3
    ) -> Dict[str, Any]:
        """Create an image gallery component."""
        
        # Filter for image results
        image_results = [
            result for result in search_response.results
            if result.content_type == "image" or 'image' in result.metadata.get('content_type', '').lower()
        ]
        
        ui_results = [
            {
                "title": result.title,
                "url": result.url,
                "thumbnail": result.metadata.get('thumbnail', '') if result.metadata else '',
                "source": result.source,
                "snippet": result.snippet,
                "relevance_score": result.relevance_score
            }
            for result in image_results
        ]
        
        return {
            "type": "image_gallery",
            "props": {
                "label": f"Image Results for '{search_response.query}'",
                "results": ui_results,
                "columns": columns,
                "grid_layout": "grid",
                "responsive": True
            }
        }
    
    @staticmethod
    def create_search_summary(search_response: SearchResponse) -> Dict[str, Any]:
        """Create search analytics summary component."""
        
        # Calculate analytics data
        source_distribution = SearchResultTemplate._calculate_source_distribution(search_response.results)
        content_types = SearchResultTemplate._calculate_content_types(search_response.results)
        
        return {
            "type": "container",
            "children": [
                {
                    "type": "text",
                    "props": {
                        "text": f"Search Summary: '{search_response.query}'",
                        "variant": "primary",
                        "width": "full"
                    }
                },
                {
                    "type": "chart",
                    "props": {
                        "label": "Results by Source",
                        "chartType": "pie",
                        "data": source_distribution,
                        "width": "1/2"
                    }
                },
                {
                    "type": "chart",
                    "props": {
                        "label": "Content Types",
                        "chartType": "bar",
                        "data": content_types,
                        "width": "1/2"
                    }
                },
                {
                    "type": "text",
                    "props": {
                        "text": f"Total Results: {search_response.total_results} | Search Time: {search_response.search_time_ms:.0f}ms",
                        "variant": "secondary",
                        "width": "full"
                    }
                }
            ]
        }
    
    @staticmethod
    def create_related_searches(
        query: str,
        related_queries: List[str]
    ) -> Dict[str, Any]:
        """Create related searches component."""
        
        return {
            "type": "related_searches",
            "props": {
                "label": "Related Searches",
                "search_query": query,
                "related_queries": related_queries,
                "actions": ["search_related"],
                "width": "full"
            }
        }
    
    @staticmethod
    def create_search_controls(
        available_filters: List[Dict[str, Any]],
        sorting_options: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Create search filtering and sorting controls."""
        
        return {
            "type": "search_controls",
            "props": {
                "label": "Filter & Sort Results",
                "filters": available_filters,
                "sorting": sorting_options,
                "actions": ["apply_filters", "reset_filters"],
                "width": "full"
            }
        }
    
    @staticmethod
    def create_tag_cloud(tags: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Create a tag cloud component."""
        
        return {
            "type": "tag_cloud",
            "props": {
                "label": "Popular Topics",
                "tags": tags,
                "actions": ["filter_by_tag"],
                "width": "full"
            }
        }
    
    @staticmethod
    def create_timeline(results: List[SearchResult]) -> Dict[str, Any]:
        """Create a timeline component for time-based results."""
        
        timeline_data = []
        for result in results:
            if result.timestamp:
                timeline_data.append({
                    "date": result.timestamp,
                    "title": result.title,
                    "description": result.snippet,
                    "category": result.content_type,
                    "importance": result.relevance_score
                })
        
        return {
            "type": "timeline",
            "props": {
                "label": "Search Results Timeline",
                "timeline_data": timeline_data,
                "width": "full"
            }
        }
    
    @staticmethod
    def create_geographic_visualization(results: List[SearchResult]) -> Dict[str, Any]:
        """Create geographic visualization for location-based results."""
        
        geo_data = []
        for result in results:
            if result.metadata and 'location' in result.metadata:
                location_data = result.metadata['location']
                geo_data.append({
                    "location": location_data.get('name', ''),
                    "latitude": location_data.get('lat'),
                    "longitude": location_data.get('lng'),
                    "value": result.relevance_score,
                    "label": result.title
                })
        
        return {
            "type": "geographic",
            "props": {
                "label": "Search Results by Location",
                "geo_data": geo_data,
                "width": "full"
            }
        }
    
    @staticmethod
    def create_loading_state(search_type: str = "general") -> Dict[str, Any]:
        """Create loading state component."""
        
        return {
            "type": "loading",
            "props": {
                "label": f"Searching {search_type}...",
                "variant": "info",
                "width": "full"
            }
        }
    
    @staticmethod
    def create_error_state(
        error_message: str,
        search_type: str = "general"
    ) -> Dict[str, Any]:
        """Create error state component."""
        
        return {
            "type": "error",
            "props": {
                "label": f"Search Error ({search_type})",
                "text": error_message,
                "variant": "error",
                "actions": ["retry", "modify_query"],
                "width": "full"
            }
        }
    
    @staticmethod
    def _convert_result_to_ui(result: SearchResult) -> Dict[str, Any]:
        """Convert SearchResult to UI component format."""
        return {
            "title": result.title,
            "url": result.url,
            "snippet": result.snippet,
            "source": result.source,
            "timestamp": result.timestamp,
            "relevance_score": result.relevance_score,
            "content_type": result.content_type,
            "thumbnail": result.metadata.get('thumbnail', '') if result.metadata else '',
            "source_url": result.url
        }
    
    @staticmethod
    def _calculate_source_distribution(results: List[SearchResult]) -> List[Dict[str, Any]]:
        """Calculate source distribution for analytics."""
        source_counts = {}
        for result in results:
            source = result.source or "Unknown"
            source_counts[source] = source_counts.get(source, 0) + 1
        
        return [
            {"name": source, "value": count}
            for source, count in sorted(source_counts.items(), key=lambda x: x[1], reverse=True)
        ]
    
    @staticmethod
    def _calculate_content_types(results: List[SearchResult]) -> List[Dict[str, Any]]:
        """Calculate content type distribution."""
        type_counts = {}
        for result in results:
            content_type = result.content_type or "webpage"
            type_counts[content_type] = type_counts.get(content_type, 0) + 1
        
        return [
            {"name": content_type.title(), "value": count}
            for content_type, count in type_counts.items()
        ]


class SearchUIHelper:
    """Helper class for generating search UI components."""
    
    @staticmethod
    def generate_search_dashboard(
        search_response: SearchResponse,
        include_analytics: bool = True,
        include_related: bool = True,
        related_queries: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Generate a complete search dashboard."""
        
        components = []
        
        # Main search results
        results_component = SearchResultTemplate.create_search_results_list(
            search_response, layout="list", show_analytics=include_analytics
        )
        components.append(results_component)
        
        # Analytics section
        if include_analytics:
            analytics_component = SearchResultTemplate.create_search_summary(search_response)
            components.append(analytics_component)
        
        # Related searches
        if include_related and related_queries:
            related_component = SearchResultTemplate.create_related_searches(
                search_response.query, related_queries
            )
            components.append(related_component)
        
        # Tag cloud if we have enough data
        if len(search_response.results) > 5:
            tags = SearchUIHelper._extract_tags_from_results(search_response.results)
            if tags:
                tag_component = SearchResultTemplate.create_tag_cloud(tags)
                components.append(tag_component)
        
        return {
            "type": "container",
            "children": components
        }
    
    @staticmethod
    def generate_news_dashboard(search_response: SearchResponse) -> Dict[str, Any]:
        """Generate a news-focused search dashboard."""
        
        components = []
        
        # News summary
        components.append({
            "type": "text",
            "props": {
                "text": f"Latest News: {search_response.query}",
                "variant": "primary",
                "width": "full"
            }
        })
        
        # Timeline for news results
        timeline_component = SearchResultTemplate.create_timeline(search_response.results)
        components.append(timeline_component)
        
        # News cards in a grid
        news_cards = []
        for result in search_response.results[:6]:  # Limit to 6 for display
            card = SearchResultTemplate.create_news_card(result)
            news_cards.append(card)
        
        if news_cards:
            components.append({
                "type": "container",
                "children": news_cards,
                "props": {
                    "width": "full",
                    "grid_layout": "grid"
                }
            })
        
        return {
            "type": "container",
            "children": components
        }
    
    @staticmethod
    def generate_image_dashboard(search_response: SearchResponse, columns: int = 3) -> Dict[str, Any]:
        """Generate an image-focused search dashboard."""
        
        components = []
        
        # Image gallery
        gallery = SearchResultTemplate.create_image_gallery(search_response, columns)
        components.append(gallery)
        
        # Analytics for image search
        image_analytics = {
            "type": "text",
            "props": {
                "text": f"Found {len(search_response.results)} images for '{search_response.query}'",
                "variant": "secondary",
                "width": "full"
            }
        }
        components.append(image_analytics)
        
        return {
            "type": "container",
            "children": components
        }
    
    @staticmethod
    def _extract_tags_from_results(results: List[SearchResult]) -> List[Dict[str, Any]]:
        """Extract tags/keywords from search results."""
        tag_counts = {}
        
        for result in results:
            # Extract from metadata tags
            if result.metadata and 'tags' in result.metadata:
                for tag in result.metadata['tags']:
                    tag_counts[tag] = tag_counts.get(tag, 0) + 1
            
            # Extract from title and snippet (simple keyword extraction)
            text = f"{result.title} {result.snippet}".lower()
            words = re.findall(r'\b\w{4,}\b', text)  # Words with 4+ characters
            for word in words[:5]:  # Limit per result
                if word not in ['this', 'that', 'with', 'have', 'will', 'from', 'they', 'been']:
                    tag_counts[word] = tag_counts.get(word, 0) + 1
        
        # Convert to tag cloud format
        tags = []
        max_count = max(tag_counts.values()) if tag_counts else 1
        
        for tag, count in sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:20]:
            tags.append({
                "name": tag.title(),
                "count": count,
                "trending": count > max_count * 0.7
            })
        
        return tags


# Convenience functions for easy integration
def create_search_ui(
    search_response: SearchResponse,
    dashboard_type: str = "general",
    **kwargs
) -> Dict[str, Any]:
    """
    Create search UI components from SearchResponse.
    
    Args:
        search_response: SearchResponse object from WebSearchService
        dashboard_type: Type of dashboard ('general', 'news', 'image')
        **kwargs: Additional options (analytics, related_queries, etc.)
    
    Returns:
        Dict representing the UI container
    """
    
    if dashboard_type == "news":
        return SearchUIHelper.generate_news_dashboard(search_response)
    elif dashboard_type == "image":
        columns = kwargs.get('columns', 3)
        return SearchUIHelper.generate_image_dashboard(search_response, columns)
    else:
        return SearchUIHelper.generate_search_dashboard(
            search_response,
            include_analytics=kwargs.get('include_analytics', True),
            include_related=kwargs.get('include_related', True),
            related_queries=kwargs.get('related_queries')
        )


def create_search_component(
    result: SearchResult,
    component_type: str = "card"
) -> Dict[str, Any]:
    """
    Create individual search result component.
    
    Args:
        result: SearchResult object
        component_type: Type of component ('card', 'news_card', 'source_citation')
    
    Returns:
        Dict representing the UI component
    """
    
    if component_type == "news_card":
        return SearchResultTemplate.create_news_card(result)
    elif component_type == "source_citation":
        return {
            "type": "source_citation",
            "props": {
                "title": result.title,
                "source_url": result.url,
                "source_name": result.source,
                "timestamp": result.timestamp,
                "relevance_score": result.relevance_score,
                "width": "full"
            }
        }
    else:
        # Default card layout
        return {
            "type": "card",
            "props": {
                "title": result.title,
                "text": result.snippet,
                "source_url": result.url,
                "source_name": result.source,
                "timestamp": result.timestamp,
                "actions": ["open_link", "share"],
                "width": "full"
            }
        }


def create_search_analytics(results: List[SearchResult]) -> Dict[str, Any]:
    """
    Create search analytics components.
    
    Args:
        results: List of SearchResult objects
    
    Returns:
        Dict representing analytics container
    """
    
    # Create a mock SearchResponse for analytics
    mock_response = SearchResponse(
        query="Analytics",
        search_type=SearchType.GENERAL,
        results=results,
        total_results=len(results),
        search_time_ms=0.0
    )
    
    return SearchResultTemplate.create_search_summary(mock_response)


def create_loading_ui(search_type: str = "general") -> Dict[str, Any]:
    """Create loading UI component."""
    return SearchResultTemplate.create_loading_state(search_type)


def create_error_ui(error_message: str, search_type: str = "general") -> Dict[str, Any]:
    """Create error UI component."""
    return SearchResultTemplate.create_error_state(error_message, search_type)
