/**
 * 공연 둘러보기 (학생 · 학부모용, 읽기 전용)
 *
 * 공개된 공연을 검색·필터·열람한다. 콘텐츠 편집 기능은 없으며,
 * 멤버는 콘솔 상세(체크인·사진 제출)로, 그 외 역할은 공개 갤러리 상세로 이동한다.
 *
 * 이 파일은 무엇을 보여줄지만 정한다 — 필터 폼은 LibraryFilters, 카드·줄 렌더는
 * LibraryEventList가 맡는다(두 보기가 같은 배지·링크 규칙을 쓰도록).
 */

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { canSelfCheckIn } from '@/lib/isAdmin';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getEvents, getCategories, getUserCheckedInEventIds, memberLibrary } from '@/lib/d1';
import type { EventWithCategory } from '@/types/gallery';
import type { MemberRole } from '@/types/members';
import T from '@/components/common/T';
import LibraryFilters from '@/components/admin/library/LibraryFilters';
import LibraryEventList from '@/components/admin/library/LibraryEventList';
import type { LibraryView } from '@/components/admin/library/LibraryViewToggle';

export const metadata: Metadata = {
  title: '공연 둘러보기 | KTDOC Admin',
};

interface PageProps {
  searchParams: Promise<{
    year?: string;
    category?: string;
    search?: string;
    /** '1'이면 학생 본인이 체크인한 공연만 모아 보기 */
    mine?: string;
    /** 보기 방식: card(기본, 썸네일 카드) | list(게시판형 압축 목록) */
    view?: string;
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

  // 체크인은 본인 참여 기록 — 원생·선생님·관리자에게 자기 토글을 노출한다.
  // 학부모는 자녀 대행 체크인을 위해 공연 상세로 들어가야 한다.
  // 체크인할 수 있는 사람은 모두 콘솔 상세로 연결한다 — 공개 갤러리로 보내면
  // 정작 체크인할 자리가 없다. 비공개 공연도 함께 본다(참여 대상일 수 있으므로).
  const role = (session?.user?.role ?? 'user') as MemberRole;
  const userId = session?.user?.id ?? null;
  const canCheckIn = canSelfCheckIn(session) && !!userId;
  const memberView = (canCheckIn || role === 'parent') && !!userId;

  const params = await searchParams;
  const [eventsResult, categories, checkedInIds] = await Promise.all([
    getEvents(
      memberLibrary({
        year: params.year ? parseInt(params.year) : undefined,
        category: params.category || undefined,
        search: params.search || undefined,
        // 멤버(학생·학부모)는 비공개 포함 전체, 그 외 역할은 공개 아카이브만
        canSeeUnpublished: memberView,
      })
    ),
    getCategories(),
    canCheckIn ? getUserCheckedInEventIds(userId) : Promise.resolve(new Set<number>()),
  ]);

  const { events, total, years } = eventsResult;

  // 다가오는 공연 판정용 오늘 날짜(event_date는 'YYYY-MM-DD')
  const today = new Date().toISOString().slice(0, 10);

  // 체크인한 것만 모아 보기 (학생 전용)
  const mineOnly = canCheckIn && params.mine === '1';
  const checkedInCount = canCheckIn ? events.filter((e) => checkedInIds.has(e.id)).length : 0;
  const displayEvents = mineOnly ? events.filter((e) => checkedInIds.has(e.id)) : events;

  // 학생 기본 보기는 "다가오는 공연 먼저" — 응답을 유도하고 실수를 줄인다.
  const showUpcomingFirst = canCheckIn && !mineOnly;
  const upcomingEvents = showUpcomingFirst
    ? displayEvents
        .filter((e) => e.event_date >= today)
        .sort((a, b) => a.event_date.localeCompare(b.event_date))
    : [];
  const listEvents = showUpcomingFirst
    ? displayEvents.filter((e) => e.event_date < today)
    : displayEvents;
  // 다가오는 공연 중 아직 응답(체크인) 안 한 수 = 할 일
  const pendingCount = upcomingEvents.filter((e) => !checkedInIds.has(e.id)).length;

  const grouped = groupByYear(listEvents);
  const sortedYears = Array.from(grouped.keys()).sort((a, b) => b - a);
  const hasFilters = !!(params.year || params.category || params.search || mineOnly);
  const displayCount = mineOnly ? displayEvents.length : total;

  // 보기 방식: URL 파라미터가 우선, 없으면 지난 선택(쿠키), 기본은 카드.
  // 목록(list)은 공연이 수백 개로 늘어도 빠르게 훑을 수 있는 게시판형 압축 뷰.
  const savedView = (await cookies()).get('library-view')?.value;
  const view: LibraryView =
    params.view === 'list' || params.view === 'card'
      ? params.view
      : savedView === 'list'
        ? 'list'
        : 'card';
  const viewHref = (v: LibraryView) => {
    const q = new URLSearchParams();
    if (params.year) q.set('year', params.year);
    if (params.category) q.set('category', params.category);
    if (params.search) q.set('search', params.search);
    if (mineOnly) q.set('mine', '1');
    q.set('view', v);
    return `/admin/library?${q.toString()}`;
  };

  // Set은 서버→클라이언트 경계를 넘지 못한다(직렬화 불가) — 배열로 넘긴다.
  const checkedInList = Array.from(checkedInIds);
  const listProps = {
    view,
    memberView,
    canCheckIn,
    checkedInIds: checkedInList,
    today,
  };

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <span>
              <T k="admin.schedule.typePerformance">공연</T>
            </span>
            <span>/</span>
            <span>
              <T k="admin.library.crumb">둘러보기</T>
            </span>
          </div>
          <h1 className="admin-title">
            <T k="admin.nav.library">공연 둘러보기</T>
          </h1>
          <p className="admin-subtitle">
            {canCheckIn ? (
              <T k="admin.library.subtitleStudent">
                본인이 참여하는 공연에 체크인하면 내 아카이브에 모입니다. 아직 공개되지 않은(비공개)
                공연에도 체크인할 수 있습니다.
              </T>
            ) : (
              <T k="admin.library.subtitle">
                공개된 공연을 검색하고 열람합니다. 카드를 누르면 사진과 영상이 담긴 상세 페이지가
                열립니다.
              </T>
            )}
          </p>
        </div>
      </div>

      <LibraryFilters
        years={years}
        categories={categories}
        year={params.year || ''}
        category={params.category || ''}
        search={params.search || ''}
        hasFilters={hasFilters}
        canCheckIn={canCheckIn}
        mineOnly={mineOnly}
        checkedInCount={checkedInCount}
        displayCount={displayCount}
        view={view}
        cardHref={viewHref('card')}
        listHref={viewHref('list')}
      />

      {/* 응답 필요 알림 (다가오는 공연 중 미응답) */}
      {showUpcomingFirst && pendingCount > 0 && (
        <div className="admin-callout">
          <T k="admin.library.pendingCallout" params={{ n: <strong>{pendingCount}</strong> }}>
            {'다가오는 공연 중 {n}개에 아직 참여 응답을 하지 않았습니다. 아래에서 참여 여부를 정해 주세요.'}
          </T>
        </div>
      )}

      {displayEvents.length === 0 ? (
        <div className="admin-empty-state">
          <p>
            {mineOnly ? (
              <T k="admin.library.emptyMine">
                아직 체크인한 공연이 없습니다. 참여한 공연에 체크인해 보세요.
              </T>
            ) : hasFilters ? (
              <T k="admin.eventPicker.emptyFiltered">조건에 맞는 공연이 없습니다.</T>
            ) : (
              <T k="admin.library.empty">아직 공개된 공연이 없습니다.</T>
            )}
          </p>
        </div>
      ) : (
        <div className="library-content">
          {/* 다가오는 공연 (학생, 미필터 시) */}
          {showUpcomingFirst && upcomingEvents.length > 0 && (
            <section className="library-year library-upcoming">
              <h2 className="library-year-title">
                <T k="admin.library.upcomingSection">다가오는 공연</T>
              </h2>
              <LibraryEventList events={upcomingEvents} {...listProps} />
            </section>
          )}

          {/* 지난 공연(연도별) — 학생은 과거만, 그 외는 전체 */}
          {sortedYears.map((year) => (
            <section key={year} className="library-year">
              <h2 className="library-year-title">
                {showUpcomingFirst ? (
                  <T k="admin.library.pastYear" params={{ y: year }}>
                    {'{y} · 지난 공연'}
                  </T>
                ) : (
                  year
                )}
              </h2>
              <LibraryEventList events={grouped.get(year) ?? []} {...listProps} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
