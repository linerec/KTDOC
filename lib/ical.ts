/**
 * iCalendar(.ics) 빌더 — RFC 5545
 *
 * D1 타입과 분리된 순수 유틸. 구독형 캘린더 피드 생성에 사용한다.
 * - 텍스트 이스케이프(`\`, `;`, `,`, 개행)
 * - 75옥텟 라인 폴딩(바이트 기준 — 한글 멀티바이트 안전)
 * - 벽시계(예: America/New_York) → UTC 변환으로 VTIMEZONE 없이도 모든 캘린더 앱과 호환
 * - 시각이 있으면 타임드(UTC), 없으면 종일(VALUE=DATE) 이벤트
 */

/** 캘린더 한 항목. 날짜는 'YYYY-MM-DD', 시각은 'HH:MM' 문자열. */
export interface ICSEvent {
  /** 안정적인 고유 식별자(예: `event-12@ktdoc.org`). 변경/삭제 동기화의 기준. */
  uid: string;
  /** 시작 날짜 'YYYY-MM-DD' */
  start: string;
  /** 시작 시각 'HH:MM' — 없으면 종일 이벤트 */
  startTime?: string | null;
  /** 종료 날짜 'YYYY-MM-DD' — 종일 다중일(예: 캠프) 표현용 */
  end?: string | null;
  /** 종료 시각 'HH:MM' */
  endTime?: string | null;
  summary: string;
  description?: string | null;
  location?: string | null;
  /** 상세 페이지 링크(URI) */
  url?: string | null;
  /** 생성 시각(SQLite datetime, UTC). 'YYYY-MM-DD HH:MM:SS' */
  created?: string | null;
  /** 수정 시각(SQLite datetime, UTC). 클라이언트의 변경 감지를 돕는다. */
  lastModified?: string | null;
}

export interface BuildICSOptions {
  /** IANA 타임존(예: 'America/New_York') */
  tz: string;
  prodId: string;
  calName: string;
  calDesc?: string;
  /** 클라이언트 권장 새로고침 주기(ISO 8601 duration). 기본 PT6H */
  refreshInterval?: string;
}

/** 시각이 없는데 종료도 없을 때 타임드 이벤트의 기본 길이(2시간) */
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** TEXT 값 이스케이프 (RFC 5545 §3.3.11) */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\n|\r/g, '\\n');
}

/**
 * 콘텐츠 라인을 75옥텟 기준으로 폴딩한다.
 * 이어지는 줄은 선행 공백 1옥텟을 포함해 75옥텟을 넘지 않도록 74옥텟까지만 담는다.
 */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  let result = '';
  let current = '';
  let currentBytes = 0;
  let isFirstChunk = true;

  for (const ch of line) {
    const chBytes = encoder.encode(ch).length;
    const limit = isFirstChunk ? 75 : 74;
    if (currentBytes + chBytes > limit) {
      result += (result ? '\r\n ' : '') + current;
      isFirstChunk = false;
      current = ch;
      currentBytes = chBytes;
    } else {
      current += ch;
      currentBytes += chBytes;
    }
  }
  result += (result ? '\r\n ' : '') + current;
  return result;
}

/** Date → 'YYYYMMDDTHHMMSSZ' (UTC) */
function toICSUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}` +
    `T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`
  );
}

/** 'YYYY-MM-DD' → 'YYYYMMDD' (종일 이벤트 DATE 값) */
function toICSDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

/** 'YYYY-MM-DD'에 days를 더해 'YYYYMMDD'를 반환(종일 DTEND는 배타적) */
function shiftDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}${pad2(dt.getUTCMonth() + 1)}${pad2(dt.getUTCDate())}`;
}

/** SQLite datetime('now')('YYYY-MM-DD HH:MM:SS', UTC) → 'YYYYMMDDTHHMMSSZ' */
function sqliteToICSUtc(value: string): string | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return `${m[1]}${m[2]}${m[3]}T${m[4]}${m[5]}${m[6]}Z`;
}

/** 'HH:MM'(또는 'H:MM') 파싱 → [hour, minute] | null */
function parseHM(value: string): [number, number] | null {
  const m = value.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return [hour, minute];
}

/** 특정 타임존에서 instant의 오프셋(ms)을 구한다. */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return asUTC - date.getTime();
}

/**
 * 주어진 타임존의 벽시계 시각을 실제 UTC instant로 변환한다.
 * (DST 경계 보정을 위해 1회 재계산)
 */
