import Link from 'next/link';
import type { Metadata } from 'next';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import SiteThemeToggle from '@/components/common/SiteThemeToggle';
import SiteLogo from '@/components/common/SiteLogo';
import IntlObject from '@/components/common/IntlObject';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-container">
      {/* 이 화면들은 헤더가 없다 — 테마 토글을 여기 따로 두지 않으면
          로그인·가입 중에 테마를 바꿀 방법이 사라진다. */}
      <div className="auth-utils">
        <SiteThemeToggle className="theme-toggle auth-theme-toggle" />
        <LanguageSwitcher className="language-switcher auth-lang" />
      </div>
      <div className="auth-header">
        <Link href="/">
          <SiteLogo height={50} priority />
        </Link>
      </div>
      <div className="auth-content">{children}</div>
      {/* 앱(홈 화면 아이콘)으로 열었는데 세션이 풀려 여기 착지했을 때, 로그인하지 않고도
          공개 사이트로 나갈 수 있는 길. 매니페스트 scope가 '/'라 앱 안에서 열린다. */}
      <Link href="/" className="auth-browse">
        <IntlObject keycode="auth.browseSite" />
      </Link>
    </div>
  );
}
