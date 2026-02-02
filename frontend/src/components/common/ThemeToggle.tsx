import React, { useCallback, useMemo } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = React.memo(({ className = '' }) => {
  const { theme, setTheme } = useTheme();

  const cycleTheme = useCallback(() => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  }, [theme, setTheme]);

  const icon = useMemo(() => {
    switch (theme) {
      case 'dark':
        return <Moon size={18} />;
      case 'light':
        return <Sun size={18} />;
      case 'system':
      default:
        return <Monitor size={18} />;
    }
  }, [theme]);

  const tooltip = useMemo(() => {
    switch (theme) {
      case 'dark':
        return 'Switch to light mode';
      case 'light':
        return 'Switch to system mode';
      case 'system':
      default:
        return 'Switch to dark mode';
    }
  }, [theme]);

  return (
    <button
      onClick={cycleTheme}
      className={`btn btn-link p-2 rounded-circle d-flex align-items-center justify-content-center ${className}`}
      style={{ color: 'inherit', textDecoration: 'none' }}
      title={tooltip}
      aria-label={`Current theme: ${theme}. Click to change.`}
    >
      {icon}
    </button>
  );
});