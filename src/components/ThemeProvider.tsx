import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'halloween' | 'christmas' | 'new-year' | 'auto';
type ResolvedTheme = Exclude<Theme, 'auto'>;

function seasonalTheme(now: Date): ResolvedTheme {
  const month = now.getMonth();
  const day = now.getDate();
  if (month === 9 && day >= 25) return 'halloween';
  if (month === 11 && day >= 20 && day <= 26) return 'christmas';
  if ((month === 11 && day >= 27) || (month === 0 && day <= 3)) return 'new-year';
  return 'light';
}

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('quickStock_theme');
    if (saved === 'light' || saved === 'dark' || saved === 'halloween' || saved === 'christmas' || saved === 'new-year' || saved === 'auto') return saved;
    return 'light';
  });
  const [currentDate, setCurrentDate] = useState(() => new Date());

  useEffect(() => {
    if (theme !== 'auto') return;
    const refreshDate = () => setCurrentDate(new Date());
    refreshDate();
    const timer = window.setInterval(refreshDate, 60 * 60 * 1000);
    document.addEventListener('visibilitychange', refreshDate);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshDate);
    };
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('quickStock_theme', theme);
    const resolved = theme === 'auto' ? seasonalTheme(currentDate) : theme;
    const root = document.documentElement;
    root.classList.remove('theme-halloween', 'theme-christmas', 'theme-new-year');
    root.classList.toggle('dark', resolved === 'dark' || resolved === 'halloween' || resolved === 'new-year');
    if (resolved !== 'light' && resolved !== 'dark') root.classList.add(`theme-${resolved}`);
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColor) themeColor.content = ({ light: '#e9f5fc', dark: '#0c1928', halloween: '#21172e', christmas: '#ecf6ef', 'new-year': '#111d38' })[resolved];
  }, [theme, currentDate]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
