/**
 * 단일 이벤트 .ics 다운로드 — GET /api/calendar/event/[id]
 *
 * 구독(피드)이 아니라 "이 일정 하나를 내 캘린더에 즉시 추가"하는 일회성 .ics.
 * 애플/iOS/Mac/Outlook에서 파일을 열면 추가 다이얼로그가 뜬다. 공개 이벤트만 제공한다.
 */

import { getEventById } from '@/lib/d1';
import { getCalendarConfig, eventToICSEvent } from '@/lib/calendar';
import { buildICS } from '@/lib/ical';

export const dynamic = 'force-dynamic';

function resolveBaseUrl(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') || url.host;
  const proto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
  return `${proto}://${host}`;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const eventId = parseInt(id, 10);
    if (Number.isNaN(eventId)) {
      return new Response('Bad request', { status: 400 });
    }

    const event = await getEventById(eventId);
    if (!event || !event.is_published || !event.event_date) {
      return new Response('Not found', { status: 404 });
    }

    const baseUrl = resolveBaseUrl(request);
    const config = await getCalendarConfig();
    const ics = buildICS([eventToICSEvent(event, baseUrl)], {
      tz: config.timezone,
      prodId: '-//KTDOC//Choomnoori Calendar//KO',
      calName: event.title_ko || '행사',
    });

    return new Response(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        // ASCII 파일명(한글 제목은 헤더 인코딩 이슈가 있어 id 기반으로 고정)
        'Content-Disposition': `attachment; filename="event-${eventId}.ics"`,
        'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Single event ICS error:', error);
    return new Response('Calendar event temporarily unavailable', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
