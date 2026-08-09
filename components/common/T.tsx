'use client';

/**
 * T — 래퍼 없이 번역 텍스트만 내는 조각
 *
 * 서버 컴포넌트 안의 고정 문구를 옮길 때 쓴다. IntlObject와 달리 마크업을 만들지
 * 않으므로(프래그먼트만 반환) 기존 태그·클래스를 그대로 두고 텍스트만 감쌀 수 있다:
 *
 *   <h1 className="admin-title"><T k="admin.members.title">회원 관리</T></h1>
 *
 * children이 곧 한국어 폴백이다 — 키가 아직 locale 파일에 없어도 화면이 키코드로
 * 깨지지 않는다(페이지별 점진 이관의 안전망).
 *
 * params에는 엘리먼트도 넣을 수 있다. 언어마다 숫자가 오는 자리가 달라
 * ("대기 {n}명 있습니다" vs "{n} members are waiting") 강조는 자리표시자로 끼운다:
 *
 *   <T k="admin.members.pending" params={{ n: <strong>{count}</strong> }}>
 *     승인 대기 중인 회원이 {n}명 있습니다.
 *   </T>
 *
 * 문자열이 필요한 자리(placeholder·title·aria-label)에는 이 조각을 쓸 수 없다.
 * 그런 화면은 클라이언트 컴포넌트로 두고 useT()를 직접 쓴다.
 */

import { Fragment, type ReactNode } from 'react';
import { useT } from '@/lib/i18n/useT';

interface TProps {
  /** 키코드. 관리 콘솔은 `admin.*` 네임스페이스. */
  k: string;
  /** 한국어 원문(폴백) */
  children?: string;
  /** {이름} 자리표시자 치환값 */
  params?: Record<string, ReactNode>;
}

/** "대기 {n}명" + {n: <strong>3</strong>} → ["대기 ", <strong>3</strong>, "명"] */
function interpolate(template: string, params: Record<string, ReactNode>): ReactNode[] {
  // 캡처 그룹이 있는 split은 [원문, 이름, 원문, 이름, …]로 갈린다 — 홀수 자리가 자리표시자.
  return template.split(/\{(\w+)\}/g).map((part, i) => {
    if (i % 2 === 0) return part;
    return part in params ? <Fragment key={i}>{params[part]}</Fragment> : `{${part}}`;
  });
}

export default function T({ k, children, params }: TProps) {
  const t = useT();
  // 치환은 여기서 직접 한다(useT의 params는 문자열만 다룬다).
  const template = t(k, children);
  return <>{params ? interpolate(template, params) : template}</>;
}
