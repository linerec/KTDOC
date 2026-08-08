/**
 * 공개 캘린더 피드 데이터 — D1의 공연/행사(events)와 캠프(programs)를 ICSEvent[]로 매핑.
 *
 * 공개 피드이므로 published 항목만, 그리고 내부 정보(집합시간 call_time·준비물 prep_notes)는 제외한다.
 * 피드는 매 요청 시 DB에서 생성되므로 이벤트 등록/수정/삭제가 자동으로 반영된다.
 *
 * 캘린더 이름·설명·타임존·포함범위·활성화는 관리자가 /admin/calendar에서 설정하며
 * D1 site_settings(`calendar.config`)에 JSON으로 저장된다.
 */

import { getEvents, getPrograms, getSetting, SETTING_CALENDAR_CONFIG, allKindsChronological} from '@/lib/d1';
import { googleCalendarDates, type ICSEvent } from '@/lib/ical';
import type { Event } from '@/types/gallery';

/** UID 도메인 — 변경/삭제 동기화를 위해 안정적으로 유지한다. */
const UID_DOMAIN = 'ktdoc.org';

/** 관리자 설정(캘린더 피드). 미설정 시 DEFAULT_CALENDAR_CONFIG가 적용된다. */
export interface CalendarConfig {
  /** 캘린더 표시 이름 (구독한 앱에 보이는 이름, X-WR-CALNAME) */
  name: string;
  /** 캘린더 설명 (X-WR-CALDESC) */
  description: string;
  /** IANA 타임존 (이벤트 시각 해석 기준) */
  timezone: string;
  /** 피드 활성화 여부. false면 빈 캘린더를 반환한다. */
  enabled: boolean;
  /** 공연·행사(events) 포함 */
  includeEvents: boolean;
  /** 캠프(programs, type=camp) 포함 */
  includeCamps: boolean;
}

export const DEFAULT_CALENDAR_CONFIG: CalendarConfig = {
  name: '춤누리 일정',
  description: '춤누리 한국전통무용학원 공연·행사·캠프 일정',
  // 학원 소재지 기준. 관리자가 미설정이면 env → 뉴저지(America/New_York) 순으로 폴백.
  timezone: process.env.CALENDAR_TIMEZONE || 'America/New_York',
  enabled: true,
  includeEvents: true,
  includeCamps: true,
};

/** D1에 저장된 캘린더 설정을 읽어 기본값과 병합한다. 실패 시 기본값. */
export async function getCalendarConfig(): Promise<CalendarConfig> {
  try {
    const raw = await getSetting(SETTING_CALENDAR_CONFIG);
    if (!raw) return { ...DEFAULT_CALENDAR_CONFIG };
    const parsed = JSON.parse(raw) as Partial<CalendarConfig>;
    return {
      name: parsed.name?.trim() || DEFAULT_CALENDAR_CONFIG.name,
      description: parsed.description?.trim() || DEFAULT_CALENDAR_CONFIG.description,
      timezone: parsed.timezone?.trim() || DEFAULT_CALENDAR_CONFIG.timezone,
      // 명시적으로 false일 때만 끈다(미지정/누락은 기본 true).
      enabled: parsed.enabled !== false,
      includeEvents: parsed.includeEvents !== false,
      includeCamps: parsed.includeCamps !== false,
    };
  } catch {
    return { ...DEFAULT_CALENDAR_CONFIG };
  }
}

/** 여러 줄/과한 공백을 정리한 평문 설명을 만든다. */
function toPlainDescription(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** 공연·행사(events) 한 건을 ICSEvent로 변환(피드·단일 .ics 공용). */
export function eventToICSEvent(ev: Event, baseUrl: string): ICSEvent {
  return {
    uid: `event-${ev.id}@${UID_DOMAIN}`,
    start: ev.event_date,
    startTime: ev.start_time,
    endTime: ev.end_time,
    summary: ev.title_ko || ev.title_en || '행사',
    description: toPlainDescription(ev.description_ko || ev.description_en),
    // 장소명 + 주소 — 캘린더 앱이 주소로 지도를 연결할 수 있게 둘 다 담는다
    location: [ev.location, ev.location_address].filter(Boolean).join(', ') || null,
    geo:
      ev.location_lat !== null && ev.location_lng !== null
        ? { lat: ev.location_lat, lng: ev.location_lng }
        : null,
    // 한글 slug는 퍼센트 인코딩(ICS URL은 URI 값 타입)
    url: `${baseUrl}/gallery/${ev.year}/${encodeURIComponent(ev.slug)}`,
    created: ev.created_at,
    lastModified: ev.updated_at,
  };
}

/**
 * 이벤트 1건을 "내 캘린더에 추가"하는 링크들을 만든다.
 * - icsUrl: 단일 .ics 다운로드(애플/iOS/Mac/Outlook에서 일회성 추가)
 * - googleUrl: Google Calendar TEMPLATE(미리 채워진 새 일정) 링크
 */
export function buildAddToCalendarLinks(
  ev: Event,
  baseUrl: string,
  tz: string
): { icsUrl: string; googleUrl: string } {
  const ics = eventToICSEvent(ev, baseUrl);
  const params = new URLSearchParams();
  params.set('action', 'TEMPLATE');
  params.set('text', ics.summary);
  params.set('dates', googleCalendarDates(ics, tz));
  if (ics.location) params.set('location', ics.location);
  const details = [ics.description, ics.url].filter(Boolean).join('\n\n');
  if (details) params.set('details', details);
  return {
    icsUrl: `${baseUrl}/api/calendar/event/${ev.id}`,
    googleUrl: `https://calendar.google.com/calendar/render?${params.toString()}`,
  };
}

/**
 * 공개 구독 피드에 포함할 모든 일정을 반환한다(설정의 포함범위 반영).
 * @param baseUrl 절대 URL 베이스(예: https://ktdoc.org) — 이벤트 상세 링크 생성에 사용
 * @param config  포함범위 등 설정. 생략 시 D1에서 읽는다.
 */
export async function getCalendarEvents(
  baseUrl: string,
  config?: CalendarConfig
): Promise<ICSEvent[]> {
  const cfg = config ?? (await getCalendarConfig());
  const items: ICSEvent[] = [];

  // 공연·행사 — event_date(날짜) + start_time/end_time(시각, 선택)
  if (cfg.includeEvents) {
    const { events } = await getEvents(allKindsChronological());
    for (const ev of events) {
      if (!ev.event_date) continue;
      items.push(eventToICSEvent(ev, baseUrl));
    }
  }

  // 캠프 — start_date~end_date 종일(다중일) 이벤트
  if (cfg.includeCamps) {
    const { programs } = await getPrograms({ type: 'camp', published: true, limit: 200 });
    for (const p of programs) {
      if (!p.start_date) continue;
      items.push({
        uid: `camp-${p.id}@${UID_DOMAIN}`,
        start: p.start_date,
        end: p.end_date,
        summary: `[캠프] ${p.title_ko || p.title_en || '캠프'}`,
        description: toPlainDescription(p.summary_ko || p.description_ko),
        location: p.location_ko,
        url: `${baseUrl}/classes/${encodeURIComponent(p.slug)}`,
        created: p.created_at,
        lastModified: p.updated_at,
      });
    }
  }

  return items;
}
