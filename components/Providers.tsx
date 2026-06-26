'use client';

import SessionProvider from '@/components/auth/SessionProvider';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { BuilderProvider } from '@/contexts/BuilderContext';
import { HeaderSettingsProvider } from '@/contexts/HeaderSettingsContext';
import EditModeLinkGuard from '@/components/common/EditModeLinkGuard';
import type { HeaderLogoVariant, HeaderStatePair } from '@/lib/headerBackground';

interface ProvidersProps {
  children: React.ReactNode;
  /** 서버(layout)에서 읽은 초기 헤더 로고 변형(최상단·스크롤 후) */
  initialLogo: HeaderStatePair<HeaderLogoVariant>;
}

export default function Providers({ children, initialLogo }: ProvidersProps) {
  return (
    <SessionProvider>
      <LanguageProvider>
        <BuilderProvider>
          <HeaderSettingsProvider initialLogo={initialLogo}>
            <EditModeLinkGuard />
            {children}
          </HeaderSettingsProvider>
        </BuilderProvider>
      </LanguageProvider>
    </SessionProvider>
  );
}
