import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  const getIcon = () => {
    switch (theme) {
      case 'dark':
        return <Moon size={18} />;
      case 'light':
        return <Sun size={18} />;
      case 'system':
      default:
        return <Monitor size={18} />;
    }
  };

  const getTooltip = () => {
    switch (theme) {
      case 'dark':
        return 'Switch to light mode';
      case 'light':
        return 'Switch to system mode';
      case 'system':
      default:
        return 'Switch to dark mode';
    }
  };

  return (
    <button
      onClick={cycleTheme}
      className={`p-2 rounded-lg bg-secondary-100 hover:bg-secondary-200 dark:bg-secondary-700 dark:hover:bg-secondary-600 transition-colors duration-200 ${className}`}
      title={getTooltip()}
      aria-label={`Current theme: ${theme}. Click to change.`}
    >
      {getIcon()}
    </button>
  );
};