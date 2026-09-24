/**
 * 공연 참여 응답 — 참여 · 불참 · 미응답 (순수 함수)
 *
 * 참여는 `event_checkins`(체크인), 불참은 `event_declines`에 산다(migration 0047 머리말).
 * 두 표는 서로를 밀어내지만, 두 번째 쓰기가 실패하면 둘 다 남는 순간이 생길 수 있다.
 * 그때는 **참여가 이긴다** — 참여 기록을 잃는 쪽(아카이브에서 공연이 사라짐)이
 * 불참 표시를 잃는 쪽보다 나쁘다. 화면·API가 이 판단을 각자 하지 않도록 여기 둔다.
 */

export type EventResponse = 'going' | 'declined';

/** 두 표의 사실을 하나의 응답으로. 둘 다 없으면 미응답(null). */
export function responseOf(checkedIn: boolean, declined: boolean): EventResponse | null {
  if (checkedIn) return 'going';
  if (declined) return 'declined';
  return null;
}

/**
 * API 본문의 `response` 값.
 * 말하지 않으면 참여다 — 불참이 생기기 전의 호출부(POST = 체크인)가 그대로 동작해야 한다.
 * 알 수 없는 값은 null(400으로 거절) — 오타가 조용히 '참여'가 되면 안 된다.
 */
export function parseResponse(raw: unknown): EventResponse | null {
  if (raw === undefined || raw === null || raw === '') return 'going';
  if (raw === 'going' || raw === 'declined') return raw;
  return null;
}

/**
 * 아직 답을 기다리는 공연인가 — 둘러보기의 "응답하지 않은 공연 n개" 안내.
 * 지난 공연은 묻지 않는다(체크인은 기록이지 응답이 아니다). 불참도 응답이다.
 */
export function isAwaitingResponse(
  upcoming: boolean,
  checkedIn: boolean,
  declined: boolean
): boolean {
  return upcoming && responseOf(checkedIn, declined) === null;
}
