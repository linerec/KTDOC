/**
 * 내 참여 아카이브 (원생·학부모용) — 참여 수업 + 체크인 이벤트 통합
 *
 * 본인(학부모는 자녀)이 배정된 수업과 체크인한 이벤트를 연도별로 모아 보여준다.
 * 이벤트 카드를 누르면 콘솔 이벤트 상세, 수업 카드를 누르면 '내 수업' 상세로 이동.
 * 데이터: 체크인(D1 event_checkins) JOIN 이벤트 + 수강 배정(program_enrollments) JOIN 수업.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import {
  getUserCheckins,
  getPreviewImagesForEvents,
  getEnrollmentsForUser,
  getEnrollmentsForUsers,
} from '@/lib/d1';
import { getGuardianChildren } from '@/lib/members';
import { formatEventDate, type CheckedInEvent, type EventImage } from '@/types/gallery';
import type { MemberRole } from '@/types/members';
import type { MyEnrollment } from '@/types/programs';
import ClassCard from '@/components/admin/ClassCard';

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

  async function loadEnrollments(): Promise<MyEnrollment[]> {
    if (!userId) return [];
    if (role === 'parent') {
      const children = await getGuardianChildren(userId);
      return children.length > 0
        ? getEnrollmentsForUsers(children.map((c) => c.studentId))
        : [];
    }
    return getEnrollmentsForUser(userId);
  }

  const [checkins, enrollments] = await Promise.all([
    userId ? getUserCheckins(userId) : Promise.resolve([] as CheckedInEvent[]),
    loadEnrollments(),
  ]);
  const previews: Map<number, EventImage[]> =
    checkins.length > 0
      ? await getPreviewImagesForEvents(checkins.map((e) => e.id), 3)
      : new Map();

  // 연도별로 이벤트·수업을 함께 묶는다.
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
    if (en.status === 'cancelled') continue;
    ensureYear(classYear(en)).classes.push(en);
  }

  const sortedYears = Array.from(years.keys()).sort((a, b) => b - a);
  const totalEvents = checkins.length;
  const totalClasses = enrollments.filter((e) => e.status !== 'cancelled').length;
  const isEmpty = totalEvents === 0 && totalClasses === 0;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <h1 className="admin-title">내 참여 아카이브</h1>
          <p className="admin-subtitle">
            참여한 수업과 체크인한 이벤트를 연도별로 모았습니다. 카드를 누르면 상세가 열립니다.
          </p>
        </div>
      </div>

      {isEmpty ? (
        <div className="admin-empty-state">
          <p>아직 참여한 수업이나 체크인한 이벤트가 없습니다.</p>
          <p className="admin-empty-sub">
            <Link href="/admin/library" className="admin-callout-link">
              이벤트 둘러보기 →
            </Link>
            에서 참여한 이벤트에 체크인하거나, 운영진이 수업에 배정하면 이곳에 모입니다.
          </p>
        </div>
      ) : (
        <>
          <div className="admin-filter-info">
            참여 수업 <strong>{totalClasses}</strong> · 참여 이벤트 <strong>{totalEvents}</strong>
            {' '}· 활동 연도 {sortedYears.length}개 ({sortedYears.join(', ')})
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
                        <ClassCard key={`cls-${en.enrollment_id}`} item={en} />
                      ))}
                    </div>
                  )}

                  {bucket.events.length > 0 && (
                    <div className="library-grid">
                      {bucket.events.map((event) => {
                        const strip = previews.get(event.id) ?? [];
                        const thumb =
                          event.thumbnail_url || event.poster_url || strip[0]?.image_url || null;
                        const isDraft = event.is_published === 0;
                        return (
                          <Link
                            key={`ev-${event.id}`}
                            href={`/admin/library/${event.id}`}
                            className="library-card"
                          >
                            <div className="library-card-thumb">
                              {thumb ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={thumb} alt={event.title_ko} loading="lazy" />
                              ) : (
                                <span className="library-card-thumb-empty">이미지 없음</span>
                              )}
                            </div>
                            <div className="library-card-body">
                              <span className="library-card-meta">
                                {event.category_name_ko && (
                                  <span className="library-card-category">
                                    {event.category_name_ko}
                                  </span>
                                )}
                                {isDraft && <span className="library-card-draft">비공개</span>}
                              </span>
                              <h3 className="library-card-title">{event.title_ko}</h3>
                              <p className="library-card-date">{event.event_date}</p>
                              <p className="archive-card-checkin">
                                참여 체크인 · {formatEventDate(event.checked_in_at, 'ko')}
                              </p>
                            </div>
                            {strip.length > 0 && (
                              <div className="archive-strip">
                                {strip.map((img) => (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img key={img.id} src={img.image_url} alt="" loading="lazy" />
                                ))}
                              </div>
                            )}
                          </Link>
                        );
                      })}
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
