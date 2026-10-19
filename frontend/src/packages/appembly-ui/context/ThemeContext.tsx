import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppemblyThemeMode } from '../types';

interface ThemeContextValue {
  theme: AppemblyThemeMode;
  setTheme: (theme: AppemblyThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
});

export const AppemblyThemeProvider: React.FC<{
  defaultTheme?: AppemblyThemeMode;
  children: React.ReactNode;
}> = ({ defaultTheme = 'light', children }) => {
  const [theme, setTheme] = useState<AppemblyThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('appembly-theme') as AppemblyThemeMode | null;
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return defaultTheme;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem('appembly-theme', theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppemblyTheme = () => useContext(ThemeContext);
