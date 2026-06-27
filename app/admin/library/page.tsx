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
import { getEvents, getCategories } from '@/lib/d1';
import type { EventWithCategory } from '@/types/gallery';

export const metadata: Metadata = {
  title: '공연 · 갤러리 둘러보기 | KTDOC Admin',
};

interface PageProps {
  searchParams: Promise<{
    year?: string;
    category?: string;
    search?: string;
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

  const params = await searchParams;
  const [eventsResult, categories] = await Promise.all([
    getEvents({
      year: params.year ? parseInt(params.year) : undefined,
      category: params.category || undefined,
      search: params.search || undefined,
      limit: 100,
      published: true, // 공개된 항목만 노출
    }),
    getCategories(),
  ]);

  const { events, total, years } = eventsResult;
  const grouped = groupByYear(events);
  const sortedYears = Array.from(grouped.keys()).sort((a, b) => b - a);
  const hasFilters = !!(params.year || params.category || params.search);

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
            공개된 공연과 갤러리를 검색하고 열람합니다. 카드를 누르면 사진과 영상이 담긴 상세 페이지가 열립니다.
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
        </form>

        <div className="admin-filter-info">공개된 이벤트 {total}개</div>
      </div>

      {/* 결과 */}
      {events.length === 0 ? (
        <div className="admin-empty-state">
          <p>{hasFilters ? '조건에 맞는 공연 · 갤러리가 없습니다.' : '아직 공개된 공연 · 갤러리가 없습니다.'}</p>
        </div>
      ) : (
        <div className="library-content">
          {sortedYears.map((year) => (
            <section key={year} className="library-year">
              <h2 className="library-year-title">{year}</h2>
              <div className="library-grid">
                {(grouped.get(year) ?? []).map((event) => {
                  const thumb = event.thumbnail_url || event.poster_url || event.first_image_url || null;
                  return (
                    <a
                      key={event.id}
                      href={`/gallery/${event.year}/${event.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
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
                        {event.category_name_ko && (
                          <span className="library-card-category">{event.category_name_ko}</span>
                        )}
                        <h3 className="library-card-title">{event.title_ko}</h3>
                        <p className="library-card-date">{event.event_date}</p>
                      </div>
                    </a>
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
