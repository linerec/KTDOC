'use client';

/**
 * 알림 화면의 시각 표기 — 발송 이력과 현황이 같은 규칙을 쓴다
 *
 * 타임존을 하나로 고정하는 이유는 서버 렌더와 클라이언트 렌더를 일치시켜
 * 하이드레이션 불일치를 막기 위해서다(브라우저 타임존을 쓰면 둘이 어긋난다).
 *
 * 그 하나는 **학원이 있는 뉴저지 시간(America/New_York)**이다. 여기 찍히는 시각은
 * "언제 보냈나 / 언제 도착했나"를 운영진이 판단하는 근거이고, 그 판단은 학원의
 * 하루를 기준으로 이뤄진다. 한국 시간으로 찍으면 저녁에 보낸 알림이 다음 날로
 * 보여 이력을 읽을 수 없게 된다. (전에 Asia/Seoul로 고정돼 있었다.)
 *
 * 언어만 사용자 선호를 따른다 — SSR·하이드레이션 모두 기본값(ko)이라 어긋나지 않고,
 * 언어를 바꾼 뒤 다시 그릴 때만 표기가 따라간다.
 */

const TIME_ZONE = 'America/New_York';

function toDate(value: string): Date {
  return new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
}

function localeCode(locale: 'ko' | 'en'): string {
  return locale === 'en' ? 'en-US' : 'ko-KR';
}

/** '8. 9. 14:30' — 분 단위까지 */
export function formatWhen(value: string | null, locale: 'ko' | 'en'): string {
  if (!value) return '—';
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(localeCode(locale), {
    timeZone: TIME_ZONE,
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/** '2026. 8. 9.' — 날짜만 */
export function formatDay(value: string | null, locale: 'ko' | 'en'): string {
  if (!value) return '—';
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(localeCode(locale), {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(d);
}

/** '2026. 8. 9. 14:30' — 알림함처럼 연도까지 필요한 자리 */
export function formatInboxWhen(value: string | null, locale: 'ko' | 'en'): string {
  if (!value) return '—';
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(localeCode(locale), {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}
