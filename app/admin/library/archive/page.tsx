/**
 * 내 참여 아카이브 (학생용)
 *
 * 본인이 체크인한 이벤트를 연도별로 모아, 각 이벤트의 사진 미리보기와 함께 보여준다.
 * 카드를 누르면 공개 갤러리의 이벤트 상세(전체 사진·영상)로 이동한다.
 * 데이터: 체크인(D1 event_checkins) JOIN 이벤트 + 이벤트별 미리보기 이미지(배치 조회).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getUserCheckins, getPreviewImagesForEvents } from '@/lib/d1';
import { formatEventDate, type CheckedInEvent, type EventImage } from '@/types/gallery';

export const metadata: Metadata = {
  title: '내 참여 아카이브 | KTDOC Admin',
};

function groupByYear(events: CheckedInEvent[]): Map<number, CheckedInEvent[]> {
  const grouped = new Map<number, CheckedInEvent[]>();
  for (const event of events) {
    const list = grouped.get(event.year) ?? [];
    list.push(event);
    grouped.set(event.year, list);
  }
  return grouped;
}

export default async function AdminLibraryArchivePage() {
  const session = await auth();
  await requireMenuAccess(session, 'library.archive');

  const userId = session?.user?.id ?? '';
  const checkins = userId ? await getUserCheckins(userId) : [];
  const previews: Map<number, EventImage[]> =
    checkins.length > 0
      ? await getPreviewImagesForEvents(checkins.map((e) => e.id), 3)
      : new Map();

  const grouped = groupByYear(checkins);
  const sortedYears = Array.from(grouped.keys()).sort((a, b) => b - a);
  const yearCount = sortedYears.length;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin/library">이벤트 둘러보기</Link>
            <span>/</span>
            <span>내 참여 아카이브</span>
          </div>
          <h1 className="admin-title">내 참여 아카이브</h1>
          <p className="admin-subtitle">
            체크인한 이벤트를 연도별로 모았습니다. 카드를 누르면 사진과 영상이 담긴 상세 페이지가 열립니다.
          </p>
        </div>
      </div>

      {checkins.length === 0 ? (
        <div className="admin-empty-state">
          <p>아직 체크인한 이벤트가 없습니다.</p>
          <p className="admin-empty-sub">
            <Link href="/admin/library" className="admin-callout-link">
              이벤트 둘러보기 →
            </Link>
            에서 본인이 참여한 이벤트를 찾아 체크인하면 이곳에 모입니다.
          </p>
        </div>
      ) : (
        <>
          <div className="admin-filter-info">
            총 <strong>{checkins.length}</strong>개 이벤트 참여 · 활동 연도 {yearCount}개
            {' '}({sortedYears.join(', ')})
          </div>

          <div className="library-content">
            {sortedYears.map((year) => (
              <section key={year} className="library-year">
                <h2 className="library-year-title">{year}</h2>
                <div className="library-grid">
                  {(grouped.get(year) ?? []).map((event) => {
                    const strip = previews.get(event.id) ?? [];
                    const thumb =
                      event.thumbnail_url ||
                      event.poster_url ||
                      strip[0]?.image_url ||
                      null;
                    // 비공개(미공개) 이벤트는 공개 상세가 없어 링크하지 않고 배지로 표시
                    const isDraft = event.is_published === 0;
                    const inner = (
                      <>
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
                              <span className="library-card-category">{event.category_name_ko}</span>
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
                      </>
                    );
                    // 콘솔 안 상세로 연결(비공개 이벤트도 열람 가능), 같은 탭
                    return (
                      <Link
                        key={event.id}
                        href={`/admin/library/${event.id}`}
                        className="library-card"
                      >
                        {inner}
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
