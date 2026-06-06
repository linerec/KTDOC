/**
 * Admin Gallery Events API
 * POST /api/admin/gallery/events - 이벤트 생성
 * GET /api/admin/gallery/events - 이벤트 목록 (관리자용, 비공개 포함)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { getEvents, createEvent } from '@/lib/d1';
import type { CreateEventInput } from '@/types/gallery';

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
    const { title_ko, event_date, title_en, category_id, description_ko, description_en, is_published, is_featured, is_signature, signature_order, slug } = body;

    if (!title_ko || !event_date) {
      return NextResponse.json(
        { success: false, error: '제목과 날짜는 필수입니다.' },
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
    };

    const eventId = await createEvent(input);

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
