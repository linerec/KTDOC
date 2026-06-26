/**
 * Admin Gallery Loose Photos — Bulk Actions
 * POST /api/admin/gallery/photos/bulk
 * body: { ids: number[], action, eventId? }
 * action: 'publish'|'unpublish'|'feature'|'unfeature'|'assignEvent'|'unassignEvent'|'delete'
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { bulkSetGalleryPhotoFlag, getGalleryPhotoById } from '@/lib/d1';
import {
  attachPhotosToEvent,
  deletePhotoFully,
  detachPhotos,
  eventExists,
} from '@/lib/admin/galleryPhotoActions';
import type { GalleryPhoto } from '@/types/gallery';

type BulkAction =
  | 'publish'
  | 'unpublish'
  | 'feature'
  | 'unfeature'
  | 'assignEvent'
  | 'unassignEvent'
  | 'delete';

const FLAG_ACTIONS: Record<string, { field: 'is_published' | 'is_featured'; value: boolean }> = {
  publish: { field: 'is_published', value: true },
  unpublish: { field: 'is_published', value: false },
  feature: { field: 'is_featured', value: true },
  unfeature: { field: 'is_featured', value: false },
};

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const action = body.action as BulkAction;
    const rawIds: unknown = body.ids;

    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '선택된 사진이 없습니다.' },
        { status: 400 }
      );
    }

    const ids = Array.from(
      new Set(rawIds.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0))
    );

    if (ids.length === 0) {
      return NextResponse.json(
        { success: false, error: '유효한 사진 ID가 없습니다.' },
        { status: 400 }
      );
    }

    // 플래그 일괄 변경(공개/비공개/강조)
    if (FLAG_ACTIONS[action]) {
      const { field, value } = FLAG_ACTIONS[action];
      const affected = await bulkSetGalleryPhotoFlag(ids, field, value);
      return NextResponse.json({ success: true, data: { affected } });
    }

    // 이벤트 연결/해제/삭제는 사진별 사이드이펙트(event_images, R2)가 있어 개별 처리
    const photos = (
      await Promise.all(ids.map((id) => getGalleryPhotoById(id)))
    ).filter((p): p is GalleryPhoto => p !== null);

    if (photos.length === 0) {
      return NextResponse.json(
        { success: false, error: '대상 사진을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (action === 'assignEvent') {
      const eventId = body.eventId ? Number(body.eventId) : null;
      if (!eventId || !(await eventExists(eventId))) {
        return NextResponse.json(
          { success: false, error: '연결할 이벤트를 찾을 수 없습니다.' },
          { status: 400 }
        );
      }
      const affected = await attachPhotosToEvent(photos, eventId);
      return NextResponse.json({ success: true, data: { affected } });
    }

    if (action === 'unassignEvent') {
      const affected = await detachPhotos(photos);
      return NextResponse.json({ success: true, data: { affected } });
    }

    if (action === 'delete') {
      for (const photo of photos) {
        await deletePhotoFully(photo);
      }
      return NextResponse.json({ success: true, data: { affected: photos.length } });
    }

    return NextResponse.json(
      { success: false, error: '알 수 없는 작업입니다.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Admin loose photo bulk action error:', error);
    return NextResponse.json(
      { success: false, error: '일괄 작업에 실패했습니다.' },
      { status: 500 }
    );
  }
}
