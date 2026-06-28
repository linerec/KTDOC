/**
 * 내 사진 · 제출 (학생 · 학부모용)
 *
 * 본인이 올린 사진을 제출하고 검토 상태(검토 중 / 게시됨)를 확인한다.
 * 제출 사진은 항상 비공개로 사진 보관함에 들어가며, 운영진이 검토 후 공개·이벤트 연결한다.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getGalleryPhotos } from '@/lib/d1';
import StudentPhotoSubmit from '@/components/admin/library/StudentPhotoSubmit';

export const metadata: Metadata = {
  title: '내 사진 · 제출 | KTDOC Admin',
};

const MY_PHOTO_PAGE_SIZE = 40;

export default async function AdminLibraryMyPage() {
  const session = await auth();
  await requireMenuAccess(session, 'library.my');

  const userId = session!.user!.id;
  const photosResult = await getGalleryPhotos({
    uploadedBy: userId,
    page: 1,
    limit: MY_PHOTO_PAGE_SIZE,
    sort: 'recent',
  });

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin/library">이벤트 둘러보기</Link>
            <span>/</span>
            <span>내 사진 · 제출</span>
          </div>
          <h1 className="admin-title">내 사진 · 제출</h1>
          <p className="admin-subtitle">
            본인이 찍은 공연·연습 사진을 올리면 운영진 검토 후 공개 갤러리에 반영됩니다.
          </p>
        </div>
      </div>

      <StudentPhotoSubmit
        initialPhotos={photosResult.photos}
        initialTotal={photosResult.total}
        pageSize={MY_PHOTO_PAGE_SIZE}
      />
    </div>
  );
}
