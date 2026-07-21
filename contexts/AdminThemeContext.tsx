'use client';

/**
 * AdminThemeContext — 관리 콘솔 한정 라이트(기본)/다크 테마의 전역 소스
 *
 * 공개 사이트는 항상 다크이고, 관리 콘솔에서만 테마를 바꿀 수 있다.
 * 콘솔 기본값은 라이트: 저장 선호가 'dark'일 때만 다크로 그린다.
 * 언어(LanguageContext)와 같은 클라이언트 사이드 방식:
 *  - 루트 레이아웃(app/layout.tsx)의 부트 스크립트가 /admin 진입 시 첫 페인트 전에
 *    localStorage['admin-theme']를 읽어 <html data-admin-theme>를 맞춘다(FOUC 방지).
 *  - 이 프로바이더는 관리 콘솔 레이아웃에서만 마운트되며, 언마운트(콘솔 이탈) 시
 *    속성을 제거해 공개 사이트가 영향을 받지 않게 한다.
 *
 * 저장된 선호는 useSyncExternalStore로 구독한다(localStorage가 곧 스토어).
 * CSS는 globals.css 하단의 html[data-admin-theme='light'] 블록이 담당한다.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from 'react';

export type AdminTheme = 'dark' | 'light';

// app/layout.tsx의 부트 스크립트가 같은 키를 인라인으로 읽는다 — 함께 바꿀 것
const STORAGE_KEY = 'admin-theme';

const listeners = new Set<() => void>();
// 프라이빗 모드 등 localStorage 쓰기 실패 시에도 세션 내 전환이 동작하도록 하는 폴백
let memoryTheme: AdminTheme | null = null;

function readTheme(): AdminTheme {
  if (memoryTheme) return memoryTheme;
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function applyThemeAttr(theme: AdminTheme) {
  const root = document.documentElement;
  if (theme === 'light') root.dataset.adminTheme = 'light';
  else delete root.dataset.adminTheme;
}

interface AdminThemeContextType {
  theme: AdminTheme;
  setTheme: (theme: AdminTheme) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const AdminThemeContext = createContext<AdminThemeContextType | undefined>(undefined);

export const useAdminTheme = () => {
  const context = useContext(AdminThemeContext);
  if (!context) {
    throw new Error('useAdminTheme must be used within an AdminThemeProvider');
  }
  return context;
};

export const AdminThemeProvider = ({ children }: { children: React.ReactNode }) => {
  // 서버 스냅샷은 콘솔 기본값(라이트) — 다크 저장 사용자는 하이드레이션 후 재렌더된다
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'light' as AdminTheme);

  // 언마운트(콘솔 이탈) 시 라이트 속성 제거 — 공개 사이트는 항상 다크.
  // 마운트 시 속성 반영은 부트 스크립트(SSR 진입)와 아래 setTheme(전환)이 담당하지만,
  // 클라이언트 사이드 내비게이션으로 재진입한 경우를 위해 여기서도 맞춘다.
  useEffect(() => {
    applyThemeAttr(readTheme());
    return () => {
      delete document.documentElement.dataset.adminTheme;
    };
  }, []);

  const setTheme = useCallback((next: AdminTheme) => {
    memoryTheme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* 저장 실패해도 memoryTheme로 현재 세션의 전환은 유지 */
    }
    applyThemeAttr(next);
    listeners.forEach((l) => l());
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(readTheme() === 'dark' ? 'light' : 'dark');
  }, [setTheme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, isDark: theme === 'dark' }),
    [theme, setTheme, toggleTheme]
  );

  return (
    <AdminThemeContext.Provider value={value}>{children}</AdminThemeContext.Provider>
  );
};
