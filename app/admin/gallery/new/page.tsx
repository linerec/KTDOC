/**
 * Admin Gallery New Event Page
 * 새 공연 · 학내 행사 생성 (종류는 폼 최상단 라디오에서 선택)
 */

import Link from 'next/link';
import T from '@/components/common/T';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getCategories, getActiveSupplyItems, getActiveSupplySets } from '@/lib/d1';
import EventForm from '@/components/admin/gallery/EventForm';

export const metadata = {
  title: '새 공연 · 행사 | KTDOC Admin',
};

export default async function AdminGalleryNewPage() {
  const session = await auth();
  await requireMenuAccess(session, 'gallery');

  const [categories, activeSupplies, activeSupplySets] = await Promise.all([
    getCategories(),
    getActiveSupplyItems(),
    getActiveSupplySets(),
  ]);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">
              <T k="admin.common.breadcrumbHome">관리 홈</T>
            </Link>
            <span>/</span>
            <Link href="/admin/gallery">
              <T k="admin.nav.gallery">공연 · 행사 관리</T>
            </Link>
            <span>/</span>
            <span>
              <T k="admin.events.newCrumb">새로 만들기</T>
            </span>
          </div>
          <h1 className="admin-title">
            <T k="admin.events.newCrumb">새로 만들기</T>
          </h1>
          <p className="admin-subtitle">
            <T k="admin.events.newSubtitle">
              맨 위에서 종류(공연 / 학내 행사)를 고르고 제목·날짜를 저장한 뒤, 사진과 영상을
              추가할 수 있습니다.
            </T>
          </p>
        </div>
      </div>

      <div className="admin-content">
        <EventForm categories={categories} isNew activeSupplies={activeSupplies} activeSupplySets={activeSupplySets} />
      </div>
    </div>
  );
}
