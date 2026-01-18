import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isAuthenticated, getUserInfo, logout } from '../auth';
import api from '../api';

// Mock the api module
vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('auth utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location
    delete (window as any).location;
    (window as any).location = { href: '' };
  });

  describe('isAuthenticated', () => {
    it('returns true when API returns 200', async () => {
      (api.get as any).mockResolvedValue({ status: 200 });
      const result = await isAuthenticated();
      expect(result).toBe(true);
      expect(api.get).toHaveBeenCalledWith('/users/me');
    });

    it('returns false when API throws error', async () => {
      (api.get as any).mockRejectedValue(new Error('Unauthorized'));
      const result = await isAuthenticated();
      expect(result).toBe(false);
    });
  });

  describe('getUserInfo', () => {
    it('returns user data on success', async () => {
      const userData = { id: 1, email: 'test@example.com' };
      (api.get as any).mockResolvedValue({ data: userData });
      const result = await getUserInfo();
      expect(result).toEqual(userData);
    });

    it('throws error on failure', async () => {
      (api.get as any).mockRejectedValue(new Error('Network error'));
      await expect(getUserInfo()).rejects.toThrow('Network error');
    });
  });

  describe('logout', () => {
    it('calls logout API and redirects to login', async () => {
      (api.post as any).mockResolvedValue({});
      await logout();
      expect(api.post).toHaveBeenCalledWith('/auth/logout');
      expect(window.location.href).toBe('/login');
    });

    it('redirects to login even if API fails', async () => {
      (api.post as any).mockRejectedValue(new Error('Logout failed'));
      await logout();
      expect(window.location.href).toBe('/login');
    });
  });
});
