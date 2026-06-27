/**
 * 공연 · 갤러리 둘러보기 (학생 · 학부모용, 읽기 전용)
 *
 * 공개된 이벤트 아카이브를 검색·필터·열람한다. 콘텐츠 편집 기능은 없으며,
 * 카드를 누르면 공개 갤러리의 이벤트 상세(사진·영상)로 이동한다.
 * 본인 사진 업로드/제출(library.my)은 소유자 데이터 모델이 준비된 후 추가된다.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getEvents, getCategories, getUserCheckedInEventIds } from '@/lib/d1';
import type { EventWithCategory } from '@/types/gallery';
import type { MemberRole } from '@/types/members';
import CheckinButton from '@/components/admin/library/CheckinButton';

export const metadata: Metadata = {
  title: '공연 · 갤러리 둘러보기 | KTDOC Admin',
};

interface PageProps {
  searchParams: Promise<{
    year?: string;
    category?: string;
    search?: string;
    /** '1'이면 학생 본인이 체크인한 이벤트만 모아 보기 */
    mine?: string;
  }>;
}

function groupByYear(events: EventWithCategory[]): Map<number, EventWithCategory[]> {
  const grouped = new Map<number, EventWithCategory[]>();
  for (const event of events) {
    const list = grouped.get(event.year) ?? [];
    list.push(event);
    grouped.set(event.year, list);
  }
  return grouped;
}

export default async function AdminLibraryPage({ searchParams }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'library');

  // 체크인은 수강생(student) 본인 참여 기록 — 학생에게만 토글을 노출한다.
  const role = (session?.user?.role ?? 'user') as MemberRole;
  const userId = session?.user?.id ?? null;
  const canCheckIn = role === 'student' && !!userId;

  const params = await searchParams;
  const [eventsResult, categories, checkedInIds] = await Promise.all([
    getEvents({
      year: params.year ? parseInt(params.year) : undefined,
      category: params.category || undefined,
      search: params.search || undefined,
      limit: 100,
      // 학생은 비공개(미공개) 이벤트에도 체크인할 수 있어야 하므로 전체를 노출한다.
      // 그 외 역할은 공개 아카이브만 둘러본다.
      published: canCheckIn ? 'all' : true,
    }),
    getCategories(),
    canCheckIn ? getUserCheckedInEventIds(userId) : Promise.resolve(new Set<number>()),
  ]);

  const { events, total, years } = eventsResult;

  // 체크인한 것만 모아 보기 (학생 전용)
  const mineOnly = canCheckIn && params.mine === '1';
  const checkedInCount = canCheckIn ? events.filter((e) => checkedInIds.has(e.id)).length : 0;
  const displayEvents = mineOnly ? events.filter((e) => checkedInIds.has(e.id)) : events;

  const grouped = groupByYear(displayEvents);
  const sortedYears = Array.from(grouped.keys()).sort((a, b) => b - a);
  const hasFilters = !!(params.year || params.category || params.search || mineOnly);
  const displayCount = mineOnly ? displayEvents.length : total;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <span>공연 · 갤러리</span>
            <span>/</span>
            <span>둘러보기</span>
          </div>
          <h1 className="admin-title">공연 · 갤러리 둘러보기</h1>
          <p className="admin-subtitle">
            {canCheckIn
              ? '본인이 참여한 공연·이벤트에 체크인하면 내 아카이브에 모입니다. 아직 공개되지 않은(비공개) 이벤트에도 체크인할 수 있습니다.'
              : '공개된 공연과 갤러리를 검색하고 열람합니다. 카드를 누르면 사진과 영상이 담긴 상세 페이지가 열립니다.'}
          </p>
        </div>
      </div>

      {/* 검색 · 필터 */}
      <div className="admin-filters">
        <form className="admin-filter-form" method="get">
          <select name="year" className="admin-filter-select" defaultValue={params.year || ''}>
            <option value="">전체 연도</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <select name="category" className="admin-filter-select" defaultValue={params.category || ''}>
            <option value="">전체 카테고리</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.slug}>{cat.name_ko}</option>
            ))}
          </select>

          <input
            type="text"
            name="search"
            placeholder="제목 검색..."
            className="admin-filter-input"
            defaultValue={params.search || ''}
          />

          <button type="submit" className="admin-btn admin-btn-sm">검색</button>

          {hasFilters && (
            <Link href="/admin/library" className="admin-btn admin-btn-sm admin-btn-outline">
              초기화
            </Link>
          )}

          {canCheckIn && (
            <Link
              href={mineOnly ? '/admin/library' : '/admin/library?mine=1'}
              className={`admin-btn admin-btn-sm ${mineOnly ? '' : 'admin-btn-outline'}`}
            >
              {mineOnly ? '전체 보기' : `✓ 체크인한 것만 (${checkedInCount})`}
            </Link>
          )}

          {canCheckIn && (
            <Link href="/admin/library/archive" className="admin-btn admin-btn-sm admin-btn-outline">
              내 참여 아카이브 →
            </Link>
          )}
        </form>

        <div className="admin-filter-info">
          {mineOnly ? '체크인한 이벤트' : canCheckIn ? '이벤트' : '공개된 이벤트'} {displayCount}개
        </div>
      </div>

      {/* 결과 */}
      {displayEvents.length === 0 ? (
        <div className="admin-empty-state">
          <p>
            {mineOnly
              ? '아직 체크인한 이벤트가 없습니다. 참여한 공연·이벤트에 체크인해 보세요.'
              : hasFilters
                ? '조건에 맞는 공연 · 갤러리가 없습니다.'
                : '아직 공개된 공연 · 갤러리가 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="library-content">
          {sortedYears.map((year) => (
            <section key={year} className="library-year">
              <h2 className="library-year-title">{year}</h2>
              <div className="library-grid">
                {(grouped.get(year) ?? []).map((event) => {
                  const thumb = event.thumbnail_url || event.poster_url || event.first_image_url || null;
                  // 비공개(미공개) 이벤트는 공개 상세 페이지가 없으므로 링크하지 않고 배지로 표시한다.
                  const isDraft = event.is_published === 0;
                  const isChecked = canCheckIn && checkedInIds.has(event.id);
                  const inner = (
                    <>
                      <div className="library-card-thumb">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt={event.title_ko} loading="lazy" />
                        ) : (
                          <span className="library-card-thumb-empty">이미지 없음</span>
                        )}
                        {isChecked && <span className="library-card-checked-flag">✓ 참여함</span>}
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
                      </div>
                    </>
                  );
                  return (
                    <div
                      key={event.id}
                      className={`library-card${isChecked ? ' is-checked' : ''}`}
                    >
                      {canCheckIn ? (
                        // 학생: 콘솔 안 상세로(비공개 이벤트도 열람 가능), 같은 탭
                        <Link href={`/admin/library/${event.id}`} className="library-card-link">
                          {inner}
                        </Link>
                      ) : (
                        // 그 외: 공개 갤러리 상세(공개 이벤트만 노출되므로 항상 유효)
                        <a
                          href={`/gallery/${event.year}/${event.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="library-card-link"
                        >
                          {inner}
                        </a>
                      )}
                      {canCheckIn && (
                        <CheckinButton
                          eventId={event.id}
                          initialCheckedIn={checkedInIds.has(event.id)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
