'use client';

/** 관리 콘솔 상단바의 테마 토글. 표시는 공용 ThemeToggle이 담당한다. */

import { useAdminTheme } from '@/contexts/AdminThemeContext';
import ThemeToggle from '@/components/common/ThemeToggle';

export default function AdminThemeToggle() {
  const { theme, setTheme } = useAdminTheme();
  return <ThemeToggle theme={theme} setTheme={setTheme} className="theme-toggle admin-theme-toggle" />;
}
