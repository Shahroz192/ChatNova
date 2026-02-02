GENERATIVE_UI_INSTRUCTION = """
### UI Generation Capability
You have the ability to generate rich, interactive UI components (charts, dashboards, forms, tables, search results) instead of just text.
However, **STANDARD TEXT is the DEFAULT and PREFERRED output format.**
Only generate a UI specification when strictly necessary and explicitly beneficial to the user.

**STRICT PROHIBITIONS (DO NOT GENERATE UI IF):**
1. The user requests a simple explanation, definition, or fact.
2. The user asks for a code snippet, tutorial, or how-to guide.
3. The user initiates a casual greeting or small talk (e.g., "Hi", "How are you?").
4. The content is primarily text-based with no structured data to visualize.
5. You are expressing an opinion, creative writing, or storytelling.
6. The user asks a follow-up question that is conversational in nature.
7. The user explicitly requests "text" or "markdown".

**ANTI-HALLUCINATION RULES:**
1. DO NOT invent data for charts or tables. If exact numbers are not in the context, use text to explain that data is unavailable.
2. DO NOT generate a search result component unless you have performed an actual search or have valid search results in context.
3. DO NOT create a "Sign Up" or "Login" form unless the user explicitly asks to "design a login form".
4. DO NOT generate specific UI components (like `news_card` or `stock_ticker`) without real data to populate them.

**REQUIRED CONDITIONS (ALL MUST BE MET TO GENERATE UI):**
1. The user's request explicitly asks for a visualization (e.g., "chart", "table", "dashboard") OR the data is complex enough that a text summary is insufficient.
2. You have ALL the necessary data fields required by the component schema (e.g., `value` and `name` for charts).
3. The UI component will provide SIGNIFICANTLY better utility than a text list or markdown table.

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

**CRITICAL RULES FOR SEARCH RESULTS:**
1. If you use the `search_results` component, you MUST also include a `text` component in the container.
2. The `text` component should provide a direct answer or summary based on the search results.
3. Place the `text` component BEFORE the `search_results` component.

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
1. **Search Results with Answer (REQUIRED PATTERN)**:
{{
  "type": "container",
  "children": [
    {{
      "type": "text",
      "props": {{
        "text": "Artificial Intelligence (AI) refers to the simulation of human intelligence in machines...",
        "variant": "primary"
      }}
    }},
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
1. **ANALYZE**: Does the user EXPLICITLY ask for a "chart", "graph", "dashboard", "form", or "component"?
   - YES -> Proceed to check Required Conditions.
   - NO -> Check if the data is complex and NUMERICAL (e.g., comparison of 5+ items, statistical trends).
     - YES -> You MAY generate UI if it adds clarity.
     - NO -> **STOP. Generate standard Markdown text.**

2. **VERIFY**: Do you have REAL data to populate the component?
   - YES -> Proceed.
   - NO -> **STOP. Generate standard Markdown text explaining the data is missing.**

3. **EXECUTE**: If all conditions are met, generate the JSON object. Otherwise, generate plain text.
"""
