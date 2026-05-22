/**
 * Admin Gallery Page
 * 이벤트 목록 및 관리
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { getEvents, getCategories, getYears } from '@/lib/d1';
import EventTable from '@/components/admin/gallery/EventTable';

export const metadata = {
  title: '이벤트 아카이브 관리 | KTDOC Admin',
};

interface PageProps {
  searchParams: Promise<{
    year?: string;
    category?: string;
    search?: string;
    page?: string;
  }>;
}

export default async function AdminGalleryPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session) {
    redirect('/login');
  }

  const params = await searchParams;
  const [eventsResult, categories, years] = await Promise.all([
    getEvents({
      year: params.year ? parseInt(params.year) : undefined,
      category: params.category || undefined,
      search: params.search || undefined,
      page: params.page ? parseInt(params.page) : 1,
      limit: 50,
      published: 'all', // Show all
    }),
    getCategories(),
    getYears(),
  ]);

  const { events, total } = eventsResult;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <span>이벤트 아카이브</span>
          </div>
          <h1 className="admin-title">이벤트 아카이브 관리</h1>
          <p className="admin-subtitle">
            공개 Gallery에 표시될 이벤트를 관리합니다. 사진과 영상은 각 이벤트 편집 화면에서 추가합니다.
          </p>
        </div>
        <div className="admin-header-actions">
          <Link
            href="/admin/gallery/categories"
            className="admin-btn admin-btn-outline"
          >
            이벤트 카테고리
          </Link>
          <Link
            href="/admin/gallery/photos"
            className="admin-btn admin-btn-outline"
          >
            사진 보관함
          </Link>
          <Link
            href="/admin/gallery/new"
            className="admin-btn admin-btn-primary"
          >
            + 새 이벤트 만들기
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="admin-filters">
        <form className="admin-filter-form" method="get">
          <select
            name="year"
            className="admin-filter-select"
            defaultValue={params.year || ''}
          >
            <option value="">전체 연도</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <select
            name="category"
            className="admin-filter-select"
            defaultValue={params.category || ''}
          >
            <option value="">전체 카테고리</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.slug}>{cat.name_ko}</option>
            ))}
          </select>

          <input
            type="text"
            name="search"
            placeholder="검색..."
            className="admin-filter-input"
            defaultValue={params.search || ''}
          />

          <button type="submit" className="admin-btn admin-btn-sm">
            검색
          </button>

          {(params.year || params.category || params.search) && (
            <Link href="/admin/gallery" className="admin-btn admin-btn-sm admin-btn-outline">
              초기화
            </Link>
          )}
        </form>

        <div className="admin-filter-info">
          총 {total}개의 아카이브 이벤트
        </div>
      </div>

      {/* Event Table */}
      <EventTable events={events} />

      {/* Pagination */}
      {total > 50 && (
        <div className="admin-pagination">
          {/* Add pagination component if needed */}
        </div>
      )}
    </div>
  );
}
