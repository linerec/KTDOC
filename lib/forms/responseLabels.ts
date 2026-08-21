/**
 * lib/forms/responseLabels.ts — 운영 화면이 응답 한 건을 부르는 이름들
 *
 * **왜 한 파일인가**: 처리 상태 라벨이 목록·필터·처리 패널 세 곳에 각자 적혀 있었다.
 * 그래서 같은 상태를 목록은 '추가 확인', 필터는 '추가 확인 필요'로 부르고 있었고,
 * 처리 이력은 아예 번역 없이 `new → reviewing` 이라는 코드를 그대로 보여줬다.
 * 이름은 한곳에서만 짓는다.
 *
 * **'신규'라는 말은 쓰지 않는다.** 신청서가 신규 등록/재등록을 묻기 때문에,
 * 접수 직후 상태를 '신규'라고 부르면 등록 유형과 겹쳐 읽힌다. 실제로 그렇게 읽혔다 —
 * 재등록으로 낸 신청이 목록에 '신규'로 뜬다는 문의가 들어왔다. 처리 상태는
 * '확인 전 → 확인 중 → …' 한 축으로만 말한다.
 *
 * ※ node --test 가 @/ 별칭을 풀지 못하므로 상대 경로 + .ts 로 import 한다.
 */

import type { Answers, FormQuestion, ResponseStatus } from '../../types/forms.ts';

/** 처리 상태 — 운영진이 이 신청을 어디까지 봤는가. 등록 유형과 무관하다. */
export const RESPONSE_STATUS_LABEL: Record<ResponseStatus, string> = {
  new: '확인 전',
  reviewing: '확인 중',
  needs_info: '추가 확인 필요',
  accepted: '승인',
  enrolled: '수업 배정됨',
  declined: '거절',
  cancelled: '취소',
};

export const RESPONSE_STATUS_BADGE: Record<ResponseStatus, string> = {
  new: 'admin-badge-warning',
  reviewing: 'admin-badge-muted',
  needs_info: 'admin-badge-muted',
  accepted: 'admin-badge-success',
  enrolled: 'admin-badge-success',
  declined: 'admin-badge-muted',
  cancelled: 'admin-badge-danger',
};

/** 접수부터 처리 끝까지의 순서. 필터 목록이 이 순서로 뜬다. */
export const RESPONSE_STATUSES: ResponseStatus[] = [
  'new',
  'reviewing',
  'needs_info',
  'accepted',
  'enrolled',
  'declined',
  'cancelled',
];

/**
 * 운영자가 처리 패널에서 직접 고를 수 있는 상태.
 * 'enrolled'(수업 배정됨)가 빠진 것은 의도다 — 배정 버튼이 실제로 수업에 넣으면서
 * 붙이는 상태이고, 손으로 고르면 명단에 없는 학생이 배정된 것처럼 보인다.
 */
export const MANUAL_RESPONSE_STATUSES: ResponseStatus[] = [
  'new',
  'reviewing',
  'needs_info',
  'accepted',
  'declined',
  'cancelled',
];

/**
 * 처리 이력에 남은 상태 코드를 사람 말로. 모르는 코드는 그대로 돌려준다 —
 * 옛 기록이나 나중에 늘어난 상태가 화면에서 사라지는 것보다 코드가 보이는 편이 낫다.
 */
export function responseStatusLabel(code: string | null | undefined): string {
  if (!code) return '';
  return RESPONSE_STATUS_LABEL[code as ResponseStatus] ?? code;
}

/* ── 등록 유형 (신규 등록 / 재등록) ────────────────────────────────────── */

export type RegType = 'new' | 'returning';

export const REG_TYPE_LABEL: Record<RegType, string> = {
  new: '신규 등록',
  returning: '재등록',
};

/**
 * 등록 유형 문항 찾기 — 신청서마다 키가 다를 수 있어 이름으로 찾는다
 * (학비 기간 문항을 찾는 findPeriodQuestion 과 같은 규약).
 * 특강·설문에는 이 문항이 없고, 그때는 undefined 다.
 */
export function findRegTypeQuestion(questions: FormQuestion[]): FormQuestion | undefined {
  return questions.find((q) => q.key.includes('reg_type') && q.type === 'single');
}

/**
 * 이 응답이 고른 등록 유형. 문항이 없거나 답이 낯선 값이면 null 이고,
 * 화면은 아무 배지도 달지 않는다(모르면 말하지 않는다).
 */
export function regTypeOf(questions: FormQuestion[], answers: Answers): RegType | null {
  const q = findRegTypeQuestion(questions);
  if (!q) return null;
  const value = answers[q.key];
  return value === 'new' || value === 'returning' ? value : null;
}
