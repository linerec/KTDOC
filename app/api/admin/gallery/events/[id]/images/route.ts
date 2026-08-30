/**
 * Admin Gallery Event Images API
 * POST /api/admin/gallery/events/[id]/images - 이미지 업로드
 * DELETE /api/admin/gallery/events/[id]/images?imageId=xxx - 이미지 삭제
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin, isStaff } from '@/lib/isAdmin';
import {
  getEventById,
  createEventImage,
  deleteEventImage,
  getEventImageById,
  getGalleryPhotoByEventImageId,
  filterR2KeysInArchive,
  updateGalleryPhoto,
  clearGalleryPhotoEventImage,
} from '@/lib/d1';
import { deleteFromR2 } from '@/lib/r2';
import { readUploads } from '@/lib/r2/readUploads';
import { uploadTargetByKey } from '@/lib/r2/uploadTargets';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - 이미지 업로드
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    // 업로드는 운영진(선생님 포함)까지 — 삭제는 아래 DELETE에서 admin 전용을 유지한다
    if (!isStaff(session)) {
      return NextResponse.json(
        { success: false, error: '운영진 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const eventId = parseInt(id);

    if (isNaN(eventId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 이벤트 ID입니다.' },
        { status: 400 }
      );
    }

    const event = await getEventById(eventId);
    if (!event) {
      return NextResponse.json(
        { success: false, error: '이벤트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 파일은 브라우저에서 R2로 직접 올라온다 — 여기 오는 것은 티켓뿐이다.
    const target = uploadTargetByKey('event-images', `gallery/${eventId}`)!;
    const intake = await readUploads(request, {
      target,
      userId: session?.user?.id ?? '',
    });

    if (intake.uploads.length === 0) {
      return NextResponse.json(
        { success: false, error: intake.error ?? '업로드할 파일이 없습니다.' },
        { status: 400 }
      );
    }

    const uploadedImages = [];

    for (const file of intake.uploads) {
      const imageId = await createEventImage(eventId, {
        image_url: file.url,
        r2_key: file.key,
        size: file.size,
      });

      uploadedImages.push({
        id: imageId,
        image_url: file.url,
        r2_key: file.key,
      });
    }

    return NextResponse.json({
      success: true,
      data: { images: uploadedImages, count: uploadedImages.length },
    });
  } catch (error) {
    console.error('Admin gallery image upload error:', error);
    return NextResponse.json(
      { success: false, error: '이미지 업로드에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE - 이미지 삭제
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const eventId = parseInt(id);

    if (isNaN(eventId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 이벤트 ID입니다.' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const imageIdParam = searchParams.get('imageId');
    const imageId = imageIdParam ? parseInt(imageIdParam) : NaN;

    if (isNaN(imageId)) {
      return NextResponse.json(
        { success: false, error: '유효한 이미지 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const image = await getEventImageById(imageId);
    if (!image) {
      return NextResponse.json(
        { success: false, error: '이미지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    if (image.event_id !== eventId) {
      return NextResponse.json(
        { success: false, error: '이 이벤트에 속한 이미지가 아닙니다.' },
        { status: 400 }
      );
    }

    // 보관함(gallery_photos)에서 연결된 사진인지 삭제 전에 판별한다
    const archivePhoto = await getGalleryPhotoByEventImageId(imageId);

    await deleteEventImage(imageId);

    if (archivePhoto) {
      // 보관함 원본이 있는 사진 — 이벤트에서만 빼고(연결 해제) 보관함과 R2 객체는 남긴다
      await updateGalleryPhoto(archivePhoto.id, { event_id: null });
      await clearGalleryPhotoEventImage(archivePhoto.id);
      return NextResponse.json({ success: true, data: { detachedToArchive: true } });
    }

    // 이벤트에 직접 업로드된 이미지 — 혹시 보관함이 같은 R2 객체를 참조하면 남긴다
    const archiveKeys = await filterR2KeysInArchive([image.r2_key]);
    if (!archiveKeys.has(image.r2_key)) {
      try {
        await deleteFromR2(image.r2_key);
      } catch (e) {
        console.warn('Failed to delete image from R2:', e);
      }
    }

    return NextResponse.json({ success: true, data: { detachedToArchive: false } });
  } catch (error) {
    console.error('Admin gallery image delete error:', error);
    return NextResponse.json(
      { success: false, error: '이미지 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
