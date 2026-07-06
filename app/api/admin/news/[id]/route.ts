/**
 * Admin News Detail API
 * GET    /api/admin/news/[id] - 게시물 상세
 * PUT    /api/admin/news/[id] - 게시물 수정
 * DELETE /api/admin/news/[id] - 게시물 삭제
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasMenuAccess } from '@/lib/admin/permissions';
import { getNewsPostById, updateNewsPost, deleteNewsPost } from '@/lib/d1';
import { deleteFromR2 } from '@/lib/r2';
import { isNewsCategory } from '@/types/news';
import type { UpdateNewsPostInput } from '@/types/news';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'news'))) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const postId = parseInt(id);
    if (isNaN(postId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      );
    }

    const post = await getNewsPostById(postId);
    if (!post) {
      return NextResponse.json(
        { success: false, error: '게시물을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: post });
  } catch (error) {
    console.error('Admin news detail error:', error);
    return NextResponse.json(
      { success: false, error: '게시물을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'news'))) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const postId = parseInt(id);
    if (isNaN(postId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      );
    }

    const existing = await getNewsPostById(postId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: '게시물을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const body = await request.json();

    if (body.category !== undefined && !isNewsCategory(body.category)) {
      return NextResponse.json(
        { success: false, error: '분류가 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    if (body.title_ko !== undefined && !body.title_ko) {
      return NextResponse.json(
        { success: false, error: '제목(한국어)은 필수입니다.' },
        { status: 400 }
      );
    }

    if (body.published_at && !/^\d{4}-\d{2}-\d{2}$/.test(body.published_at)) {
      return NextResponse.json(
        { success: false, error: '게시일 형식이 올바르지 않습니다. (예: 2026-07-01)' },
        { status: 400 }
      );
    }

    const input: UpdateNewsPostInput = {};
    if (body.category !== undefined) input.category = body.category;
    if (body.title_ko !== undefined) input.title_ko = body.title_ko;
    if (body.title_en !== undefined) input.title_en = body.title_en;
    if (body.body_ko !== undefined) input.body_ko = body.body_ko;
    if (body.body_en !== undefined) input.body_en = body.body_en;
    if (body.source_name !== undefined) input.source_name = body.source_name;
    if (body.external_url !== undefined) input.external_url = body.external_url;
    if (body.youtube_url !== undefined) input.youtube_url = body.youtube_url;
    if (body.thumbnail_url !== undefined) input.thumbnail_url = body.thumbnail_url;
    if (body.thumbnail_r2_key !== undefined) input.thumbnail_r2_key = body.thumbnail_r2_key;
    if (body.is_published !== undefined) input.is_published = body.is_published;
    if (body.published_at !== undefined) input.published_at = body.published_at;

    await updateNewsPost(postId, input);

    // 썸네일이 교체·제거됐으면 이전 R2 객체 정리(best-effort — 실패해도 수정은 유지)
    if (
      body.thumbnail_r2_key !== undefined &&
      existing.thumbnail_r2_key &&
      existing.thumbnail_r2_key !== body.thumbnail_r2_key
    ) {
      try {
        await deleteFromR2(existing.thumbnail_r2_key);
      } catch (err) {
        console.error('이전 썸네일 R2 삭제 실패:', err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin news update error:', error);
    return NextResponse.json(
      { success: false, error: '게시물 수정에 실패했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'news'))) {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const postId = parseInt(id);
    if (isNaN(postId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      );
    }

    const post = await getNewsPostById(postId);
    if (!post) {
      return NextResponse.json(
        { success: false, error: '게시물을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 썸네일 R2 객체 정리(best-effort)
    if (post.thumbnail_r2_key) {
      try {
        await deleteFromR2(post.thumbnail_r2_key);
      } catch (err) {
        console.error('썸네일 R2 삭제 실패:', err);
      }
    }

    await deleteNewsPost(postId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin news delete error:', error);
    return NextResponse.json(
      { success: false, error: '게시물 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
