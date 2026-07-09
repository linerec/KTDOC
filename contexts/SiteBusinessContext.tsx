'use client';

/**
 * SiteBusinessContext — 서버(루트 layout)가 D1에서 읽은 SEO 비즈니스 정보(NAP)를
 * 클라이언트 트리(푸터 등)에 내려주는 통로.
 *
 * 푸터는 여러 페이지(일부 'use client')에서 개별 import되므로 서버 컴포넌트로
 * 바꿀 수 없다 — 대신 layout에서 한 번 읽어 컨텍스트로 공급해 SSR HTML에도
 * NAP가 포함되게 한다(검색엔진이 초기 HTML에서 읽을 수 있어야 한다).
 */

import { createContext, useContext } from 'react';
import { DEFAULT_SEO_BUSINESS, type SeoBusinessInfo } from '@/lib/seoBusiness';

const SiteBusinessContext = createContext<SeoBusinessInfo>(DEFAULT_SEO_BUSINESS);

export function SiteBusinessProvider({
  info,
  children,
}: {
  info: SeoBusinessInfo;
  children: React.ReactNode;
}) {
  return (
    <SiteBusinessContext.Provider value={info}>
      {children}
    </SiteBusinessContext.Provider>
  );
}

export const useSiteBusiness = () => useContext(SiteBusinessContext);
