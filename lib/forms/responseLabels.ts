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

/**
 * 신청자·보호자에게 보이는 말. **운영 라벨과 일부러 다르다.**
 *
 * '확인 전'은 운영진에겐 "아직 안 봤다"지만 낸 사람에겐 "접수가 안 됐나?"로 읽힌다.
 * 실제로 그 오해가 있었다 — 신청 내역을 볼 곳이 없던 시절, 학부모가 접수 자체를
 * 의심했다. 낸 사람에게는 **"접수는 됐고, 지금 어디까지 왔다"**를 말해야 한다.
 *
 * hint 는 "그래서 내가 무엇을 하면 되나"에 답한다. 기다리면 되는지, 연락이 올 건지.
 */
export const APPLICANT_STATUS: Record<
  ResponseStatus,
  { label: string; hint: string }
> = {
  new: {
    label: '접수 완료',
    hint: '정상적으로 접수되었습니다. 학원에서 확인 후 안내드립니다.',
  },
  reviewing: {
    label: '확인 중',
    hint: '학원에서 신청 내용을 보고 있습니다. 따로 하실 일은 없습니다.',
  },
  needs_info: {
    label: '확인이 필요합니다',
    hint: '학원에서 연락드릴 예정입니다. 연락이 없으면 문의해 주세요.',
  },
  accepted: {
    label: '승인됨',
    hint: '신청이 승인되었습니다. 수업 배정을 준비하고 있습니다.',
  },
  enrolled: {
    label: '수업 배정 완료',
    hint: "'내 수업'에서 배정된 수업을 확인하실 수 있습니다.",
  },
  declined: {
    label: '접수되지 않음',
    hint: '자세한 내용은 학원으로 문의해 주세요.',
  },
  cancelled: {
    label: '취소됨',
    hint: '이 신청은 취소되었습니다.',
  },
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
