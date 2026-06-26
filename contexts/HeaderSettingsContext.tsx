'use client';

import React, { createContext, useContext, useState, useMemo } from 'react';
import type { HeaderLogoVariant, HeaderStatePair } from '@/lib/headerBackground';

interface HeaderSettingsContextType {
  /** 현재 상단 로고 변형(최상단·스크롤 후 각각) */
  logo: HeaderStatePair<HeaderLogoVariant>;
  /** 로고 변형 변경(편집 모드 미리보기/복원에 사용) */
  setLogo: (logo: HeaderStatePair<HeaderLogoVariant>) => void;
}

const HeaderSettingsContext = createContext<HeaderSettingsContextType | undefined>(undefined);

export const useHeaderSettings = () => {
  const context = useContext(HeaderSettingsContext);
  if (!context) {
    throw new Error('useHeaderSettings must be used within a HeaderSettingsProvider');
  }
  return context;
};

interface HeaderSettingsProviderProps {
  /** 서버(layout)에서 읽은 초기 로고 변형 */
  initialLogo: HeaderStatePair<HeaderLogoVariant>;
  children: React.ReactNode;
}

export const HeaderSettingsProvider = ({ initialLogo, children }: HeaderSettingsProviderProps) => {
  const [logo, setLogo] = useState<HeaderStatePair<HeaderLogoVariant>>(initialLogo);

  const value = useMemo(() => ({ logo, setLogo }), [logo]);

  return (
    <HeaderSettingsContext.Provider value={value}>
      {children}
    </HeaderSettingsContext.Provider>
  );
};

export default HeaderSettingsContext;
