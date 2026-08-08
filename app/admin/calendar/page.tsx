/**
 * Admin Calendar Feed — 캘린더 구독 피드 관리
 * 관리자가 공개 .ics 피드를 켜고(이름/설명/타임존/포함범위) 구독 주소를 원생·선생님에게 공유한다.
 */

import Link from 'next/link';
import { headers } from 'next/headers';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getCalendarConfig } from '@/lib/calendar';
import { getEvents, getPrograms, allKindsChronological} from '@/lib/d1';
import CalendarFeedManager from '@/components/admin/calendar/CalendarFeedManager';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '캘린더 구독 | KTDOC Admin',
};

async function resolveFeedUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || 'ktdoc.org';
  const proto = h.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}/calendar.ics`;
}

export default async function AdminCalendarPage() {
  const session = await auth();
  await requireMenuAccess(session, 'calendar');

  const [config, feedUrl, eventsResult, campsResult] = await Promise.all([
    getCalendarConfig(),
    resolveFeedUrl(),
    getEvents(allKindsChronological()).catch(() => ({ events: [], total: 0, years: [] })),
    getPrograms({ type: 'camp', published: true, limit: 200 }).catch(() => ({ programs: [], total: 0 })),
  ]);

  const eventCount = eventsResult.events.filter((e) => !!e.event_date).length;
  const campCount = campsResult.programs.filter((p) => !!p.start_date).length;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">홈</Link>
            <span>/</span>
            <span>캘린더 구독</span>
          </div>
          <h1 className="admin-title">캘린더 구독 피드</h1>
          <p className="admin-subtitle">
            원생·선생님이 이 주소를 한 번 구독하면, 공연·행사·캠프를 등록·수정·삭제할 때
            각자의 휴대폰·PC 캘린더(애플·구글·아웃룩)에 자동으로 반영됩니다.
          </p>
        </div>
      </div>

      <CalendarFeedManager
        initialConfig={config}
        feedUrl={feedUrl}
        eventCount={eventCount}
        campCount={campCount}
      />
    </div>
  );
}
