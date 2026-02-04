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
  onToolUpdate?: (update: any) => void,
  signal?: AbortSignal
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
      if (searchOptions.document_ids) requestBody.document_ids = searchOptions.document_ids;
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
      signal,
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
    let currentEventData = '';

    const processEvent = (dataRaw: string) => {
      const data = dataRaw;
      const dataTrimmed = dataRaw.trim();

      let parsedData = null;
      try {
        parsedData = JSON.parse(dataTrimmed);
      } catch (e) {
        // Not valid JSON, maybe just string content.
      }

      if (dataTrimmed === '[DONE]') {
        if (hasSearchData && searchOptions?.search_web) {
          addToSearchHistory(content, 0, 'general', true);
        }
        onComplete?.();
        return 'done';
      }

      if (dataTrimmed.startsWith('ERROR:')) {
        onError?.(dataTrimmed.slice(6));
        return 'error';
      }

      if (parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData)) {
        if (parsedData.type === 'tool_start' || parsedData.type === 'tool_end') {
          onToolUpdate?.(parsedData);
        } else if (parsedData.type === 'content') {
          onChunk?.(parsedData.content);
        } else if (parsedData.type === 'error') {
          onError?.(parsedData.content);
          return 'error';
        } else if (parsedData.type === 'container' && Array.isArray(parsedData.children)) {
          onChunk?.(JSON.stringify(parsedData));
        } else {
          // Fallback for generative UI in standard chat (legacy check)
          const jsonString = JSON.stringify(parsedData);
          if (jsonString.includes('"type":"container"') && jsonString.includes('search_results')) {
            hasSearchData = true;
            onChunk?.(jsonString);
          }
        }
      } else {
        // It's a string chunk (standard chat)
        onChunk?.(data);
      }

      return 'continue';
    };

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (let i = 0; i < lines.length; i += 1) {
        const rawLine = lines[i];
        const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;

        if (line === '') {
          const nextRaw = lines[i + 1];
          const nextLine = nextRaw
            ? (nextRaw.endsWith('\r') ? nextRaw.slice(0, -1) : nextRaw)
            : undefined;

          const nextLooksLikeEvent =
            nextLine === undefined ||
            nextLine.startsWith('data:') ||
            nextLine.startsWith(':') ||
            nextLine.startsWith('id:') ||
            nextLine.startsWith('event:') ||
            nextLine.startsWith('retry:');

          if (currentEventData !== '' && nextLooksLikeEvent) {
            const status = processEvent(currentEventData);
            currentEventData = '';
            if (status === 'done' || status === 'error') {
              return;
            }
          } else if (currentEventData !== '') {
            // Preserve blank lines inside a chunk (backend doesn't split multiline data per SSE spec).
            currentEventData += '\n';
          }
          continue;
        }

        if (line.startsWith('data:')) {
          let dataPart = line.slice(5);
          if (dataPart.startsWith(' ')) dataPart = dataPart.slice(1);
          if (dataPart === '' && currentEventData === '') {
            // Backend can emit a standalone newline chunk as an empty data line.
            currentEventData = '\n';
          } else {
            currentEventData += (currentEventData ? '\n' : '') + dataPart;
          }
        } else if (line.startsWith(':')) {
          // Comment line in SSE, ignore.
        } else {
          // Non-standard continuation without "data:" prefix (backend may emit raw newlines).
          currentEventData += (currentEventData ? '\n' : '') + line;
        }
      }
    }

    if (currentEventData !== '') {
      processEvent(currentEventData);
    }
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
