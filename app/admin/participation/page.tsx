/**
 * 참여 현황 (운영진·관계자 검증용)
 *
 * 이벤트별로 체크인한 참가자 수와 명단을 보여준다. 학생 본인 체크인 데이터를 바탕으로
 * 운영진·관계 기관이 각 공연·이벤트의 참여도를 확인·검증할 수 있다.
 * 접근: 운영진(선생님·관리자). 데이터: 참가 = D1(event_checkins), 이름 = MySQL(users).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getEventsWithParticipantCounts, getCheckinsForEvents } from '@/lib/d1';
import { getUserNamesByIds } from '@/lib/members';
import { formatEventDate } from '@/types/gallery';

export const metadata: Metadata = {
  title: '참여 현황 | KTDOC Admin',
};

export default async function AdminParticipationPage() {
  const session = await auth();
  await requireMenuAccess(session, 'participation');

  const events = await getEventsWithParticipantCounts();
  const checkins = await getCheckinsForEvents(events.map((e) => e.event_id));
  const names = await getUserNamesByIds(checkins.map((c) => c.user_id));

  // 이벤트별 참가자 그룹화(checkins는 이미 체크인 시각 오름차순)
  const byEvent = new Map<number, typeof checkins>();
  for (const c of checkins) {
    const list = byEvent.get(c.event_id) ?? [];
    list.push(c);
    byEvent.set(c.event_id, list);
  }

  const totalAttendance = events.reduce((sum, e) => sum + e.participant_count, 0);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <span>참여 현황</span>
          </div>
          <h1 className="admin-title">참여 현황</h1>
          <p className="admin-subtitle">
            이벤트별로 체크인한 참가자 수와 명단을 확인합니다. 수강생의 참여 기록을 바탕으로 집계됩니다.
          </p>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="admin-empty-state">
          <p>아직 참가 기록이 있는 이벤트가 없습니다.</p>
          <p className="admin-empty-sub">
            수강생이 둘러보기에서 본인이 참여한 공연에 체크인하면 이곳에 집계됩니다.
          </p>
        </div>
      ) : (
        <>
          <div className="admin-filter-info">
            참가 기록 있는 이벤트 <strong>{events.length}</strong>개 · 누적 참가 연인원{' '}
            <strong>{totalAttendance}</strong>명
          </div>

          <div className="participation-list">
            {events.map((event) => {
              const participants = byEvent.get(event.event_id) ?? [];
              return (
                <section key={event.event_id} className="participation-card">
                  <div className="participation-card-head">
                    <div className="participation-card-title">
                      <h2>{event.title_ko}</h2>
                      <span className="participation-card-date">
                        {event.year} · {event.event_date}
                        {event.is_published === 0 && (
                          <span className="participation-badge-draft">비공개</span>
                        )}
                      </span>
                    </div>
                    <span className="participation-count">
                      참가 <strong>{event.participant_count}</strong>명
                    </span>
                  </div>
                  <ul className="participation-people">
                    {participants.map((c) => (
                      <li key={c.id} className="participation-person">
                        <span className="participation-person-name">
                          {names.get(c.user_id) || '이름 미상'}
                        </span>
                        <span className="participation-person-date">
                          {formatEventDate(c.checked_in_at, 'ko')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
