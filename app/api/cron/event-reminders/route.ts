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
import { getUsersByIds, getGuardianEmailsForStudents } from '@/lib/members';
import { sendMail, isMailConfigured } from '@/lib/mail';
import { formatEventDate, type EventWithCategory } from '@/types/gallery';

export const dynamic = 'force-dynamic';

function buildBody(event: EventWithCategory): string {
  const lines = [
    `${event.title_ko} 안내`,
    '',
    '내일 일정이 있어 안내드립니다.',
    `· 날짜: ${formatEventDate(event.event_date, 'ko')}`,
    event.location ? `· 장소: ${event.location}` : null,
    event.location_url ? `· 지도: ${event.location_url}` : null,
    event.call_time ? `· 집합 시간: ${event.call_time}` : null,
    event.start_time ? `· 시작 시간: ${event.start_time}` : null,
    event.end_time ? `· 종료 시간: ${event.end_time}` : null,
    event.prep_notes ? `· 준비물·안내: ${event.prep_notes}` : null,
    '',
    'KTDOC 춤누리 한국전통무용단',
  ];
  return lines.filter((l) => l !== null).join('\n');
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

      const students = await getUsersByIds(studentIds);
      const guardianMap = await getGuardianEmailsForStudents(studentIds);

      const emails = new Set<string>();
      for (const s of students) if (s.email) emails.add(s.email);
      for (const list of guardianMap.values()) for (const e of list) emails.add(e);

      const recipients = Array.from(emails);
      let sent = false;
      if (recipients.length > 0) {
        // 수신자 노출 방지를 위해 BCC로 단체 발송.
        sent = await sendMail({
          subject: `[KTDOC] 내일 일정 안내 — ${event.title_ko}`,
          text: buildBody(event),
          bcc: recipients,
        });
      }
      results.push({ eventId: event.id, title: event.title_ko, recipients: recipients.length, sent });
    }

    return NextResponse.json({
      success: true,
      date: tomorrow,
      mailConfigured: isMailConfigured(),
      events: results,
    });
  } catch (error) {
    console.error('[cron] event-reminders 실패:', error);
    return NextResponse.json({ success: false, error: '리마인더 처리 실패' }, { status: 500 });
  }
}
