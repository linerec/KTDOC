'use client';

/**
 * createThemeContext — 공개 사이트/관리 콘솔이 공유하는 테마 컨텍스트 팩토리
 *
 * 두 영역(scope)은 저장 키와 적용 경로만 다를 뿐 동작이 완전히 같다.
 * 팩토리로 뽑아 두면 한쪽만 고쳐 두 동작이 어긋나는 일이 생기지 않는다.
 * 규칙·상수·DOM 반영은 전부 lib/theme.ts가 갖는다.
 *
 * 저장된 선호는 useSyncExternalStore로 구독한다(localStorage가 곧 스토어).
 * 프로바이더는 **자기 영역의 경로에 있을 때만** 문서에 손을 댄다 —
 * 공개 프로바이더가 루트에 마운트된 채 /admin에서 콘솔 테마를 덮어쓰지 않도록.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { usePathname } from 'next/navigation';
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  applyThemeToDocument,
  readStoredTheme,
  themeScopeForPath,
  type Theme,
  type ThemeScope,
} from '@/lib/theme';

export interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

export function createThemeContext(scope: ThemeScope, displayName: string) {
  const listeners = new Set<() => void>();
  // 프라이빗 모드 등 localStorage 쓰기 실패 시에도 세션 내 전환이 동작하게 하는 폴백
  let memoryTheme: Theme | null = null;

  const read = (): Theme => memoryTheme ?? readStoredTheme(scope);

  const subscribe = (onChange: () => void) => {
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  };

  const Context = createContext<ThemeContextValue | undefined>(undefined);

  const useTheme = () => {
    const ctx = useContext(Context);
    if (!ctx) throw new Error(`use${displayName} must be used within ${displayName}Provider`);
    return ctx;
  };

  const Provider = ({ children }: { children: React.ReactNode }) => {
    const pathname = usePathname();
    // 이 프로바이더가 지금 화면의 주인인가. 공개 프로바이더는 /admin에서 손을 뗀다.
    const isActive = themeScopeForPath(pathname ?? '/') === scope;

    // 서버 스냅샷은 기본값(라이트). 다크 저장 사용자는 하이드레이션 후 재렌더된다.
    // 문서 자체는 부트 스크립트가 첫 페인트 전에 이미 맞춰 놓았으므로 화면 깜빡임은 없다.
    const theme = useSyncExternalStore(subscribe, read, () => DEFAULT_THEME);

    // 부트 스크립트(첫 진입)와 setTheme(전환)이 문서 반영을 담당하지만,
    // 클라이언트 사이드 내비게이션으로 영역이 바뀐 경우를 위해 여기서도 맞춘다.
    // 예: 콘솔에서 공개 사이트로 나올 때 — 여기서 data-admin-theme가 지워지고
    //     공개 선호와 상태바 색이 복원된다.
    useEffect(() => {
      if (!isActive) return;
      applyThemeToDocument(scope, read());
    }, [isActive, theme]);

    const setTheme = useCallback((next: Theme) => {
      memoryTheme = next;
      try {
        localStorage.setItem(THEME_STORAGE_KEY[scope], next);
      } catch {
        /* 저장 실패해도 memoryTheme로 현재 세션의 전환은 유지된다 */
      }
      applyThemeToDocument(scope, next);
      listeners.forEach((l) => l());
    }, []);

    const toggleTheme = useCallback(() => {
      setTheme(read() === 'dark' ? 'light' : 'dark');
    }, [setTheme]);

    const value = useMemo(
      () => ({ theme, setTheme, toggleTheme, isDark: theme === 'dark' }),
      [theme, setTheme, toggleTheme]
    );

    return <Context.Provider value={value}>{children}</Context.Provider>;
  };

  Provider.displayName = `${displayName}Provider`;

  return { Provider, useTheme };
}
