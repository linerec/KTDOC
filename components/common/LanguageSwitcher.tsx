'use client';

/**
 * LanguageSwitcher
 * 한국어/영문 전환 버튼. Header와 동일한 lang-btn 스타일을 재사용한다.
 * auth 페이지 등 헤더가 없는 화면에서도 언어를 바꿀 수 있도록 분리한 공용 컴포넌트.
 */

import { useLanguage } from '@/contexts/LanguageContext';

interface LanguageSwitcherProps {
  className?: string;
}

export default function LanguageSwitcher({
  className = 'language-switcher',
}: LanguageSwitcherProps) {
  const { locale, changeLanguage, availableLangs } = useLanguage();

  return (
    <div className={className} aria-label="Language">
      {availableLangs.map((lang) => (
        <button
          key={lang}
          type="button"
          className={`lang-btn ${locale === lang ? 'active' : ''}`}
          onClick={() => changeLanguage(lang)}
        >
          {lang}
        </button>
      ))}
    </div>
  );
}
