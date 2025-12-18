import axios from 'axios';
import type { SearchResultData, WebSearchOptions, SearchHistoryItem, SavedSearchItem } from '../types/search';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

const searchCache = new Map<string, { data: SearchResultData[]; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000;

export const getSearchHistory = (): SearchHistoryItem[] => {
  const saved = localStorage.getItem('searchHistory');
  return saved ? JSON.parse(saved) : [];
};

export const addToSearchHistory = (query: string, resultsCount: number, searchType: string, webSearchEnabled: boolean) => {
  const history = getSearchHistory();
  const newItem: SearchHistoryItem = {
    id: Date.now().toString(),
    query,
    timestamp: new Date().toISOString(),
    results_count: resultsCount,
    search_type: searchType,
    web_search_enabled: webSearchEnabled,
  };

  const updated = [newItem, ...history.slice(0, 99)];
  localStorage.setItem('searchHistory', JSON.stringify(updated));
  return newItem;
};

export const getSavedSearches = (): SavedSearchItem[] => {
  const saved = localStorage.getItem('savedSearches');
  return saved ? JSON.parse(saved) : [];
};

export const saveSearch = (name: string, query: string, searchOptions: WebSearchOptions): SavedSearchItem => {
  const saved = getSavedSearches();
  const newItem: SavedSearchItem = {
    id: Date.now().toString(),
    name,
    query,
    search_options: searchOptions,
    created_at: new Date().toISOString(),
    usage_count: 0,
  };

  const updated = [newItem, ...saved];
  localStorage.setItem('savedSearches', JSON.stringify(updated));
  return newItem;
};

export const deleteSavedSearch = (id: string) => {
  const saved = getSavedSearches();
  const updated = saved.filter(item => item.id !== id);
  localStorage.setItem('savedSearches', JSON.stringify(updated));
};

export const incrementSearchUsage = (id: string) => {
  const saved = getSavedSearches();
  const updated = saved.map(item =>
    item.id === id
      ? { ...item, usage_count: item.usage_count + 1, last_used: new Date().toISOString() }
      : item
  );
  localStorage.setItem('savedSearches', JSON.stringify(updated));
};

export const getCachedSearchResults = (query: string): SearchResultData[] | null => {
  const cached = searchCache.get(query);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  searchCache.delete(query);
  return null;
};

export const setCachedSearchResults = (query: string, data: SearchResultData[]) => {
  searchCache.set(query, {
    data,
    timestamp: Date.now()
  });
};

export const clearExpiredCache = () => {
  const now = Date.now();
  for (const [key, value] of searchCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      searchCache.delete(key);
    }
  }
};

export const streamChat = async (
  content: string,
  model: string,
  sessionId?: number,
  searchOptions?: WebSearchOptions,
  onChunk?: (chunk: string) => void,
  onComplete?: () => void,
  onError?: (error: string) => void
) => {
  try {
    const params = new URLSearchParams();
    if (sessionId) params.append('session_id', sessionId.toString());

    const requestBody: any = {
      content,
      model,
    };

    if (searchOptions) {
      requestBody.search_web = searchOptions.search_web;
      if (searchOptions.search_type) requestBody.search_type = searchOptions.search_type;
      if (searchOptions.max_results) requestBody.max_results = searchOptions.max_results;
      if (searchOptions.language) requestBody.language = searchOptions.language;
      if (searchOptions.region) requestBody.region = searchOptions.region;
      if (searchOptions.modifiers) requestBody.search_modifiers = searchOptions.modifiers;
    }

    const response = await fetch(`/api/v1/chat/stream?${params}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader available');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let hasSearchData = false;

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          let data = line.slice(6).trim();

          if (data.startsWith('"') && data.endsWith('"')) {
            try {
              data = JSON.parse(data);
            } catch (e) {
            }
          }

          if (data === '[DONE]') {
            if (hasSearchData && searchOptions?.search_web) {
              addToSearchHistory(content, 0, 'general', true);
            }
            onComplete?.();
            return;
          } else if (data.startsWith('ERROR:')) {
            onError?.(data.slice(6));
            return;
          } else if (data) {
            if (data.includes('"type":"container"') && data.includes('search_results')) {
              hasSearchData = true;
            }
            onChunk?.(data);
          }
        }
      }
    }

    onComplete?.();
  } catch (error) {
    console.error('Streaming error:', error);
    onError?.(error instanceof Error ? error.message : 'Unknown error occurred');
  }
};

export const searchWeb = async (query: string, options?: Partial<WebSearchOptions>): Promise<SearchResultData[]> => {
  try {
    const cacheKey = `${query}_${JSON.stringify(options)}`;
    const cached = getCachedSearchResults(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await api.post('/search', {
      query,
      ...options,
    });

    const results = response.data.results || [];

    setCachedSearchResults(cacheKey, results);

    return results;
  } catch (error) {
    console.error('Search error:', error);
    throw error;
  }
};

export const getSearchSuggestions = async (query: string): Promise<string[]> => {
  try {
    const response = await api.get('/search/suggestions', {
      params: { q: query }
    });
    return response.data.suggestions || [];
  } catch (error) {
    console.error('Search suggestions error:', error);
    return [];
  }
};

export const exportSearchResults = (results: SearchResultData[], format: 'csv' | 'json' | 'txt' = 'csv') => {
  let content: string;
  let mimeType: string;
  let filename: string;

  switch (format) {
    case 'json':
      content = JSON.stringify(results, null, 2);
      mimeType = 'application/json';
      filename = `search_results_${Date.now()}.json`;
      break;
    case 'txt':
      content = results.map(r => `${r.title}\n${r.url}\n${r.snippet}\n\n`).join('');
      mimeType = 'text/plain';
      filename = `search_results_${Date.now()}.txt`;
      break;
    case 'csv':
    default:
      const headers = ['Title', 'URL', 'Snippet', 'Source'];
      const rows = results.map(r => [r.title, r.url, r.snippet, r.source]);
      content = [headers, ...rows].map(row =>
        row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
      ).join('\n');
      mimeType = 'text/csv';
      filename = `search_results_${Date.now()}.csv`;
      break;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

setInterval(clearExpiredCache, CACHE_DURATION);

export default api;
