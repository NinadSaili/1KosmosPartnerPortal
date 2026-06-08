import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

export const ThemeContext = createContext<ThemeContextValue | null>(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const THEME_KEY = 'pp_theme';

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY) as Theme | null;
  if (stored === 'light' || stored === 'dark') return stored;
  // Fall back to system preference
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // getInitialTheme reads localStorage — safe during initialization
    return getInitialTheme();
  });

  // Apply theme class to <html> whenever theme changes
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Also listen for OS-level changes (only if no stored preference)
  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored) return; // User preference takes precedence

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, toggleTheme }),
    [theme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within <ThemeProvider>');
  }
  return ctx;
}
