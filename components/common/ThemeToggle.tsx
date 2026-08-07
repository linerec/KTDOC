'use client';

/**
 * ThemeToggle — 라이트/다크 세그먼트 토글 (공개 사이트·관리 콘솔 공용)
 *
 * KO/EN 언어 전환과 같은 시각 언어를 쓰되, 현재 테마 쪽이 금색으로 점등된다.
 * 좁은 화면에서는 텍스트 라벨을 숨기고 아이콘만 남긴다(globals.css).
 *
 * 표시 전용이다 — 선호를 읽고 쓰는 일은 호출부(SiteThemeToggle·AdminThemeToggle)가
 * 자기 영역의 컨텍스트로 처리한다.
 */

import { useT } from '@/lib/i18n/useT';
import type { Theme } from '@/lib/theme';

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

interface ThemeToggleProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  className?: string;
}

export default function ThemeToggle({ theme, setTheme, className = 'theme-toggle' }: ThemeToggleProps) {
  const t = useT();

  const options: Array<{ value: Theme; label: string; icon: React.ReactNode }> = [
    { value: 'light', label: t('theme.light', '라이트'), icon: SunIcon },
    { value: 'dark', label: t('theme.dark', '다크'), icon: MoonIcon },
  ];

  return (
    <div className={className} role="group" aria-label={t('theme.label', '화면 테마')}>
      {options.map(({ value, label, icon }) => (
        <button
          key={value}
          type="button"
          className={`theme-toggle-btn ${theme === value ? 'active' : ''}`}
          onClick={() => setTheme(value)}
          aria-pressed={theme === value}
          title={label}
        >
          {icon}
          <span className="theme-toggle-btn-label">{label}</span>
        </button>
      ))}
    </div>
  );
}
