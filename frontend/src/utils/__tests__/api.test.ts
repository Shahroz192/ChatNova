import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSearchHistory, addToSearchHistory, streamChat } from '../api';
import api from '../api';

// Mock api
vi.mock('../api', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    default: {
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    },
  };
});

describe('api utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('search history', () => {
    it('gets empty history when none saved', async () => {
      (api.get as any).mockResolvedValue({ data: [] });
      const history = await getSearchHistory();
      expect(history).toEqual([]);
      expect(api.get).toHaveBeenCalledWith('/search/');
    });

    it('adds and gets history', async () => {
      const mockItem = { id: 1, query: 'test query', search_type: 'general', created_at: new Date().toISOString() };
      (api.post as any).mockResolvedValue({ data: mockItem });
      (api.get as any).mockResolvedValue({ data: [mockItem] });

      const item = await addToSearchHistory('test query', 'general');
      expect(item.query).toBe('test query');
      
      const history = await getSearchHistory();
      expect(history.length).toBe(1);
      expect(history[0].query).toBe('test query');
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
