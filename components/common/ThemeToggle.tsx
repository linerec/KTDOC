'use client';

/**
 * ThemeToggle
 * 다크/라이트 테마 전환 버튼. 현재 테마의 반대(전환 결과)를 아이콘으로 보여준다
 * — 다크일 땐 해(라이트로 전환), 라이트일 땐 달(다크로 전환).
 * 헤더 lang-btn과 같은 높이·대비 규칙(theme-toggle 클래스)을 쓴다.
 */

import { useTheme } from '@/contexts/ThemeContext';
import { useT } from '@/lib/i18n/useT';

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className = 'theme-toggle' }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();
  const t = useT();
  const label = isDark
    ? t('common.theme.toLight', '밝은 화면으로 전환')
    : t('common.theme.toDark', '어두운 화면으로 전환');

  return (
    <button
      type="button"
      className={className}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
    >
      {isDark ? (
        /* 해 — 라이트 모드로 */
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.4" />
          <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3L17 7M7 17l-1.7 1.7" />
        </svg>
      ) : (
        /* 달 — 다크 모드로 */
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.3 14.6A8.6 8.6 0 0 1 9.4 3.7a8.6 8.6 0 1 0 10.9 10.9Z" />
        </svg>
      )}
    </button>
  );
}
