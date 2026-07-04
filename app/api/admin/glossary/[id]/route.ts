/**
 * Admin Glossary Detail API (말모이)
 * GET    /api/admin/glossary/[id] - 용어 상세
 * PUT    /api/admin/glossary/[id] - 용어 수정
 * DELETE /api/admin/glossary/[id] - 용어 삭제 (첨부 이미지 R2 정리 포함)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isStaff } from '@/lib/isAdmin';
import { getGlossaryTermById, updateGlossaryTerm, deleteGlossaryTerm } from '@/lib/d1';
import { deleteFromR2 } from '@/lib/r2';
import type { UpdateGlossaryTermInput } from '@/types/glossary';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json({ success: false, error: '운영진 권한이 필요합니다.' }, { status: 403 });
    }

    const { id } = await params;
    const termId = parseInt(id);
    if (isNaN(termId)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }

    const term = await getGlossaryTermById(termId);
    if (!term) {
      return NextResponse.json({ success: false, error: '용어를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: term });
  } catch (error) {
    console.error('Admin glossary fetch error:', error);
    return NextResponse.json(
      { success: false, error: '용어 정보를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json({ success: false, error: '운영진 권한이 필요합니다.' }, { status: 403 });
    }

    const { id } = await params;
    const termId = parseInt(id);
    if (isNaN(termId)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }

    const existing = await getGlossaryTermById(termId);
    if (!existing) {
      return NextResponse.json({ success: false, error: '용어를 찾을 수 없습니다.' }, { status: 404 });
    }

    const body = await request.json();
    const input: UpdateGlossaryTermInput = {};

    const textFields: (keyof UpdateGlossaryTermInput)[] = [
      'term_ko', 'term_en', 'romanization', 'pronunciation',
      'definition_ko', 'definition_en', 'example_ko', 'example_en',
      'slug', 'image_url', 'image_r2_key',
    ];
    for (const field of textFields) {
      if (body[field] !== undefined) {
        input[field] = body[field];
      }
    }
    if (body.category_id !== undefined) input.category_id = body.category_id ?? null;
    if (body.is_published !== undefined) input.is_published = body.is_published;
    if (body.sort_order !== undefined) input.sort_order = body.sort_order;

    await updateGlossaryTerm(termId, input);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin glossary update error:', error);
    return NextResponse.json(
      { success: false, error: '용어 수정에 실패했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json({ success: false, error: '운영진 권한이 필요합니다.' }, { status: 403 });
    }

    const { id } = await params;
    const termId = parseInt(id);
    if (isNaN(termId)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }

    const removed = await deleteGlossaryTerm(termId);
    if (!removed) {
      return NextResponse.json({ success: false, error: '용어를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (removed.image_r2_key) {
      try {
        await deleteFromR2(removed.image_r2_key);
      } catch (e) {
        console.warn('Failed to delete glossary image from R2:', e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin glossary delete error:', error);
    return NextResponse.json(
      { success: false, error: '용어 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
