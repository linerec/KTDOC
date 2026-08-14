/**
 * Admin Gallery Page
 * 공연 목록 및 관리
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { hasMenuAccess, requireMenuAccess } from '@/lib/admin/permissions';
import { getEvents, getCategories, getYears, adminAllEvents} from '@/lib/d1';
import EventTable from '@/components/admin/gallery/EventTable';
import CategoryManagerModal from '@/components/admin/gallery/CategoryManagerModal';
import EventFilters from '@/components/admin/gallery/EventFilters';
import T from '@/components/common/T';

export const metadata = {
  title: '공연 관리 | KTDOC Admin',
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
  await requireMenuAccess(session, 'gallery');

  // 사진 보관함은 사이드바에 없다 — 여기 버튼이 유일한 진입점이라 권한을 함께 본다
  // (선생님에게 보이기만 하고 누르면 튕기던 버튼이었다).
  const canSeePhotos = await hasMenuAccess(session, 'gallery.photos');

  const params = await searchParams;
  const [eventsResult, categories, years] = await Promise.all([
    getEvents(
      adminAllEvents({
        year: params.year ? parseInt(params.year) : undefined,
        category: params.category || undefined,
        search: params.search || undefined,
        page: params.page ? parseInt(params.page) : 1,
      })
    ),
    getCategories(),
    getYears(),
  ]);

  const { events, total } = eventsResult;

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
              <T k="admin.nav.gallery">공연 · 행사 관리</T>
            </span>
          </div>
          <h1 className="admin-title">
            <T k="admin.nav.gallery">공연 · 행사 관리</T>
          </h1>
          <p className="admin-subtitle">
            <T k="admin.events.subtitle">
              공개 갤러리 페이지에 표시될 공연과 학내 행사(수료식·발표회)를 관리합니다. 종류는
              만들기 화면 맨 위에서 고릅니다. 사진과 영상은 각 편집 화면에서 추가합니다.
            </T>
          </p>
        </div>
        <div className="admin-header-actions">
          <CategoryManagerModal initialCategories={categories} />
          {canSeePhotos && (
            <Link href="/admin/gallery/photos" className="admin-btn admin-btn-outline">
              <T k="admin.nav.gallery.photos">사진 보관함</T>
            </Link>
          )}
          <Link href="/admin/gallery/new" className="admin-btn admin-btn-primary">
            <T k="admin.events.new">+ 새로 만들기</T>
          </Link>
        </div>
      </div>

      <EventFilters
        years={years}
        categories={categories}
        year={params.year || ''}
        category={params.category || ''}
        search={params.search || ''}
        total={total}
      />

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
