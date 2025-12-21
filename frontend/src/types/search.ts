export interface SearchResultData {
  title: string;
  url: string;
  snippet: string;
  source: string;
  relevance_score?: number;
  timestamp?: string;
  thumbnail?: string;
  content_type?: 'article' | 'image' | 'video' | 'document';
}

export interface NewsArticleData {
  title: string;
  source_url: string;
  snippet: string;
  source_name: string;
  timestamp: string;
  tags?: string[];
  actions?: string[];
  thumbnail?: string;
  content?: string;
}

export interface ImageGalleryData {
  images: Array<{
    src: string;
    alt: string;
    title?: string;
    source?: string;
    url?: string;
  }>;
  title?: string;
  total_count?: number;
}

export interface SearchControlsData {
  search_types: Array<{
    id: string;
    label: string;
    active: boolean;
  }>;
  filters: Array<{
    id: string;
    label: string;
    options: Array<{
      value: string;
      label: string;
      active: boolean;
    }>;
  }>;
  sort_options: Array<{
    value: string;
    label: string;
    active: boolean;
  }>;
}

export interface SearchQueryModifiers {
  site?: string;       
  filetype?: string;   
  inurl?: string;       
  intitle?: string;     
  author?: string;      
  date_range?: {
    start?: string;
    end?: string;
  };
  language?: string;
  region?: string;
}

export interface WebSearchOptions {
  search_web: boolean;
  search_type?: 'general' | 'news' | 'images' | 'academic';
  max_results?: number;
  include_snippets?: boolean;
  safe_search?: boolean;
  language?: string;
  region?: string;
  modifiers?: SearchQueryModifiers;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: string;
  results_count: number;
  search_type: string;
  web_search_enabled: boolean;
}

export interface SearchStatus {
  isSearching: boolean;
  currentQuery?: string;
  searchType?: string;
  progress?: number;
  error?: string;
}