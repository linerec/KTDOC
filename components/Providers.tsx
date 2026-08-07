'use client';

import SessionProvider from '@/components/auth/SessionProvider';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { BuilderProvider } from '@/contexts/BuilderContext';
import { HeaderSettingsProvider } from '@/contexts/HeaderSettingsContext';
import { SiteThemeProvider } from '@/contexts/SiteThemeContext';
import EditModeLinkGuard from '@/components/common/EditModeLinkGuard';
import type { HeaderAlign, HeaderLogoVariant, HeaderStatePair } from '@/lib/headerBackground';

interface ProvidersProps {
  children: React.ReactNode;
  /** 서버(layout)에서 읽은 초기 헤더 로고 변형(최상단·스크롤 후) */
  initialLogo: HeaderStatePair<HeaderLogoVariant>;
  /** 서버(layout)에서 읽은 초기 로고·메뉴 정렬 */
  initialAlign: HeaderAlign;
}

export default function Providers({ children, initialLogo, initialAlign }: ProvidersProps) {
  return (
    <SessionProvider>
      {/* 공개 사이트 테마는 루트에 상주한다 — 헤더가 없는 로그인·가입 화면도 선호를 따르고,
          콘솔에서 공개 사이트로 나올 때 여기서 상태바 색과 속성이 복원된다.
          /admin 하위에서는 스스로 손을 뗀다(SiteThemeContext 참고). */}
      <SiteThemeProvider>
        <LanguageProvider>
          <BuilderProvider>
            <HeaderSettingsProvider initialLogo={initialLogo} initialAlign={initialAlign}>
              <EditModeLinkGuard />
              {children}
            </HeaderSettingsProvider>
          </BuilderProvider>
        </LanguageProvider>
      </SiteThemeProvider>
    </SessionProvider>
  );
}
