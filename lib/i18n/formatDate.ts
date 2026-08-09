/**
 * 관리 콘솔의 날짜 표기
 *
 * 두 종류의 '날짜'를 구분해야 한다:
 *
 *  - **시점(timestamp)** — 가입일·신청일처럼 DB에 UTC 순간으로 저장된 값.
 *    보는 사람의 시간대로 옮겨서 보여줘야 맞다. 이 파일의 formatTimestampDate가 맡는다.
 *  - **날짜(date)** — 공연 날짜처럼 시간대가 없는 달력상의 날. 시간대로 옮기면
 *    오히려 하루가 밀린다. types/gallery의 formatEventDate가 맡는다.
 *
 * 둘을 섞어 쓰면 늦은 밤에 만든 기록의 날짜가 하루 어긋난다 — 그래서 나눠 둔다.
 *
 * 한국어 표기는 기존 화면과 한 글자도 다르지 않게 유지하고(2026. 8. 9),
 * 영어만 Intl에 맡긴다(Aug 9, 2026).
 */

/** 'YYYY-MM-DD HH:MM:SS'(UTC 가정) 또는 ISO 문자열 → Date */
function parseTimestamp(value: string): Date {
  return new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
}

/** 시점(UTC 저장) → 보는 사람의 시간대 기준 짧은 날짜. 값이 없으면 '-'. */
export function formatTimestampDate(
  value: string | null | undefined,
  locale: 'ko' | 'en'
): string {
  if (!value) return '-';
  const d = parseTimestamp(value);
  if (Number.isNaN(d.getTime())) return value;
  if (locale === 'en') {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  }
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
}
