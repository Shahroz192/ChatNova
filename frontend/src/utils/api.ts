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
  useTools?: boolean,
  images?: string[],
  onChunk?: (chunk: string) => void,
  onComplete?: () => void,
  onError?: (error: string) => void,
  onToolUpdate?: (update: any) => void
) => {
  try {
    const params = new URLSearchParams();
    if (sessionId) params.append('session_id', sessionId.toString());

    const requestBody: any = {
      content,
      model,
      images,
    };

    if (searchOptions) {
      requestBody.search_web = searchOptions.search_web;
      if (searchOptions.search_type) requestBody.search_type = searchOptions.search_type;
      if (searchOptions.max_results) requestBody.max_results = searchOptions.max_results;
      if (searchOptions.language) requestBody.language = searchOptions.language;
      if (searchOptions.region) requestBody.region = searchOptions.region;
      if (searchOptions.modifiers) requestBody.search_modifiers = searchOptions.modifiers;
    }

    let endpoint = '/api/v1/chat/stream';
    if (useTools) {
      endpoint = '/api/v1/chat/agent-stream';
    }

    const response = await fetch(`${endpoint}?${params}`, {
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

          // Handle simple string data or JSON
          if (data.startsWith('"') && data.endsWith('"')) {
             // It might be a simple JSON string message
              try {
                // Double parse if it's a stringified JSON string? 
                // In standard chat stream it sends plain text sometimes wrapped or raw chunks?
                // The backend sends `data: {chunk}\n\n` or `data: JSON\n\n`
                // Let's try to parse as JSON first if it looks like object
              } catch(e) {}
          }
          
          let parsedData = null;
          try {
              parsedData = JSON.parse(data);
          } catch (e) {
              // Not valid JSON, maybe just string content?
              // In agent stream, everything is JSON. In normal chat, it might be raw string chunks if not handled carefully, 
              // but looking at valid SSE, data usually is just the string. 
              // However, Chat.tsx logic before was `chunk` being the string.
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
          } else {
             // Check if it is an Agent Event (JSON)
             if (parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData)) {
                 if (parsedData.type === 'tool_start' || parsedData.type === 'tool_end') {
                     onToolUpdate?.(parsedData);
                 } else if (parsedData.type === 'content') {
                     onChunk?.(parsedData.content);
                 } else if (parsedData.type === 'error') {
                     onError?.(parsedData.content);
                 } else {
                     // Fallback for generative UI in standard chat (legacy check)
                    if (JSON.stringify(parsedData).includes('"type":"container"') && JSON.stringify(parsedData).includes('search_results')) {
                        hasSearchData = true;
                        onChunk?.(JSON.stringify(parsedData)); // Pass full JSON for generative UI
                    } else {
                        // Regular message chunk probably in JSON format? 
                        // If it's none of the above, key might be missing or logic differs.
                        // For standard chat, parsedData might be just the chunk string if JSON.parse worked on a quoted string?
                        // Actually standard chat `yield chunk` sends the string. `f"data: {chunk}\n\n"` in python.
                        // If chunk is `Hello`, data is `Hello`. JSON.parse fails. passed as string.
                        // If chunk is `{"foo": "bar"}`, data is `{"foo": "bar"}`. JSON.parse works.
                    }
                 }
             } else {
                 // It's a string chunk (standard chat)
                 onChunk?.(data);
             }
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

export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'audio.wav');

  const response = await fetch('/api/v1/chat/transcribe', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Transcription failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.text;
};

export const uploadFile = async (file: File, sessionId: number): Promise<any> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`/api/v1/chat/upload?session_id=${sessionId}`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed: ${response.status} - ${errorText}`);
  }

  return response.json();
};

export default api;
