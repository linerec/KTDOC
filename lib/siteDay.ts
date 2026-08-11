/**
 * lib/siteDay.ts — "지금 학원에서는 며칠인가"
 *
 * 서버는 UTC로 도는데 학원은 뉴저지에 있다. 그래서 `new Date()`나 SQLite의
 * `date('now')`로 오늘을 정하면 **매일 밤 몇 시간 동안 하루가 어긋난다**:
 * 뉴저지 저녁 8시는 이미 UTC로 다음 날이다. 목록 정렬이라면 무해하지만
 * "오늘 이 행사를 합니다"에는 치명적이다 — 행사 당일 저녁에 그 배너가
 * 사라지거나, 전날 저녁부터 하루 일찍 떠 버린다.
 *
 * 그래서 날짜 경계는 항상 학원 시간대로 판단한다. 시간대의 단일 출처는
 * 캘린더 설정(lib/calendar.ts)이다 — .ics 피드가 행사 시각을 해석하는 기준과
 * 같아야 둘이 어긋나지 않는다.
 */

/**
 * 주어진 순간을 그 시간대의 달력 날짜('YYYY-MM-DD')로 옮긴다.
 *
 * toISOString().slice(0,10)은 UTC 날짜라 쓸 수 없고, en-CA 로케일이 우연히
 * ISO 모양을 준다는 사실에 기대는 것도 ICU 버전에 따라 흔들린다.
 * 그래서 부분(part)을 직접 꺼내 조립한다.
 */
export function dayInTimeZone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const get = (type: 'year' | 'month' | 'day') =>
    parts.find((p) => p.type === type)?.value ?? '';

  return `${get('year')}-${get('month')}-${get('day')}`;
}
