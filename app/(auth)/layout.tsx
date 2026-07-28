import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
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
      <LanguageSwitcher className="language-switcher auth-lang" />
      <div className="auth-header">
        <Link href="/">
          <Image
            src="/assets/logo/logo_white.png"
            alt="KTDOC Logo"
            width={120}
            height={42}
            style={{ height: '50px', width: 'auto' }}
            priority
          />
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
