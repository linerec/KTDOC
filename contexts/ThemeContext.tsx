'use client';

/**
 * ThemeContext — 다크(기본)/라이트 테마 전환의 전역 소스
 *
 * 언어(LanguageContext)와 같은 클라이언트 사이드 방식이다: SSR은 항상 다크로
 * 렌더되고, layout의 인라인 스크립트가 첫 페인트 전에 localStorage['theme']를
 * 읽어 <html data-theme>를 맞춘다(FOUC 방지). 이 컨텍스트는 하이드레이션 후
 * 그 상태를 React 세계로 끌어와 토글·구독을 담당한다.
 *
 * CSS는 :root(다크 기본) + [data-theme='light'] 오버라이드 구조(globals.css).
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'theme';
/** PWA/브라우저 크롬 색 — globals.css의 --bg-color와 짝을 맞춘다 */
const THEME_COLOR: Record<Theme, string> = {
  dark: '#0a0a0a',
  light: '#f7f2e7',
};

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  // 주소창·PWA 크롬 색도 함께 전환
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLOR[theme]);
}

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>('dark');

  // 하이드레이션 후 저장된 선호를 React 상태로 동기화
  // (data-theme 자체는 layout의 인라인 스크립트가 이미 첫 페인트 전에 맞춰 놓았다)
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* 프라이빗 모드 등 저장소 접근 불가 시 다크 기본 유지 */
    }
    if (saved === 'light') {
      setThemeState('light');
      applyTheme('light');
    }
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* 저장 실패해도 현재 세션 전환은 유지 */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, isDark: theme === 'dark' }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
