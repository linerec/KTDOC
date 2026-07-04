/**
 * Admin Gallery Events API
 * POST /api/admin/gallery/events - 이벤트 생성
 * GET /api/admin/gallery/events - 이벤트 목록 (관리자용, 비공개 포함)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { getEvents, createEvent, setEventSupplies, setEventSupplySets } from '@/lib/d1';
import { isValidLatLng } from '@/lib/maps';
import type { CreateEventInput } from '@/types/gallery';
import { normalizeSupplyLinks, normalizeSupplySetLinks } from '@/types/supplies';

// GET - 관리자용 이벤트 목록 (비공개 포함)
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const result = await getEvents({
      year: searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined,
      category: searchParams.get('category') || undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      published: 'all', // Show all (published and unpublished)
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Admin gallery events fetch error:', error);
    return NextResponse.json(
      { success: false, error: '이벤트 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// POST - 이벤트 생성
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
    const { title_ko, event_date, title_en, category_id, description_ko, description_en, is_published, is_featured, is_signature, signature_order, slug, location, location_url, location_address, location_lat, location_lng, call_time, start_time, end_time, prep_notes } = body;

    if (!title_ko || !event_date) {
      return NextResponse.json(
        { success: false, error: '제목과 날짜는 필수입니다.' },
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
      return NextResponse.json(
        { success: false, error: '행사 날짜 형식이 올바르지 않습니다. (예: 2026-07-01)' },
        { status: 400 }
      );
    }

    // 좌표는 둘 다 있거나(유효 범위) 둘 다 없어야 한다
    const hasLat = location_lat !== undefined && location_lat !== null;
    const hasLng = location_lng !== undefined && location_lng !== null;
    if (hasLat !== hasLng || (hasLat && !isValidLatLng(location_lat, location_lng))) {
      return NextResponse.json(
        { success: false, error: '위치 좌표가 올바르지 않습니다. 주소 검색으로 다시 지정해주세요.' },
        { status: 400 }
      );
    }

    const input: CreateEventInput = {
      title_ko,
      event_date,
      title_en,
      category_id,
      description_ko,
      description_en,
      is_published: is_published ?? false,
      is_featured: is_featured ?? false,
      is_signature: is_signature ?? false,
      signature_order,
      slug,
      location,
      location_url,
      location_address,
      location_lat,
      location_lng,
      call_time,
      start_time,
      end_time,
      prep_notes,
    };

    const eventId = await createEvent(input);
    if (body.supplies !== undefined) {
      await setEventSupplies(eventId, normalizeSupplyLinks(body.supplies));
    }
    if (body.supply_sets !== undefined) {
      await setEventSupplySets(eventId, normalizeSupplySetLinks(body.supply_sets));
    }

    return NextResponse.json({
      success: true,
      data: { id: eventId },
    });
  } catch (error) {
    console.error('Admin gallery event create error:', error);
    return NextResponse.json(
      { success: false, error: '이벤트 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
