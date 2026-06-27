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

  // 체크인은 수강생(student) 본인 참여 기록 — 학생에게만 자기 토글을 노출한다.
  // 학부모는 자녀 대행 체크인을 위해 이벤트 상세로 들어가야 하므로, 멤버(학생·학부모)는
  // 전체 이벤트를 보고 콘솔 상세로 연결한다.
  const role = (session?.user?.role ?? 'user') as MemberRole;
  const userId = session?.user?.id ?? null;
  const canCheckIn = role === 'student' && !!userId;
  const memberView = (role === 'student' || role === 'parent') && !!userId;

  const params = await searchParams;
  const [eventsResult, categories, checkedInIds] = await Promise.all([
    getEvents({
      year: params.year ? parseInt(params.year) : undefined,
      category: params.category || undefined,
      search: params.search || undefined,
      limit: 100,
      // 멤버(학생·학부모)는 비공개 포함 전체, 그 외 역할은 공개 아카이브만.
      published: memberView ? 'all' : true,
    }),
    getCategories(),
    canCheckIn ? getUserCheckedInEventIds(userId) : Promise.resolve(new Set<number>()),
  ]);

  const { events, total, years } = eventsResult;

  // 다가오는 이벤트 판정용 오늘 날짜(event_date는 'YYYY-MM-DD')
  const today = new Date().toISOString().slice(0, 10);

  // 체크인한 것만 모아 보기 (학생 전용)
  const mineOnly = canCheckIn && params.mine === '1';
  const checkedInCount = canCheckIn ? events.filter((e) => checkedInIds.has(e.id)).length : 0;
  const displayEvents = mineOnly ? events.filter((e) => checkedInIds.has(e.id)) : events;

  // 학생 기본 보기는 "다가오는 이벤트 먼저" — 응답을 유도하고 실수를 줄인다.
  const showUpcomingFirst = canCheckIn && !mineOnly;
  const upcomingEvents = showUpcomingFirst
    ? displayEvents
        .filter((e) => e.event_date >= today)
        .sort((a, b) => a.event_date.localeCompare(b.event_date))
    : [];
  const listEvents = showUpcomingFirst
    ? displayEvents.filter((e) => e.event_date < today)
    : displayEvents;
  // 다가오는 이벤트 중 아직 응답(체크인) 안 한 수 = 할 일
  const pendingCount = upcomingEvents.filter((e) => !checkedInIds.has(e.id)).length;

  const grouped = groupByYear(listEvents);
  const sortedYears = Array.from(grouped.keys()).sort((a, b) => b - a);
  const hasFilters = !!(params.year || params.category || params.search || mineOnly);
  const displayCount = mineOnly ? displayEvents.length : total;

  // 이벤트 카드 1장(둘러보기 공통). 다가오는 섹션과 연도 목록에서 함께 쓴다.
  const eventCard = (event: EventWithCategory) => {
    const thumb = event.thumbnail_url || event.poster_url || event.first_image_url || null;
    const isDraft = event.is_published === 0;
    const isChecked = canCheckIn && checkedInIds.has(event.id);
    const isUpcoming = event.event_date >= today;
    const inner = (
      <>
        <div className="library-card-thumb">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt={event.title_ko} loading="lazy" />
          ) : (
            <span className="library-card-thumb-empty">이미지 없음</span>
          )}
          {isChecked && (
            <span className="library-card-checked-flag">
              ✓ {isUpcoming ? '참여 예정' : '참여함'}
            </span>
          )}
          {!isChecked && isUpcoming && (
            <span className="library-card-upcoming-flag">다가오는</span>
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
        </div>
      </>
    );
    return (
      <div key={event.id} className={`library-card${isChecked ? ' is-checked' : ''}`}>
        {memberView ? (
          <Link href={`/admin/library/${event.id}`} className="library-card-link">
            {inner}
          </Link>
        ) : (
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
            upcoming={isUpcoming}
          />
        )}
      </div>
    );
  };

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

          <Link href="/admin/library/calendar" className="admin-btn admin-btn-sm admin-btn-outline">
            📅 캘린더
          </Link>

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

      {/* 응답 필요 알림 (다가오는 이벤트 중 미응답) */}
      {showUpcomingFirst && pendingCount > 0 && (
        <div className="admin-callout">
          다가오는 이벤트 중 <strong>{pendingCount}개</strong>에 아직 참여 응답을 하지 않았습니다.
          아래에서 참여 여부를 정해 주세요.
        </div>
      )}

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
          {/* 다가오는 이벤트 (학생, 미필터 시) */}
          {showUpcomingFirst && upcomingEvents.length > 0 && (
            <section className="library-year library-upcoming">
              <h2 className="library-year-title">다가오는 이벤트</h2>
              <div className="library-grid">{upcomingEvents.map(eventCard)}</div>
            </section>
          )}

          {/* 지난 이벤트(연도별) — 학생은 과거만, 그 외는 전체 */}
          {sortedYears.map((year) => (
            <section key={year} className="library-year">
              <h2 className="library-year-title">
                {showUpcomingFirst ? `${year} · 지난 이벤트` : `${year}`}
              </h2>
              <div className="library-grid">{(grouped.get(year) ?? []).map(eventCard)}</div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
