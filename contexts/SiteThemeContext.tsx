'use client';

/**
 * SiteThemeContext — 공개 사이트 라이트(기본)/다크 테마의 전역 소스
 *
 * 라이트는 흰 페이지가 아니라 한지(韓紙)다 — 사이트 정체성인 '먹빛 + 금색'을
 * 墨 ↔ 韓紙의 반전으로 번역한다. 저장 선호가 'dark'일 때만 다크로 그린다.
 *
 * 관리 콘솔 선호(admin-theme)와 별도로 관리되며(site-theme), 서로 간섭하지 않는다.
 * 루트 Providers에 마운트되지만 /admin 하위에서는 스스로 손을 뗀다
 * (createThemeContext의 isActive 참고).
 *
 * 동작·상수는 전부 lib/theme.ts와 createThemeContext가 갖는다.
 */

import { createThemeContext } from './createThemeContext';

const { Provider, useTheme } = createThemeContext('site', 'SiteTheme');

export const SiteThemeProvider = Provider;
export const useSiteTheme = useTheme;
export type { Theme } from '@/lib/theme';
