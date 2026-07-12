/**
 * Admin Gallery Photo Inbox Page
 * 날짜/공연 미정리 사진 보관함
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getGalleryPhotos } from '@/lib/d1';
import { attachUploaderNames } from '@/lib/admin/galleryPhotoActions';
import PhotoInboxManager from '@/components/admin/gallery/PhotoInboxManager';

export const metadata = {
  title: '사진 보관함 | KTDOC Admin',
};

// 보관함 한 페이지 분량 (수천 장이어도 페이지 단위로만 로드)
const PHOTO_INBOX_PAGE_SIZE = 60;

export default async function AdminGalleryPhotosPage() {
  const session = await auth();
  await requireMenuAccess(session, 'gallery.photos');

  // 공연은 더 이상 전체를 미리 로드하지 않는다 — EventPicker가 필요 시 서버 검색한다.
  const photosResult = await getGalleryPhotos({
    published: undefined,
    organized: 'all',
    page: 1,
    limit: PHOTO_INBOX_PAGE_SIZE,
  });
  photosResult.photos = await attachUploaderNames(photosResult.photos);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <Link href="/admin/gallery">공연 관리</Link>
            <span>/</span>
            <span>사진 보관함</span>
          </div>
          <h1 className="admin-title">사진 보관함</h1>
          <p className="admin-subtitle">
            사진을 올리는 &lsquo;업로드&rsquo; 탭과 올라온 사진을 정리하는 &lsquo;사진 정리&rsquo; 탭으로 나뉩니다.
            정리 탭에서는 여러 장을 한 번에 선택해 공개·공연 연결·삭제하고, 촬영일과 설명을 정리할 수 있습니다.
          </p>
        </div>
        <div className="admin-header-actions">
          <Link href="/admin/gallery" className="admin-btn admin-btn-outline">
            공연 관리
          </Link>
          <Link href="/gallery" className="admin-btn admin-btn-outline" target="_blank">
            공개 갤러리
          </Link>
        </div>
      </div>

      <PhotoInboxManager
        initialPhotos={photosResult.photos}
        initialTotal={photosResult.total}
        pageSize={PHOTO_INBOX_PAGE_SIZE}
      />
    </div>
  );
}
