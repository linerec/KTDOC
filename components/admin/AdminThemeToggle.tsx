'use client';

/**
 * AdminThemeToggle
 * 관리 콘솔 상단바의 라이트/다크 세그먼트 토글. KO/EN 언어 전환과 같은
 * 시각 언어를 쓰되, 현재 테마 쪽이 금색으로 점등되어 한눈에 띈다.
 * 좁은 화면에서는 텍스트 라벨을 숨기고 아이콘만 남긴다(globals.css).
 */

import { useAdminTheme, type AdminTheme } from '@/contexts/AdminThemeContext';
import { useT } from '@/lib/i18n/useT';

const SunIcon = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4.4" />
    <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3L17 7M7 17l-1.7 1.7" />
  </svg>
);

const MoonIcon = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.3 14.6A8.6 8.6 0 0 1 9.4 3.7a8.6 8.6 0 1 0 10.9 10.9Z" />
  </svg>
);

export default function AdminThemeToggle() {
  const { theme, setTheme } = useAdminTheme();
  const t = useT();

  const options: Array<{ value: AdminTheme; label: string; icon: React.ReactNode }> = [
    { value: 'light', label: t('admin.shell.themeLight', '라이트'), icon: SunIcon },
    { value: 'dark', label: t('admin.shell.themeDark', '다크'), icon: MoonIcon },
  ];

  return (
    <div className="admin-theme-toggle" role="group" aria-label={t('admin.shell.theme', '화면 테마')}>
      {options.map(({ value, label, icon }) => (
        <button
          key={value}
          type="button"
          className={`admin-theme-btn ${theme === value ? 'active' : ''}`}
          onClick={() => setTheme(value)}
          aria-pressed={theme === value}
          title={label}
        >
          {icon}
          <span className="admin-theme-btn-label">{label}</span>
        </button>
      ))}
    </div>
  );
}
