/**
 * Admin Gallery Photo Inbox Page
 * 날짜/이벤트 미정리 사진 보관함
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { getEvents, getGalleryPhotos } from '@/lib/d1';
import PhotoInboxManager from '@/components/admin/gallery/PhotoInboxManager';

export const metadata = {
  title: '사진 보관함 | KTDOC Admin',
};

export default async function AdminGalleryPhotosPage() {
  const session = await auth();
  if (!session) {
    redirect('/login');
  }

  const [photosResult, eventsResult] = await Promise.all([
    getGalleryPhotos({ published: undefined, organized: 'all', limit: 120 }),
    getEvents({ published: 'all', limit: 500 }),
  ]);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <Link href="/admin/gallery">이벤트 아카이브</Link>
            <span>/</span>
            <span>사진 보관함</span>
          </div>
          <h1 className="admin-title">사진 보관함</h1>
          <p className="admin-subtitle">
            날짜와 공연 정보가 없어도 사진을 먼저 업로드하고 공개할 수 있습니다.
            이후 각 사진에 촬영일과 이벤트를 연결해 정리합니다.
          </p>
        </div>
        <div className="admin-header-actions">
          <Link href="/admin/gallery" className="admin-btn admin-btn-outline">
            이벤트 아카이브
          </Link>
          <Link href="/gallery" className="admin-btn admin-btn-outline" target="_blank">
            공개 Gallery
          </Link>
        </div>
      </div>

      <PhotoInboxManager
        initialPhotos={photosResult.photos}
        events={eventsResult.events}
      />
    </div>
  );
}
