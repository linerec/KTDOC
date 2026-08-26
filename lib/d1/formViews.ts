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

export interface MyApplicationsView {
  /** 이 사람들의 신청을 본다 — 본인 + (학부모면) 자녀들의 회원 id */
  personIds: string[];
  /** 대체된 옛 제출본은 감춘다 — 다시 낸 사람에게 옛 것까지 보이면 무엇이 유효한지 모른다. */
  latestOnly: true;
  /** 취소한 신청도 본인에게는 보인다 — "내가 낸 것이 어떻게 됐나"의 답이라서. */
  includeCancelled: true;
}

/**
 * 내 신청 내역 — **신청자 본인·보호자가 자기가 낸 것을 확인하는 자리**.
 *
 * 왜 관점이 필요한가: 이 자리가 없어서 "저장이 안 된다"는 말이 나왔다.
 * 제출 완료 화면과 가입 안내가 "로그인하시면 신청 내역을 확인하실 수 있습니다"라고
 * 약속하는데 정작 그런 화면이 없었다. 학부모는 로그인해서 아무것도 못 찾고
 * 접수가 안 된 줄 알았고, 홈 화면은 그 위에 "신청하러 가기"를 계속 권했다.
 *
 * **운영 관점(adminResponseList)과 절대 섞지 않는다.** 저쪽은 처리하는 자리라
 * 연락처·의료정보·내부 메모를 본다. 이 관점은 낸 사람이 자기 것을 보는 자리이고,
 * 남의 신청은 한 건도 보여선 안 된다 — personIds 는 호출부가 서버에서
 * (세션 본인 + isGuardianOf 로 확인된 자녀)로만 만들어야 한다.
 *
 * 제출 당시 비회원이었던 신청은 여기 뜨지 않는다. 회원 연결이 되어야 보인다 —
 * 이메일이 같다는 이유로 붙이면 남의 신청을 보여줄 수 있다.
 */
export function myApplications(personIds: string[]): MyApplicationsView {
  return {
    personIds: Array.from(new Set(personIds.filter(Boolean))),
    latestOnly: true,
    includeCancelled: true,
  };
}
