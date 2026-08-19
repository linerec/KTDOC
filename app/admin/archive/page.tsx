/**
 * 내 참여 아카이브 (원생·학부모용) — 참여 수업 + 체크인 공연 통합
 *
 * 본인(학부모는 자녀)이 배정된 수업과 체크인한 공연을 연도별로 모아 보여준다.
 * 공연 카드를 누르면 콘솔 공연 상세, 수업 카드를 누르면 '내 수업' 상세로 이동.
 * 데이터: 체크인(D1 event_checkins) JOIN 공연 + 수강 배정(program_enrollments) JOIN 수업.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import {
  getUserCheckins,
  getUserCheckinsForUsers,
  getPreviewImagesForEvents,
  getEnrollmentsForUser,
  getEnrollmentsForUsers,
} from '@/lib/d1';
import { getGuardianView } from '@/lib/members';
import type { CheckedInEvent, EventImage } from '@/types/gallery';
import type { MemberRole } from '@/types/members';
import type { MyEnrollment } from '@/types/programs';
import ClassCard from '@/components/admin/ClassCard';
import ArchiveEventCard from '@/components/admin/library/ArchiveEventCard';
import T from '@/components/common/T';

export const metadata: Metadata = {
  title: '내 참여 아카이브 | KTDOC Admin',
};

/** 수업의 활동 연도 — 캠프는 시작일, 정규 수업은 학기 시작일, 없으면 배정일 기준. */
function classYear(e: MyEnrollment): number {
  const p = e.program;
  const src =
    (p.program_type === 'camp' ? p.start_date : p.term_start_date) || e.enrolled_at;
  const y = new Date(src).getFullYear();
  return Number.isNaN(y) ? new Date(e.enrolled_at).getFullYear() : y;
}

