/**
 * Gallery Event Detail API - 이벤트 상세 조회
 * GET /api/gallery/events/[id]
 */

import { NextResponse } from 'next/server';
import { getEventById, getEventBySlug, incrementViewCount, getAdjacentEvents } from '@/lib/d1';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const includeAdjacent = searchParams.get('adjacent') === 'true';
    const trackView = searchParams.get('trackView') !== 'false';

    let event;

    // If year is provided, treat id as slug
    if (year) {
      event = await getEventBySlug(parseInt(year), id);
    } else {
      // Otherwise treat id as numeric ID
      const numericId = parseInt(id);
      if (isNaN(numericId)) {
        return NextResponse.json(
          { success: false, error: '유효하지 않은 ID입니다.' },
          { status: 400 }
        );
      }
      event = await getEventById(numericId);
    }

    if (!event) {
      return NextResponse.json(
        { success: false, error: '이벤트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Only show published events in public API
    if (!event.is_published) {
      return NextResponse.json(
        { success: false, error: '이벤트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // Track view count
    if (trackView) {
      await incrementViewCount(event.id);
    }

    // Get adjacent events if requested
    let adjacent = null;
    if (includeAdjacent) {
      adjacent = await getAdjacentEvents(event.id, event.year);
    }

    return NextResponse.json({
      success: true,
      data: {
        event,
        adjacent,
      },
    });
  } catch (error) {
    console.error('Gallery event detail fetch error:', error);
    return NextResponse.json(
      { success: false, error: '이벤트 정보를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
