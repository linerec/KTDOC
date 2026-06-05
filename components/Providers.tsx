'use client';

import SessionProvider from '@/components/auth/SessionProvider';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { BuilderProvider } from '@/contexts/BuilderContext';
import EditModeLinkGuard from '@/components/common/EditModeLinkGuard';

interface ProvidersProps {
  children: React.ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <LanguageProvider>
        <BuilderProvider>
          <EditModeLinkGuard />
          {children}
        </BuilderProvider>
      </LanguageProvider>
    </SessionProvider>
  );
}
