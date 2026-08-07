'use client';

/**
 * AdminThemeContext — 관리 콘솔 라이트(기본)/다크 테마의 전역 소스
 *
 * 콘솔 기본값은 라이트: 저장 선호가 'dark'일 때만 다크로 그린다.
 * 공개 사이트 선호(site-theme)와는 별도 키(admin-theme)로 관리된다.
 *
 * 이 프로바이더는 관리 콘솔 레이아웃에서만 마운트된다. 콘솔을 벗어나면
 * 루트에 상주하는 SiteThemeProvider가 주인이 되어 data-admin-theme를 지우고
 * 공개 선호와 상태바 색을 복원한다 — 여기서 따로 정리할 필요가 없다.
 *
 * 동작·상수는 전부 lib/theme.ts와 createThemeContext가 갖는다.
 * CSS는 globals.css 하단의 html[data-admin-theme='light'] 블록이 담당한다.
 */

import { createThemeContext } from './createThemeContext';
import type { Theme } from '@/lib/theme';

const { Provider, useTheme } = createThemeContext('admin', 'AdminTheme');

export const AdminThemeProvider = Provider;
export const useAdminTheme = useTheme;

/** @deprecated lib/theme의 Theme를 쓸 것. 기존 import 호환을 위해 유지한다. */
export type AdminTheme = Theme;
