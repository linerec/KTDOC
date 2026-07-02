/**
 * Admin Gallery Event Detail API
 * GET /api/admin/gallery/events/[id] - 이벤트 상세
 * PUT /api/admin/gallery/events/[id] - 이벤트 수정
 * DELETE /api/admin/gallery/events/[id] - 이벤트 삭제
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import {
  getEventById,
  updateEvent,
  deleteEvent,
  isEventSlugTaken,
  filterR2KeysInArchive,
} from '@/lib/d1';
import { deleteFromR2 } from '@/lib/r2';
import { isValidLatLng } from '@/lib/maps';
import type { UpdateEventInput } from '@/types/gallery';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - 이벤트 상세 (관리자용)
export async function GET(request: Request, { params }: RouteParams) {
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
        { success: false, error: '유효하지 않은 ID입니다.' },
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

    return NextResponse.json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error('Admin gallery event fetch error:', error);
    return NextResponse.json(
      { success: false, error: '이벤트 정보를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// PUT - 이벤트 수정
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
    const eventId = parseInt(id);

    if (isNaN(eventId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 ID입니다.' },
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

    const body = await request.json();
    const input: UpdateEventInput = {};

    // Only update provided fields
    if (body.title_ko !== undefined) input.title_ko = body.title_ko;
    if (body.title_en !== undefined) input.title_en = body.title_en;
    if (body.event_date !== undefined) input.event_date = body.event_date;
    if (body.description_ko !== undefined) input.description_ko = body.description_ko;
    if (body.description_en !== undefined) input.description_en = body.description_en;
    if (body.category_id !== undefined) input.category_id = body.category_id;
    if (body.slug !== undefined) input.slug = body.slug;
    if (body.poster_url !== undefined) input.poster_url = body.poster_url;
    if (body.poster_r2_key !== undefined) input.poster_r2_key = body.poster_r2_key;
    if (body.thumbnail_url !== undefined) input.thumbnail_url = body.thumbnail_url;
    if (body.thumbnail_r2_key !== undefined) input.thumbnail_r2_key = body.thumbnail_r2_key;
    if (body.is_published !== undefined) input.is_published = body.is_published;
    if (body.is_featured !== undefined) input.is_featured = body.is_featured;
    if (body.is_signature !== undefined) input.is_signature = body.is_signature;

    if (input.event_date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(input.event_date)) {
      return NextResponse.json(
        { success: false, error: '행사 날짜 형식이 올바르지 않습니다. (예: 2026-07-01)' },
        { status: 400 }
      );
    }

    // slug는 이벤트 URL이자 UNIQUE 컬럼 — 중복이면 저장 전에 명확히 알린다
    if (input.slug !== undefined) {
      if (!input.slug) {
        return NextResponse.json(
          { success: false, error: '이벤트 주소(slug)는 비울 수 없습니다.' },
          { status: 400 }
        );
      }
      if (await isEventSlugTaken(input.slug, eventId)) {
        return NextResponse.json(
          { success: false, error: '이미 다른 이벤트가 사용 중인 주소(slug)입니다. 다른 값을 입력해주세요.' },
          { status: 409 }
        );
      }
    }
    if (body.signature_order !== undefined) input.signature_order = body.signature_order;
    if (body.location !== undefined) input.location = body.location;
    if (body.location_url !== undefined) input.location_url = body.location_url;
    if (body.location_address !== undefined) input.location_address = body.location_address;
    if (body.location_lat !== undefined || body.location_lng !== undefined) {
      // 좌표는 둘 다 있거나(유효 범위) 둘 다 null이어야 한다
      const lat = body.location_lat ?? null;
      const lng = body.location_lng ?? null;
      if ((lat === null) !== (lng === null) || (lat !== null && !isValidLatLng(lat, lng))) {
        return NextResponse.json(
          { success: false, error: '위치 좌표가 올바르지 않습니다. 주소 검색으로 다시 지정해주세요.' },
          { status: 400 }
        );
      }
      input.location_lat = lat;
      input.location_lng = lng;
    }
    if (body.call_time !== undefined) input.call_time = body.call_time;
    if (body.start_time !== undefined) input.start_time = body.start_time;
    if (body.end_time !== undefined) input.end_time = body.end_time;
    if (body.prep_notes !== undefined) input.prep_notes = body.prep_notes;

    // Handle poster replacement - delete old R2 file
    if (input.poster_r2_key && event.poster_r2_key && event.poster_r2_key !== input.poster_r2_key) {
      try {
        await deleteFromR2(event.poster_r2_key);
      } catch (e) {
        console.warn('Failed to delete old poster from R2:', e);
      }
    }

    // Handle thumbnail replacement - delete old R2 file
    if (input.thumbnail_r2_key && event.thumbnail_r2_key && event.thumbnail_r2_key !== input.thumbnail_r2_key) {
      try {
        await deleteFromR2(event.thumbnail_r2_key);
      } catch (e) {
        console.warn('Failed to delete old thumbnail from R2:', e);
      }
    }

    await updateEvent(eventId, input);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin gallery event update error:', error);
    return NextResponse.json(
      { success: false, error: '이벤트 수정에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE - 이벤트 삭제
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
        { success: false, error: '유효하지 않은 ID입니다.' },
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

    // Delete all images from R2 first.
    // 단, 보관함(gallery_photos)에서 이벤트로 연결된 사진은 같은 R2 객체를 공유한다 —
    // 이벤트가 삭제되면 그 사진은 연결만 풀리고(FK SET NULL) 보관함에 남으므로 R2 객체를 지우면 안 된다.
    if (event.images && event.images.length > 0) {
      const archiveKeys = await filterR2KeysInArchive(event.images.map((img) => img.r2_key));
      for (const image of event.images) {
        if (archiveKeys.has(image.r2_key)) continue;
        try {
          await deleteFromR2(image.r2_key);
        } catch (e) {
          console.warn('Failed to delete image from R2:', e);
        }
      }
    }

    // Delete poster and thumbnail from R2
    if (event.poster_r2_key) {
      try {
        await deleteFromR2(event.poster_r2_key);
      } catch (e) {
        console.warn('Failed to delete poster from R2:', e);
      }
    }
    if (event.thumbnail_r2_key) {
      try {
        await deleteFromR2(event.thumbnail_r2_key);
      } catch (e) {
        console.warn('Failed to delete thumbnail from R2:', e);
      }
    }

    // Delete event (CASCADE will handle images and videos in DB)
    await deleteEvent(eventId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin gallery event delete error:', error);
    return NextResponse.json(
      { success: false, error: '이벤트 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
