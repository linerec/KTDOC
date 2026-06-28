/**
 * 공개 캘린더 구독 피드 — GET /calendar.ics
 *
 * 애플·구글·아웃룩 등에서 이 URL(webcal://...)을 한 번 구독하면, 이벤트가
 * 등록/수정/삭제될 때마다 각 캘린더 앱의 새로고침 주기에 맞춰 자동 반영된다.
 * (피드는 매 요청 시 D1에서 생성되므로 별도 푸시 코드가 필요 없다.)
 */

import { getCalendarConfig, getCalendarEvents } from '@/lib/calendar';
import { buildICS } from '@/lib/ical';

export const dynamic = 'force-dynamic';

/** 프록시(x-forwarded-*)를 고려해 요청 기준 절대 URL 베이스를 도출한다. */
function resolveBaseUrl(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') || url.host;
  const proto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
  return `${proto}://${host}`;
}

export async function GET(request: Request) {
  try {
    const baseUrl = resolveBaseUrl(request);
    const config = await getCalendarConfig();

    // 비활성화 시 유효하지만 빈 캘린더를 반환(구독자는 깨지지 않는다).
    const events = config.enabled ? await getCalendarEvents(baseUrl, config) : [];

    const ics = buildICS(events, {
      tz: config.timezone,
      prodId: '-//KTDOC//Choomnoori Calendar//KO',
      calName: config.name,
      calDesc: config.description,
    });

    return new Response(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="ktdoc.ics"',
        // 클라이언트는 자체 주기로 폴링하므로 CDN만 짧게 캐싱하고 백그라운드 재검증.
        'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Calendar feed error:', error);
    // 일시적 오류 시 구독자는 직전 사본을 유지하므로 500 반환이 안전하다.
    return new Response('Calendar feed temporarily unavailable', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
