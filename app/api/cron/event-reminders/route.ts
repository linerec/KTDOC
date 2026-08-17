/**
 * D-1 이벤트 리마인더 (Cron)
 *
 * 매일 실행되어 "내일" 열리는 이벤트의 참가자(체크인한 원생)와 그 보호자에게
 * 일정·장소·집합시간·준비물을 메일로 안내한다. 참가자에게만 보내므로 스팸이 아니다.
 *
 * 보안: CRON_SECRET이 설정돼 있으면 Authorization: Bearer <CRON_SECRET> 필요(Vercel Cron이 자동 첨부).
 *   미설정이면(초기/개발) 통과시키되 경고를 남긴다.
 * 스케줄: vercel.json 의 crons (매일).
 */

import { NextResponse } from 'next/server';
import { getEventsOnDate, getEventCheckins } from '@/lib/d1';
import { notifyEvent } from '@/lib/mail/notify';
import { formatEventDate, type EventWithCategory } from '@/types/gallery';

export const dynamic = 'force-dynamic';

/** 시각 정보 한 줄 — 집합·시작·종료 중 있는 것만 */
function buildWhen(event: EventWithCategory): string {
  const parts = [
    formatEventDate(event.event_date, 'ko'),
    event.call_time ? `집합 ${event.call_time}` : null,
    event.start_time ? `시작 ${event.start_time}` : null,
    event.end_time ? `종료 ${event.end_time}` : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

/** 준비물·지도 등 부가 안내 */
function buildNote(event: EventWithCategory): string {
  const lines = [
    event.location_url ? `지도: ${event.location_url}` : null,
    event.prep_notes ? `준비물·안내: ${event.prep_notes}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }
  } else {
    console.warn('[cron] CRON_SECRET 미설정 — 인증 없이 실행됨.');
  }

  // 내일 날짜('YYYY-MM-DD'). 정상 앱 코드라 Date 사용 가능.
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  try {
    const events = await getEventsOnDate(tomorrow);
    const results: { eventId: number; title: string; recipients: number; sent: boolean }[] = [];

    for (const event of events) {
      const checkins = await getEventCheckins(event.id);
      const studentIds = checkins.map((c) => c.user_id);
      if (studentIds.length === 0) {
        results.push({ eventId: event.id, title: event.title_ko, recipients: 0, sent: false });
        continue;
      }

      // 주소 수집·중복 제거·보호자 확장은 notifyEvent가 맡는다.
      // 여기서는 "누가 참여하는가"만 넘긴다.
      //
      // cron에서는 after()를 쓰지 않고 await 한다 — 응답 후 함수가 끝나면
      // 발송이 중간에 잘린다(기다리는 사용자도 없다).
      await notifyEvent('event.reminder', {
        userIds: studentIds,
        data: {
          title: event.title_ko,
          when: buildWhen(event),
          where: event.location ?? '',
          note: buildNote(event),
        },
      });

      results.push({
        eventId: event.id,
        title: event.title_ko,
        recipients: studentIds.length,
        sent: true,
      });
    }

    return NextResponse.json({
      success: true,
      date: tomorrow,
      // 발송 성패와 사유는 관리 콘솔의 '보낸 내역'에 남는다.
      events: results,
    });
  } catch (error) {
    console.error('[cron] event-reminders 실패:', error);
    return NextResponse.json({ success: false, error: '리마인더 처리 실패' }, { status: 500 });
  }
}
