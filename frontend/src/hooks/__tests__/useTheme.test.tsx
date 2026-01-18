import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../useTheme';
import { useTheme as useNextThemes } from 'next-themes';

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: vi.fn(),
}));

describe('useTheme hook', () => {
  it('returns theme info correctly', () => {
    (useNextThemes as any).mockReturnValue({
      theme: 'dark',
      setTheme: vi.fn(),
      resolvedTheme: 'dark',
    });

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('dark');
    expect(result.current.isDark).toBe(true);
    expect(result.current.isSystem).toBe(false);
  });

  it('toggles theme from dark to light', () => {
    const setTheme = vi.fn();
    (useNextThemes as any).mockReturnValue({
      theme: 'dark',
      setTheme,
      resolvedTheme: 'dark',
    });

    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.toggleTheme();
    });

    expect(setTheme).toHaveBeenCalledWith('light');
  });

  it('toggles theme from light to dark', () => {
    const setTheme = vi.fn();
    (useNextThemes as any).mockReturnValue({
      theme: 'light',
      setTheme,
      resolvedTheme: 'light',
    });

    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.toggleTheme();
    });

    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('handles system theme toggle correctly', () => {
    const setTheme = vi.fn();
    (useNextThemes as any).mockReturnValue({
      theme: 'system',
      setTheme,
      resolvedTheme: 'dark',
    });

    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.toggleTheme();
    });

    expect(setTheme).toHaveBeenCalledWith('light');
  });
});
