/**
 * Admin Gallery Loose Photo Detail API
 * PUT /api/admin/gallery/photos/[id] - 공개/날짜/이벤트/설명 정리
 * DELETE /api/admin/gallery/photos/[id] - 사진 삭제
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { getGalleryPhotoById } from '@/lib/d1';
import {
  deletePhotoFully,
  eventExists,
  organizePhoto,
} from '@/lib/admin/galleryPhotoActions';
import type { UpdateGalleryPhotoInput } from '@/types/gallery';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
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
    if (body.taken_date !== undefined) {
      if (body.taken_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.taken_date)) {
        return NextResponse.json(
          { success: false, error: '촬영일 형식이 올바르지 않습니다. (예: 2026-07-01)' },
          { status: 400 }
        );
      }
      input.taken_date = body.taken_date || null;
    }
    if (body.event_id !== undefined) {
      const nextEventId = body.event_id ? Number(body.event_id) : null;
      if (nextEventId && !(await eventExists(nextEventId))) {
        return NextResponse.json(
          { success: false, error: '연결할 이벤트를 찾을 수 없습니다.' },
          { status: 404 }
        );
      }
      input.event_id = nextEventId;
    }
    if (body.is_published !== undefined) input.is_published = body.is_published;
    if (body.is_featured !== undefined) input.is_featured = body.is_featured;
    if (body.sort_order !== undefined) input.sort_order = Number(body.sort_order);

    const updatedPhoto = await organizePhoto(photo, input);

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
    if (!isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
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

    await deletePhotoFully(photo);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin loose photo delete error:', error);
    return NextResponse.json(
      { success: false, error: '사진 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
