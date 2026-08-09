/**
 * 참여 현황 (운영진·관계자 검증용)
 *
 * 공연별로 체크인한 참가자 수와 명단을 보여준다. 학생 본인 체크인 데이터를 바탕으로
 * 운영진·관계 기관이 각 공연의 참여도를 확인·검증할 수 있다.
 * 접근: 운영진(선생님·관리자). 데이터: 참가 = D1(event_checkins), 이름 = MySQL(users).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getEventsWithParticipantCounts, getCheckinsForEvents } from '@/lib/d1';
import { getUserNamesByIds } from '@/lib/members';
import { formatTimestampDate } from '@/lib/i18n/formatDate';
import T from '@/components/common/T';
import LocaleText from '@/components/common/LocaleText';

export const metadata: Metadata = {
  title: '참여 현황 | KTDOC Admin',
};

export default async function AdminParticipationPage() {
  const session = await auth();
  await requireMenuAccess(session, 'participation');

  const events = await getEventsWithParticipantCounts();
  const checkins = await getCheckinsForEvents(events.map((e) => e.event_id));
  const names = await getUserNamesByIds(checkins.map((c) => c.user_id));

  // 공연별 참가자 그룹화(checkins는 이미 체크인 시각 오름차순)
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
            <Link href="/admin">
              <T k="admin.common.breadcrumbHome">관리 홈</T>
            </Link>
            <span>/</span>
            <span>
              <T k="admin.nav.participation">참여 현황</T>
            </span>
          </div>
          <h1 className="admin-title">
            <T k="admin.nav.participation">참여 현황</T>
          </h1>
          <p className="admin-subtitle">
            <T k="admin.participation.subtitle">
              공연별로 체크인한 참가자 수와 명단을 확인합니다. 수강생의 참여 기록을 바탕으로
              집계됩니다.
            </T>
          </p>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="admin-empty-state">
          <p>
            <T k="admin.participation.empty">아직 참가 기록이 있는 공연이 없습니다.</T>
          </p>
          <p className="admin-empty-sub">
            <T k="admin.participation.emptyHint">
              수강생이 둘러보기에서 본인이 참여한 공연에 체크인하면 이곳에 집계됩니다.
            </T>
          </p>
        </div>
      ) : (
        <>
          <div className="admin-filter-info">
            <T
              k="admin.participation.counts"
              params={{
                events: <strong>{events.length}</strong>,
                people: <strong>{totalAttendance}</strong>,
              }}
            >
              {'참가 기록 있는 공연 {events}개 · 누적 참가 연인원 {people}명'}
            </T>
          </div>

          <div className="participation-list">
            {events.map((event) => {
              const participants = byEvent.get(event.event_id) ?? [];
              return (
                <section key={event.event_id} className="participation-card">
                  <div className="participation-card-head">
                    <div className="participation-card-title">
                      <h2>
                        <LocaleText ko={event.title_ko} en={event.title_en} />
                      </h2>
                      <span className="participation-card-date">
                        {event.year} · {event.event_date}
                        {event.is_published === 0 && (
                          <span className="participation-badge-draft">
                            <T k="admin.common.unpublished">비공개</T>
                          </span>
                        )}
                      </span>
                    </div>
                    <span className="participation-count">
                      <T
                        k="admin.participation.countLabel"
                        params={{ n: <strong>{event.participant_count}</strong> }}
                      >
                        {'참가 {n}명'}
                      </T>
                    </span>
                  </div>
                  <ul className="participation-people">
                    {participants.map((c) => (
                      <li key={c.id} className="participation-person">
                        <span className="participation-person-name">
                          {names.get(c.user_id) || <T k="admin.library.unknownName">이름 미상</T>}
                        </span>
                        <span className="participation-person-date">
                          <LocaleText
                            ko={formatTimestampDate(c.checked_in_at, 'ko')}
                            en={formatTimestampDate(c.checked_in_at, 'en')}
                          />
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
