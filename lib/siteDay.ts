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

/**
 * 학원 기준 하루('YYYY-MM-DD')의 시작·끝을 **UTC 타임스탬프 문자열**로 돌려준다.
 * 형식은 `'YYYY-MM-DD HH:MM:SS'` — SQLite `datetime('now')`가 쓰는 모양이라
 * 그대로 문자열 비교에 넣을 수 있다. 끝(end)은 다음 날 시작이므로 **미만**으로 쓴다.
 *
 * 문자열 접두사(`substr(created_at,1,10) = '오늘'`)로 세면 시간대 차이만큼
 * 어긋난다 — 뉴저지 저녁 8시에 찍힌 행은 UTC로 이미 다음 날이라 오늘 집계에서
 * 빠진다. 그래서 경계를 UTC 구간으로 환산해 비교한다.
 *
 * 오프셋은 그 날 **정오**를 기준으로 잰다. 자정 근처는 서머타임 전환과 겹쳐
 * 오프셋이 흔들리는 자리다(전환일에도 정오는 항상 한쪽에 확실히 속한다).
 */
export function siteDayUtcRange(
  siteDay: string,
  timeZone: string
): { start: string; end: string } {
  const noonUtc = new Date(`${siteDay}T12:00:00Z`);

  // 같은 순간을 두 시간대로 문자열화한 뒤 다시 파싱한다. 두 값 모두 시스템
  // 시간대로 파싱되므로 시스템 설정과 무관하게 '차이'만 정확히 남는다.
  const asLocal = new Date(noonUtc.toLocaleString('en-US', { timeZone }));
  const asUtc = new Date(noonUtc.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offsetMs = asUtc.getTime() - asLocal.getTime();

  const startUtc = new Date(`${siteDay}T00:00:00Z`).getTime() + offsetMs;
  const endUtc = startUtc + 24 * 60 * 60 * 1000;

  const fmt = (ms: number) =>
    new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
  return { start: fmt(startUtc), end: fmt(endUtc) };
}
