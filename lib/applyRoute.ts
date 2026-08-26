/**
 * 수업 하나의 신청 경로를 정하는 유일한 규칙.
 *
 * **왜 함수 하나로 뽑았나**: 예전에는 이 판단이 화면마다 흩어져 있었다.
 * 수업 상세의 히어로 버튼은 신청서를 보고 갈 곳을 정했는데, 같은 페이지
 * 사이드바 버튼은 그 값을 아예 몰라 언제나 옛 모달을 열었다. 글자도 스타일도
 * 같은 버튼 두 개가 서로 다른 저장소로 신청을 떨어뜨렸고, 한 사람이 5분 간격으로
 * 양쪽에 두 번 낸 일이 실제로 있었다. 서버(POST /api/applications)는 아예
 * 검사를 하지 않아 화면을 고쳐도 새는 구멍이 남았다.
 *
 * 그래서 규칙은 여기 한 곳에만 둔다. 화면도 서버도 이 함수를 부른다.
 *
 * 세 갈래뿐이다:
 *   form   — 신청서가 붙어 있고 접수 중  → /f/{slug}
 *   closed — 신청서가 붙어 있으나 마감    → '접수 마감'
 *   legacy — 신청서가 붙지 않은 수업      → 옛 신청 모달
 *
 * **closed가 legacy로 흘러내리지 않는 것이 요점이다.** 마감된 신청서를 옛 경로로
 * 폴백시키면, 원장이 접수를 마감한 순간 수업 전부가 표시 없이 옛 폼으로 되돌아간다
 * (버튼 글자는 '신청하기' 그대로라 아무도 눈치채지 못한다).
 */

export type ApplyMode = 'form' | 'closed' | 'legacy';

/** 수업에 붙은 신청서의 상태. lib/d1/forms.ts 의 getLinkedForm 이 주는 모양. */
export interface ApplyRouteInput {
  isOpen: boolean;
}

export function resolveApplyMode(linkedForm: ApplyRouteInput | null | undefined): ApplyMode {
  if (!linkedForm) return 'legacy';
  return linkedForm.isOpen ? 'form' : 'closed';
}

/** 옛 경로(POST /api/applications)로 받아도 되는 수업인가. */
export function acceptsLegacyApplication(
  linkedForm: ApplyRouteInput | null | undefined
): boolean {
  return resolveApplyMode(linkedForm) === 'legacy';
}
