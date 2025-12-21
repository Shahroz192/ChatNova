import axios from 'axios';
import type { WebSearchOptions, SearchHistoryItem } from '../types/search';

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

export default api;
