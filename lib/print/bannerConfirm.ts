/**
 * 인쇄물 도안 회신 — 적으신 말 한 덩어리
 *
 * 확인 화면(app/confirm/banner)과 접수 라우트(app/api/confirm/banner)가 같은
 * 한도를 본다. 화면이 4000자를 받아 놓고 서버가 2000자에서 막으면, 길게 적으신
 * 회신이 보내기 순간에 사라진다.
 *
 * 처음에는 항목을 고르는 폼이었다(3폭 배분·국기 모양·실측 칸·보내는 분…).
 * 원장님께 서식을 채우게 하는 화면이라 걷어냈다 — 확인을 부탁드리는 자리에서
 * 답의 모양까지 정해 드리지 않는다. 무엇을 여쭙는지는 화면 문구가 말하고,
 * 답은 편한 대로 한 칸에 적으시면 된다.
 *
 * 이 회신은 어디에도 저장되지 않는다. 메일 한 통이 전부이므로, 보낼 것이
 * 있는지(빈 회신이 아닌지)를 여기서 판정한다.
 */

export const NOTE_MAX = 4000;

export interface BannerFeedback {
  note: string;
}

export type ParseResult =
  | { ok: true; value: BannerFeedback }
  | { ok: false; error: string };

/**
 * 들어온 회신을 다듬는다.
 *
 * 앞뒤 공백만 지운다 — 줄바꿈은 적으신 그대로 둔다(여러 줄로 적으신 회신이
 * 한 줄로 뭉치면 읽는 쪽에서 문단이 사라진다).
 */
export function parseBannerFeedback(raw: unknown): ParseResult {
  const input =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const note = typeof input.note === 'string' ? input.note.trim() : '';

  if (note === '') {
    return { ok: false, error: '내용을 적어 주세요.' };
  }
  if (note.length > NOTE_MAX) {
    return { ok: false, error: '남기신 말씀이 너무 깁니다.' };
  }

  return { ok: true, value: { note } };
}
