/**
 * Admin Gallery New Event Page
 * 새 공연 · 학내 행사 생성 (종류는 폼 최상단 라디오에서 선택)
 */

import Link from 'next/link';
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
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <Link href="/admin/gallery">공연 · 행사 관리</Link>
            <span>/</span>
            <span>새로 만들기</span>
          </div>
          <h1 className="admin-title">새로 만들기</h1>
          <p className="admin-subtitle">
            맨 위에서 종류(공연 / 학내 행사)를 고르고 제목·날짜를 저장한 뒤,
            사진과 영상을 추가할 수 있습니다.
          </p>
        </div>
      </div>

      <div className="admin-content">
        <EventForm categories={categories} isNew activeSupplies={activeSupplies} activeSupplySets={activeSupplySets} />
      </div>
    </div>
  );
}
