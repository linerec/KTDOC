/**
 * lib/d1/formViews.ts — 신청서 응답을 "누가 어디서 보는가"로 조회한다
 *
 * eventViews.ts 와 같은 규칙이다: 화면마다 필터를 조립하지 않는다.
 * 조건이 조용히 빠져도 아무도 모르는 것이 이 도메인의 사고이기 때문이다.
 * 관점 함수는 "누가 무엇을 보는 자리인가"를 이름으로 말하고 근거를 주석에 남긴다.
 *
 * 여기 없는 관점이 필요하면 새 관점이므로 이 파일에 추가하고 근거를 적을 것.
 * 의도는 formViews.test.ts 가 잠근다.
 *
 * ※ node --test 가 @/ 별칭을 풀지 못하므로 상대 경로 + .ts 로 import 한다.
 */

import type { ResponseStatus } from '../../types/forms.ts';

export interface PublicFormView {
  slug: string;
  /** 공개 조회는 게시된 폼만 본다. 초안이 URL 로 새면 안 된다. */
  statuses: ['open'];
}

/** 공개 폼 페이지 — 방문자가 링크·QR로 들어오는 자리 */
export function publicFormBySlug(slug: string): PublicFormView {
  return { slug, statuses: ['open'] };
}

export interface AdminResponseListView {
  formId: number;
  /** 재제출이 있으면 최신본만 본다. */
  latestOnly: boolean;
  statuses?: ResponseStatus[];
  search?: string;
  limit: number;
  offset: number;
}

/**
 * 운영 응답 목록 — 신청자를 확인·응대하는 자리.
 *
 * 기본값이 '취소 제외'인 이유: 취소는 되돌린 기록이지 처리 대기 목록이 아니다.
 * 다만 상태를 콕 집으면 그것만 본다 — 취소된 신청을 다시 볼 경로가 없으면 안 된다.
 */
export function adminResponseList(opts: {
  formId: number;
  status?: ResponseStatus;
  search?: string;
  limit?: number;
  offset?: number;
}): AdminResponseListView {
  return {
    formId: opts.formId,
    latestOnly: true,
    statuses: opts.status
      ? [opts.status]
      : ['new', 'reviewing', 'needs_info', 'accepted', 'enrolled', 'declined'],
    search: opts.search,
    // 상한을 두는 이유: 목록 화면이 실수로 전부 긁어오면 원격 D1을 그대로 때린다.
    limit: Math.min(opts.limit ?? 100, 500),
    offset: opts.offset ?? 0,
  };
}

export interface RosterView {
  formId: number;
  periodQuestionKey: string;
  fullYearOptionKey: string;
  /**
   * 1년 등록 우선 → 그다음 선착순.
   * 이 정렬이 배정 규칙 자체다 — 삼고무·오고무는 보유 북 수량이 제한되어
   * 1년 과정 등록 학생에게 우선 배정되고 잔여 자리는 선착순이다.
   */
  orderBy: 'full_year_first';
}

/** 과목별 명단 — 반편성을 하는 자리 */
export function rosterView(opts: {
  formId: number;
  periodQuestionKey: string;
  fullYearOptionKey: string;
}): RosterView {
  return { ...opts, orderBy: 'full_year_first' };
}
