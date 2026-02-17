import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockApi),
  },
}));

import { getSearchHistory, addToSearchHistory, streamChat } from '../api';

describe('api utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('search history', () => {
    it('gets empty history when none saved', async () => {
      mockApi.get.mockResolvedValue({ data: [] });
      const history = await getSearchHistory();
      expect(history).toEqual([]);
      expect(mockApi.get).toHaveBeenCalledWith('/search/');
    });

    it('adds and gets history', async () => {
      const mockItem = {
        id: 1,
        query: 'test query',
        search_type: 'general',
        created_at: new Date().toISOString(),
      };
      mockApi.post.mockResolvedValue({ data: mockItem });
      mockApi.get.mockResolvedValue({ data: [mockItem] });

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

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: Hello\n\n'));
          controller.enqueue(new TextEncoder().encode('data: world\n\n'));
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          body: mockStream,
        })
      );

      await streamChat(
        'hello',
        'model-id',
        undefined,
        { search_web: false },
        false,
        undefined,
        onChunk,
        onComplete
      );

      expect(onChunk).toHaveBeenCalledWith('Hello');
      expect(onChunk).toHaveBeenCalledWith('world');
      expect(onComplete).toHaveBeenCalled();
    });

    it('handles errors in stream', async () => {
      const onError = vi.fn();

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Server Error'),
        })
      );

      await streamChat(
        'hello',
        'model-id',
        undefined,
        { search_web: false },
        false,
        undefined,
        vi.fn(),
        vi.fn(),
        onError
      );

      expect(onError).toHaveBeenCalledWith(expect.stringContaining('500'));
    });
  });
});
