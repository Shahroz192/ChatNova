import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true, // This is crucial for sending cookies with requests
});

// We no longer need to manually add token to headers since it's sent in cookies
api.interceptors.request.use((config) => {
  // No need for Bearer token in Authorization header anymore
  // The access_token cookie will be automatically sent with each request
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // No need to remove localStorage token anymore since we don't use it
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Streaming chat function
export const streamChat = async (
  content: string,
  model: string,
  sessionId?: number,
  onChunk?: (chunk: string) => void,
  onComplete?: () => void,
  onError?: (error: string) => void
) => {
  try {
    const params = new URLSearchParams();
    if (sessionId) params.append('session_id', sessionId.toString());

    const response = await fetch(`/api/v1/chat/stream?${params}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // This ensures cookies are sent
      body: JSON.stringify({
        content,
        model,
      }),
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

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          
          if (data === '[DONE]') {
            onComplete?.();
            return;
          } else if (data.startsWith('ERROR:')) {
            onError?.(data.slice(6));
            return;
          } else if (data) {
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
