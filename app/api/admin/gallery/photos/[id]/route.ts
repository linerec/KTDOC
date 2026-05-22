/**
 * Admin Gallery Loose Photo Detail API
 * PUT /api/admin/gallery/photos/[id] - 공개/날짜/이벤트/설명 정리
 * DELETE /api/admin/gallery/photos/[id] - 사진 삭제
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  clearGalleryPhotoEventImage,
  createEventImage,
  deleteEventImage,
  deleteGalleryPhoto,
  getEventById,
  getGalleryPhotoById,
  markGalleryPhotoEventImage,
  updateGalleryPhoto,
} from '@/lib/d1';
import { deleteFromR2 } from '@/lib/r2';
import type { UpdateGalleryPhotoInput } from '@/types/gallery';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

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

    const body = await request.json();
    const input: UpdateGalleryPhotoInput = {};

    if (body.caption_ko !== undefined) input.caption_ko = body.caption_ko;
    if (body.caption_en !== undefined) input.caption_en = body.caption_en;
    if (body.taken_date !== undefined) input.taken_date = body.taken_date || null;
    if (body.event_id !== undefined) {
      const nextEventId = body.event_id ? Number(body.event_id) : null;
      if (nextEventId) {
        const event = await getEventById(nextEventId);
        if (!event) {
          return NextResponse.json(
            { success: false, error: '연결할 이벤트를 찾을 수 없습니다.' },
            { status: 404 }
          );
        }
      }
      input.event_id = nextEventId;
    }
    if (body.is_published !== undefined) input.is_published = body.is_published;
    if (body.is_featured !== undefined) input.is_featured = body.is_featured;
    if (body.sort_order !== undefined) input.sort_order = Number(body.sort_order);

    await updateGalleryPhoto(photoId, input);

    if (input.event_id === null && photo.event_image_id) {
      await deleteEventImage(photo.event_image_id);
      await clearGalleryPhotoEventImage(photoId);
    }

    const targetEventId = input.event_id || null;
    const shouldAttachToEvent =
      targetEventId !== null &&
      (!photo.event_image_id || photo.event_id !== input.event_id);

    if (shouldAttachToEvent) {
      if (photo.event_image_id && photo.event_id !== input.event_id) {
        await deleteEventImage(photo.event_image_id);
      }
      const eventImageId = await createEventImage(targetEventId, {
        image_url: photo.image_url,
        r2_key: photo.r2_key,
        caption_ko: input.caption_ko ?? photo.caption_ko ?? undefined,
        caption_en: input.caption_en ?? photo.caption_en ?? undefined,
        width: photo.width || undefined,
        height: photo.height || undefined,
        size: photo.size || undefined,
      });
      await markGalleryPhotoEventImage(photoId, eventImageId);
    }

    const updatedPhoto = await getGalleryPhotoById(photoId);

    return NextResponse.json({
      success: true,
      data: updatedPhoto,
    });
  } catch (error) {
    console.error('Admin loose photo update error:', error);
    return NextResponse.json(
      { success: false, error: '사진 정리에 실패했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const photoId = parseInt(id, 10);

    if (isNaN(photoId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 사진 ID입니다.' },
        { status: 400 }
      );
    }

    const deleted = await deleteGalleryPhoto(photoId);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: '사진을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (deleted.event_image_id) {
      await deleteEventImage(deleted.event_image_id);
    }

    try {
      await deleteFromR2(deleted.r2_key);
    } catch (error) {
      console.warn('Failed to delete loose photo from R2:', error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin loose photo delete error:', error);
    return NextResponse.json(
      { success: false, error: '사진 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