function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset = timeZoneOffsetMs(new Date(guess), timeZone);
  let result = new Date(guess - offset);
  const offset2 = timeZoneOffsetMs(result, timeZone);
  if (offset2 !== offset) {
    result = new Date(guess - offset2);
  }
  return result;
}

/** 이벤트의 시작/종료를 종일/타임드로 해석한다(DTSTART/DTEND·구글 dates 공용). */
type EventRange =
  | { allDay: true; startDate: string; endDateExclusive: string } // 'YYYYMMDD'
  | { allDay: false; startUtc: Date; endUtc: Date };

function resolveEventRange(event: ICSEvent, tz: string): EventRange {
  const hm = event.startTime ? parseHM(event.startTime) : null;
  if (hm) {
    // 타임드 이벤트 — 벽시계를 UTC로 변환
    const [y, mo, d] = event.start.split('-').map(Number);
    const startUtc = zonedWallTimeToUtc(y, mo, d, hm[0], hm[1], tz);
    let endUtc: Date;
    const endHm = event.endTime ? parseHM(event.endTime) : null;
    if (endHm) {
      const candidate = zonedWallTimeToUtc(y, mo, d, endHm[0], endHm[1], tz);
      endUtc =
        candidate.getTime() > startUtc.getTime()
          ? candidate
          : new Date(startUtc.getTime() + DEFAULT_DURATION_MS);
    } else {
      endUtc = new Date(startUtc.getTime() + DEFAULT_DURATION_MS);
    }
    return { allDay: false, startUtc, endUtc };
  }
  // 종일 이벤트 — DTEND는 배타적(종료일 + 1)
  return {
    allDay: true,
    startDate: toICSDate(event.start),
    endDateExclusive: event.end ? shiftDateStr(event.end, 1) : shiftDateStr(event.start, 1),
  };
}

/**
 * Google Calendar "URL로 추가(TEMPLATE)" 링크의 `dates=` 파라미터 값을 만든다.
 * 타임드: `YYYYMMDDTHHMMSSZ/YYYYMMDDTHHMMSSZ`(UTC), 종일: `YYYYMMDD/YYYYMMDD`(배타적).
 */
export function googleCalendarDates(event: ICSEvent, tz: string): string {
  const r = resolveEventRange(event, tz);
  return r.allDay
    ? `${r.startDate}/${r.endDateExclusive}`
    : `${toICSUtc(r.startUtc)}/${toICSUtc(r.endUtc)}`;
}

/** 단일 VEVENT 블록 라인들을 생성한다. */
function buildVEvent(event: ICSEvent, dtstamp: string, tz: string): string[] {
  const lines: string[] = ['BEGIN:VEVENT', `UID:${event.uid}`, `DTSTAMP:${dtstamp}`];

  const range = resolveEventRange(event, tz);
  if (range.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${range.startDate}`);
    lines.push(`DTEND;VALUE=DATE:${range.endDateExclusive}`);
  } else {
    lines.push(`DTSTART:${toICSUtc(range.startUtc)}`);
    lines.push(`DTEND:${toICSUtc(range.endUtc)}`);
  }

  lines.push(`SUMMARY:${escapeText(event.summary)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  // URL 값 타입은 URI — TEXT 이스케이프를 적용하지 않는다.
  if (event.url) lines.push(`URL:${event.url}`);
  if (event.created) {
    const created = sqliteToICSUtc(event.created);
    if (created) lines.push(`CREATED:${created}`);
  }
  if (event.lastModified) {
    const modified = sqliteToICSUtc(event.lastModified);
    if (modified) lines.push(`LAST-MODIFIED:${modified}`);
  }
  lines.push('END:VEVENT');
  return lines;
}

/** ICSEvent 목록으로 완성된 VCALENDAR 문자열(CRLF 종결)을 만든다. */
export function buildICS(events: ICSEvent[], options: BuildICSOptions): string {
  const dtstamp = toICSUtc(new Date());
  const refresh = options.refreshInterval ?? 'PT6H';

  const rawLines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${options.prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(options.calName)}`,
  ];
  if (options.calDesc) rawLines.push(`X-WR-CALDESC:${escapeText(options.calDesc)}`);
  rawLines.push(`X-WR-TIMEZONE:${options.tz}`);
  rawLines.push(`REFRESH-INTERVAL;VALUE=DURATION:${refresh}`);
  rawLines.push(`X-PUBLISHED-TTL:${refresh}`);

  for (const event of events) {
    rawLines.push(...buildVEvent(event, dtstamp, options.tz));
  }

  rawLines.push('END:VCALENDAR');

  return rawLines.map(foldLine).join('\r\n') + '\r\n';
}
