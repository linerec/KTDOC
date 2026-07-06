/**
 * Admin News API
 * GET  /api/admin/news - 게시물 목록 (관리자·선생님, 비공개 포함)
 * POST /api/admin/news - 게시물 생성
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasMenuAccess } from '@/lib/admin/permissions';
import { getNewsPosts, createNewsPost } from '@/lib/d1';
import { isNewsCategory } from '@/types/news';
import type { CreateNewsPostInput } from '@/types/news';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'news'))) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const categoryParam = searchParams.get('category');
    const result = await getNewsPosts({
      category: isNewsCategory(categoryParam) ? categoryParam : undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20,
      published: 'all', // 비공개 포함 전체
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Admin news fetch error:', error);
    return NextResponse.json(
      { success: false, error: '게시물 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'news'))) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      category, title_ko, title_en, body_ko, body_en,
      source_name, external_url, youtube_url, thumbnail_url, thumbnail_r2_key,
      is_published, published_at,
    } = body;

    if (!isNewsCategory(category)) {
      return NextResponse.json(
        { success: false, error: '분류가 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    if (!title_ko) {
      return NextResponse.json(
        { success: false, error: '제목(한국어)은 필수입니다.' },
        { status: 400 }
      );
    }

    if (published_at && !/^\d{4}-\d{2}-\d{2}$/.test(published_at)) {
      return NextResponse.json(
        { success: false, error: '게시일 형식이 올바르지 않습니다. (예: 2026-07-01)' },
        { status: 400 }
      );
    }

    const input: CreateNewsPostInput = {
      category,
      title_ko,
      title_en,
      body_ko,
      body_en,
      source_name,
      external_url,
      youtube_url,
      thumbnail_url,
      thumbnail_r2_key,
      is_published: is_published ?? false,
      published_at,
      created_by: session?.user?.name || null,
    };

    const postId = await createNewsPost(input);

    return NextResponse.json({ success: true, data: { id: postId } });
  } catch (error) {
    console.error('Admin news create error:', error);
    return NextResponse.json(
      { success: false, error: '게시물 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
