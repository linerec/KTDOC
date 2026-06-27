/**
 * Admin Gallery New Event Page
 * 새 이벤트 생성
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getCategories } from '@/lib/d1';
import EventForm from '@/components/admin/gallery/EventForm';

export const metadata = {
  title: '새 아카이브 이벤트 | KTDOC Admin',
};

export default async function AdminGalleryNewPage() {
  const session = await auth();
  await requireMenuAccess(session, 'gallery');

  const categories = await getCategories();

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <Link href="/admin/gallery">이벤트 아카이브</Link>
            <span>/</span>
            <span>새 이벤트</span>
          </div>
          <h1 className="admin-title">새 아카이브 이벤트 만들기</h1>
          <p className="admin-subtitle">
            먼저 제목, 날짜, 카테고리를 저장한 뒤 사진과 영상을 추가할 수 있습니다.
          </p>
        </div>
      </div>

      <div className="admin-content">
        <EventForm categories={categories} isNew />
      </div>
    </div>
  );
}
