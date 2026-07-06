/**
 * Public News API
 * GET /api/news - 공개 게시물 목록 (/media "더 보기" 페이지네이션용)
 */

import { NextResponse } from 'next/server';
import { getNewsPosts } from '@/lib/d1';
import { isNewsCategory } from '@/types/news';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryParam = searchParams.get('category');
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1;
    const limit = Math.min(
      searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 9,
      50
    );

    const { posts, total } = await getNewsPosts({
      category: isNewsCategory(categoryParam) ? categoryParam : undefined,
      page,
      limit,
      published: true, // 공개 게시물만
    });

    return NextResponse.json({
      success: true,
      data: {
        posts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Public news fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load news posts.' },
      { status: 500 }
    );
  }
}
