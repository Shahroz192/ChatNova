import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSearchHistory, addToSearchHistory, streamChat } from '../api';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('api utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('search history', () => {
    it('gets empty history when none saved', () => {
      expect(getSearchHistory()).toEqual([]);
    });

    it('adds and gets history', () => {
      const item = addToSearchHistory('test query', 5, 'general', true);
      expect(item.query).toBe('test query');
      expect(getSearchHistory().length).toBe(1);
      expect(getSearchHistory()[0].query).toBe('test query');
    });
  });

  describe('streamChat', () => {
    it('handles stream chunks correctly', async () => {
      const onChunk = vi.fn();
      const onComplete = vi.fn();
      
      // Mock fetch response with a readable stream
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: Hello\n\n'));
          controller.enqueue(new TextEncoder().encode('data: world\n\n'));
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        }
      });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        body: mockStream,
      }));

      await streamChat('hello', 'model-id', undefined, { search_web: false }, false, undefined, onChunk, onComplete);

      expect(onChunk).toHaveBeenCalledWith('Hello');
      expect(onChunk).toHaveBeenCalledWith('world');
      expect(onComplete).toHaveBeenCalled();
    });

    it('handles errors in stream', async () => {
      const onError = vi.fn();
      
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server Error'),
      }));

      await streamChat('hello', 'model-id', undefined, { search_web: false }, false, undefined, vi.fn(), vi.fn(), onError);

      expect(onError).toHaveBeenCalledWith(expect.stringContaining('500'));
    });
  });
});
