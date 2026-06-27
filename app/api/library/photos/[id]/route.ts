/**
 * 학생·학부모 제출 사진 취소 API
 * DELETE /api/library/photos/[id] - 본인이 올린 "검토 중" 사진을 취소(보관함·R2에서 삭제)
 *
 * 보안:
 *  - 로그인 + 정회원(active)만.
 *  - 본인이 올린 사진(uploaded_by === 본인)만 삭제 가능.
 *  - 운영진이 이미 공개했거나 이벤트에 연결한 사진은 취소 불가(반영된 콘텐츠 보호).
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isApproved } from '@/lib/isAdmin';
import { getGalleryPhotoById } from '@/lib/d1';
import { deletePhotoFully } from '@/lib/admin/galleryPhotoActions';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id || !isApproved(session)) {
    return NextResponse.json(
      { success: false, error: '로그인이 필요합니다.' },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const photoId = parseInt(id, 10);
    if (isNaN(photoId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 사진 ID입니다.' },
        { status: 400 }
      );
    }

    const photo = await getGalleryPhotoById(photoId);
    if (!photo) {
      return NextResponse.json(
        { success: false, error: '사진을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (photo.uploaded_by !== session.user.id) {
      return NextResponse.json(
        { success: false, error: '본인이 올린 사진만 취소할 수 있습니다.' },
        { status: 403 }
      );
    }

    if (photo.is_published === 1 || photo.event_id) {
      return NextResponse.json(
        { success: false, error: '이미 운영진이 반영한 사진은 취소할 수 없습니다.' },
        { status: 409 }
      );
    }

    await deletePhotoFully(photo);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Student photo cancel error:', error);
    return NextResponse.json(
      { success: false, error: '사진 취소에 실패했습니다.' },
      { status: 500 }
    );
  }
}
