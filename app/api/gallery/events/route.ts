/**
 * Gallery Events API - 공개 이벤트 목록
 * GET /api/gallery/events
 */

import { NextResponse } from 'next/server';
import { getEvents } from '@/lib/d1';
import type { EventFilters, EventsResponse, PaginationInfo } from '@/types/gallery';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse filters from query parameters
    const filters: EventFilters = {
      year: searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined,
      category: searchParams.get('category') || undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20,
      featured: searchParams.get('featured') === 'true' ? true : undefined,
      published: true, // Only show published events in public API
    };

    // Validate pagination
    if (filters.page && filters.page < 1) filters.page = 1;
    if (filters.limit && filters.limit < 1) filters.limit = 20;
    if (filters.limit && filters.limit > 100) filters.limit = 100;

    const { events, total, years } = await getEvents(filters);

    // Build pagination info
    const pagination: PaginationInfo = {
      page: filters.page || 1,
      limit: filters.limit || 20,
      total,
      totalPages: Math.ceil(total / (filters.limit || 20)),
    };

    const response: EventsResponse = {
      events,
      pagination,
      years,
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Gallery events fetch error:', error);
    return NextResponse.json(
      { success: false, error: '이벤트 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
