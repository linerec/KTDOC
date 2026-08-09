'use client';

/**
 * LocaleText — 콘텐츠(DB에 한/영 두 벌로 든 값)를 현재 언어로 고르는 조각
 *
 * <T>가 "UI 문구"(locale 파일의 키)를 다룬다면, 이쪽은 "콘텐츠"를 다룬다.
 * 공연 제목·수업 이름처럼 운영진이 입력한 값은 locale 파일이 아니라 D1/MySQL에
 * title_ko / title_en 두 컬럼으로 들어 있다.
 *
 *   <LocaleText ko={program.title_ko} en={program.title_en} />
 *
 * 영문이 비어 있으면 한국어로 물러선다 — 영문을 아직 안 채운 항목이 빈칸으로
 * 사라지는 것보다 한국어라도 보이는 편이 낫다.
 *
 * 마크업을 만들지 않으므로 기존 태그 안에 그대로 끼워 넣을 수 있고,
 * 서버 컴포넌트 안에서도 쓸 수 있다(SSR은 한국어, 하이드레이션 후 전환).
 */

import { useLanguage } from '@/contexts/LanguageContext';

interface LocaleTextProps {
  ko: string | null | undefined;
  en?: string | null;
  /** 둘 다 비었을 때 내보낼 값 */
  fallback?: string;
}

export default function LocaleText({ ko, en, fallback = '' }: LocaleTextProps) {
  const { isEnglish } = useLanguage();
  return <>{(isEnglish && en) || ko || fallback}</>;
}

/** 훅으로 같은 판단이 필요할 때(문자열이 필요한 자리: alt·title·placeholder 등) */
export function useLocaleText(): (ko: string | null | undefined, en?: string | null) => string {
  const { isEnglish } = useLanguage();
  return (ko, en) => ((isEnglish && en) || ko || '');
}
