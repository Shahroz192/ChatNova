import React, { createContext, useContext, useEffect } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

interface ThemeContextType {
  theme: string | undefined;
  setTheme: (theme: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: string;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'system'
}) => {
  useEffect(() => {
    // Add dynamic CSS variables based on theme
    const updateCSSVariables = (theme: string) => {
      const root = document.documentElement;
      
      if (theme === 'dark') {
        // Apply dark theme classes
        root.classList.add('dark');
        root.classList.remove('light');
        
        // Set CSS custom properties for dark mode using existing variables
        root.style.setProperty('--background-primary', 'var(--dark-bg-50)');
        root.style.setProperty('--background-secondary', 'var(--dark-bg-100)');
        root.style.setProperty('--text-primary', 'var(--dark-bg-900)');
        root.style.setProperty('--text-secondary', 'var(--dark-bg-700)');
        root.style.setProperty('--border-color', 'var(--dark-bg-300)');
        root.style.setProperty('--card-background', 'var(--dark-bg-100)');
      } else {
        // Apply light theme classes
        root.classList.remove('dark');
        root.classList.add('light');
        
        // Set CSS custom properties for light mode using existing variables
        root.style.setProperty('--background-primary', 'var(--light-bg-50)');
        root.style.setProperty('--background-secondary', 'var(--light-bg-100)');
        root.style.setProperty('--text-primary', 'var(--light-bg-900)');
        root.style.setProperty('--text-secondary', 'var(--light-bg-700)');
        root.style.setProperty('--border-color', 'var(--light-bg-300)');
        root.style.setProperty('--card-background', 'var(--light-bg-50)');
      }
    };

    // Get initial theme
    const currentTheme = localStorage.getItem('theme') || defaultTheme;
    updateCSSVariables(currentTheme);

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem('theme') === 'system' || !localStorage.getItem('theme')) {
        updateCSSVariables(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [defaultTheme]);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      enableSystem={true}
      disableTransitionOnChange={false}
      storageKey="theme"
    >
      {children}
    </NextThemesProvider>
  );
};