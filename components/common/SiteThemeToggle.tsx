'use client';

/** 공개 사이트용 테마 토글. 헤더 우측 툴바·모바일 메뉴·로그인 화면에서 쓴다. */

import { useSiteTheme } from '@/contexts/SiteThemeContext';
import ThemeToggle from './ThemeToggle';

export default function SiteThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useSiteTheme();
  return <ThemeToggle theme={theme} setTheme={setTheme} className={className} />;
}
