'use client';

import SessionProvider from '@/components/auth/SessionProvider';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { BuilderProvider } from '@/contexts/BuilderContext';

interface ProvidersProps {
  children: React.ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <LanguageProvider>
        <BuilderProvider>
          {children}
        </BuilderProvider>
      </LanguageProvider>
    </SessionProvider>
  );
}
