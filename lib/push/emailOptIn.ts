/**
 * 알림 발송(/api/push/send)의 이메일 동시 발송 판정 — 순수 함수
 *
 * **말하지 않으면 이메일은 가지 않는다.** 이 API는 푸시·알림함용으로 시작했고
 * 이메일은 나중에 붙었다. 처음에는 "값이 없으면 켠 것"으로 두었는데, 그러자
 * 체크박스가 없는 옛 호출부(공연 폼)가 자기도 모르게 회원 전원에게 메일을 보냈다 —
 * 2026-09-06~09에 새 공연 9건마다 "[새 일정] …" 메일 47통이 나갔고, 원장님이
 * 정지를 요청했다. 이메일은 한 번 나가면 거둘 수 없으니 기본은 '안 보냄'이어야 한다.
 *
 * 켜려면 호출부가 `alsoEmail: true`를 **불리언으로** 말해야 한다. 문자열 "true"나
 * 1은 켠 것으로 치지 않는다 — 느슨하게 받으면 어딘가의 폼 값이 그대로 흘러들어
 * 같은 사고가 다른 문으로 들어온다. 의도는 emailOptIn.test.ts가 잠근다.
 */

/** 요청 본문에서 이메일 동시 발송 여부를 읽는다. `alsoEmail === true`일 때만 켠다. */
export function wantsEmail(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  return (body as { alsoEmail?: unknown }).alsoEmail === true;
}
