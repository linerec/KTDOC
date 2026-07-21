'use client';

/**
 * useT — 클라이언트 컴포넌트용 번역 헬퍼 훅
 *
 * 앱 전역의 i18n 파이프라인(LanguageContext → locale/*.json + D1 오버라이드)에서
 * 현재 언어의 메시지를 꺼내 쓰는 얇은 래퍼다. 서버 컴포넌트는 <IntlObject/>를 쓰고,
 * 클라이언트 컴포넌트는 이 훅을 쓴다(둘 다 같은 messages 소스를 본다).
 *
 * 관례:
 *  - 키코드는 도메인 네임스페이스로 짓는다. 관리 콘솔은 `admin.*`
 *    (예: 네비 `admin.nav.<menuKey>`, 섹션 `admin.navGroup.<groupKey>`, 셸 크롬 `admin.shell.*`).
 *  - fallback을 넘기면 아직 locale 파일에 키가 없을 때 그 값으로 표시한다.
 *    (페이지별 텍스트를 점진적으로 이관할 때 화면이 키코드로 깨지지 않게 하는 안전망)
 *  - params로 메시지 안의 {이름} 자리표시자를 치환한다. 예: t('x', undefined, { n: 3 })
 *
 * IntlObject와 달리 순수 문자열을 반환하므로 래퍼 엘리먼트를 만들지 않는다
 * (네비 라벨·aria-label 등 마크업을 덧붙이면 안 되는 자리에 적합).
 */

import { useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

export type TFunction = (
  key: string,
  fallback?: string,
  params?: Record<string, string | number>
) => string;

export function useT(): TFunction {
  const { messages } = useLanguage();

  return useCallback(
    (key, fallback, params) => {
      const raw = messages[key] ?? fallback ?? key;
      if (!params) return raw;
      return Object.entries(params).reduce(
        (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)),
        raw
      );
    },
    [messages]
  );
}
