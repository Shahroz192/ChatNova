import { useTheme as useNextThemes } from 'next-themes';

export const useTheme = () => {
  const { theme, setTheme, resolvedTheme } = useNextThemes();

  const toggleTheme = () => {
    if (theme === 'dark') {
      setTheme('light');
    } else if (theme === 'light') {
      setTheme('dark');
    } else {
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    }
  };

  const isDark = resolvedTheme === 'dark';

  return {
    theme,
    setTheme,
    resolvedTheme,
    toggleTheme,
    isDark,
    isSystem: theme === 'system'
  };
};