export default async function AdminArchivePage() {
  const session = await auth();
  await requireMenuAccess(session, 'archive');

  const role = (session?.user?.role ?? 'user') as MemberRole;
  const userId = session?.user?.id ?? '';

  // 학부모는 자녀들의 기록을 본다 — 체크인도 배정도 자녀 id 로 저장돼 있다.
  // (본인 id 로 체크인을 조회하면 대행 체크인을 아무리 해도 영원히 0건이다.)
  // 자녀 범위·이름표 규칙은 GuardianView 한 곳의 것을 쓴다.
  const guardian = await getGuardianView(role, userId);
  const isParent = guardian.isParent;

  const [rawCheckins, rawEnrollments] = await Promise.all([
    !userId
      ? Promise.resolve([] as (CheckedInEvent & { user_id?: string })[])
      : isParent
        ? getUserCheckinsForUsers(guardian.childIds)
        : getUserCheckins(userId),
    !userId
      ? Promise.resolve([] as MyEnrollment[])
      : isParent
        ? guardian.childIds.length > 0
          ? getEnrollmentsForUsers(guardian.childIds)
          : Promise.resolve([] as MyEnrollment[])
        : getEnrollmentsForUser(userId),
  ]);

  // 형제가 같은 공연·수업에 참여하면 행이 자녀 수만큼 온다 — 카드 하나로 접고
  // 소유자(자녀) id를 모아 이름표를 단다. "누구의 기록인지"가 학부모 화면의 핵심 정보다.
  const eventOwnerIds = new Map<number, string[]>();
  const mergedEvents = new Map<number, CheckedInEvent>();
  const checkins: CheckedInEvent[] = [];
  for (const ev of rawCheckins) {
    const ownerId = (ev as { user_id?: string }).user_id ?? null;
    const merged = mergedEvents.get(ev.id);
    if (merged) {
      const ids = eventOwnerIds.get(ev.id)!;
      if (ownerId && !ids.includes(ownerId)) ids.push(ownerId);
      // 병합 카드의 체크인 일시는 가장 이른 것으로 — 첫 행이 어느 자녀 것인지는
      // 정렬이 보장하지 않으므로, 임의의 한 자녀 값이 대표가 되지 않게 한다.
      if (ev.checked_in_at < merged.checked_in_at) merged.checked_in_at = ev.checked_in_at;
      continue;
    }
    mergedEvents.set(ev.id, ev);
    eventOwnerIds.set(ev.id, ownerId ? [ownerId] : []);
    checkins.push(ev);
  }

  // 수업은 상태까지 같을 때만 접는다 — 한 아이는 수강 중, 다른 아이는 대기인
  // 수업을 한 카드로 합치면 상태 배지가 거짓말을 한다.
  const classKey = (en: MyEnrollment) => `${en.program.id}:${en.status}`;
  const classOwnerIds = new Map<string, string[]>();
  const enrollments: MyEnrollment[] = [];
  for (const en of rawEnrollments) {
    if (en.status === 'cancelled') continue;
    const ids = classOwnerIds.get(classKey(en));
    if (ids) {
      if (!ids.includes(en.user_id)) ids.push(en.user_id);
      continue;
    }
    classOwnerIds.set(classKey(en), [en.user_id]);
    enrollments.push(en);
  }

  const previews: Map<number, EventImage[]> =
    checkins.length > 0
      ? await getPreviewImagesForEvents(checkins.map((e) => e.id), 3)
      : new Map();

  // 연도별로 공연·수업을 함께 묶는다.
  const years = new Map<number, { events: CheckedInEvent[]; classes: MyEnrollment[] }>();
  const ensureYear = (y: number) => {
    let bucket = years.get(y);
    if (!bucket) {
      bucket = { events: [], classes: [] };
      years.set(y, bucket);
    }
    return bucket;
  };
  for (const ev of checkins) ensureYear(ev.year).events.push(ev);
  for (const en of enrollments) {
    ensureYear(classYear(en)).classes.push(en);
  }

  const sortedYears = Array.from(years.keys()).sort((a, b) => b - a);
  const totalEvents = checkins.length;
  const totalClasses = enrollments.length;
  const isEmpty = totalEvents === 0 && totalClasses === 0;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <h1 className="admin-title">
            <T k="admin.nav.archive">내 참여 아카이브</T>
          </h1>
          <p className="admin-subtitle">
            <T k="admin.archive.subtitle">
              참여한 수업과 체크인한 공연을 연도별로 모았습니다. 카드를 누르면 상세가 열립니다.
            </T>
          </p>
        </div>
      </div>

      {isEmpty ? (
        <div className="admin-empty-state">
          <p>
            <T k="admin.archive.empty">아직 참여한 수업이나 체크인한 공연이 없습니다.</T>
          </p>
          <p className="admin-empty-sub">
            <T
              k="admin.archive.emptyHint"
              params={{
                browse: (
                  <Link href="/admin/library" className="admin-callout-link">
                    <T k="admin.nav.library">공연 둘러보기</T> →
                  </Link>
                ),
              }}
            >
              {'{browse}에서 참여한 공연에 체크인하거나, 운영진이 수업에 배정하면 이곳에 모입니다.'}
            </T>
          </p>
        </div>
      ) : (
        <>
          <div className="admin-filter-info">
            <T
              k="admin.archive.counts"
              params={{
                classes: <strong>{totalClasses}</strong>,
                events: <strong>{totalEvents}</strong>,
                years: sortedYears.length,
                list: sortedYears.join(', '),
              }}
            >
              {'참여 수업 {classes} · 참여 공연 {events} · 활동 연도 {years}개 ({list})'}
            </T>
          </div>

          <div className="library-content">
            {sortedYears.map((year) => {
              const bucket = years.get(year)!;
              return (
                <section key={year} className="library-year">
                  <h2 className="library-year-title">{year}</h2>

                  {bucket.classes.length > 0 && (
                    <div className="myclass-grid" style={{ marginBottom: '18px' }}>
                      {bucket.classes.map((en) => (
                        <ClassCard
                          key={`cls-${en.enrollment_id}`}
                          item={en}
                          ownerLabel={guardian.ownerLabel(classOwnerIds.get(classKey(en)) ?? [])}
                        />
                      ))}
                    </div>
                  )}

                  {bucket.events.length > 0 && (
                    <div className="library-grid">
                      {bucket.events.map((event) => (
                        <ArchiveEventCard
                          key={`ev-${event.id}`}
                          event={event}
                          strip={previews.get(event.id) ?? []}
                          ownerLabel={guardian.ownerLabel(eventOwnerIds.get(event.id) ?? [])}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
