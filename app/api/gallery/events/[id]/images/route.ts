/**
 * Gallery Event Images API - 공개 이벤트 이미지 페이지네이션
 * GET /api/gallery/events/[id]/images?page=&limit=
 * 공개(is_published=1) 이벤트의 이미지만 페이지 단위로 반환한다.
 */

import { NextResponse } from 'next/server';
import { getEventImagesPaged } from '@/lib/d1';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const eventId = parseInt(id, 10);

    if (isNaN(eventId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 이벤트 ID입니다.' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    let page = parseInt(searchParams.get('page') || '1', 10);
    let limit = parseInt(searchParams.get('limit') || '24', 10);
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 24;
    if (limit > 100) limit = 100;

    // publishedOnly=true → 비공개 이벤트 이미지는 노출하지 않음
    const result = await getEventImagesPaged(eventId, page, limit, true);

    return NextResponse.json({
      success: true,
      data: {
        images: result.images,
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  } catch (error) {
    console.error('Gallery event images fetch error:', error);
    return NextResponse.json(
      { success: false, error: '이미지를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
