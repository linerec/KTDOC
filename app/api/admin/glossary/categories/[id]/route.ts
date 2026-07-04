/**
 * Admin Glossary Category Detail API (말모이 분류)
 * PUT    /api/admin/glossary/categories/[id] - 분류 수정
 * DELETE /api/admin/glossary/categories/[id] - 분류 삭제 (용어의 분류는 자동 해제)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isStaff } from '@/lib/isAdmin';
import { updateGlossaryCategory, deleteGlossaryCategory } from '@/lib/d1';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json({ success: false, error: '운영진 권한이 필요합니다.' }, { status: 403 });
    }
    const { id } = await params;
    const categoryId = parseInt(id);
    if (isNaN(categoryId)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }
    const body = await request.json();
    await updateGlossaryCategory(categoryId, {
      name_ko: body.name_ko,
      name_en: body.name_en,
      sort_order: body.sort_order,
      slug: body.slug,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin glossary category update error:', error);
    return NextResponse.json({ success: false, error: '분류 수정에 실패했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json({ success: false, error: '운영진 권한이 필요합니다.' }, { status: 403 });
    }
    const { id } = await params;
    const categoryId = parseInt(id);
    if (isNaN(categoryId)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }
    await deleteGlossaryCategory(categoryId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin glossary category delete error:', error);
    return NextResponse.json({ success: false, error: '분류 삭제에 실패했습니다.' }, { status: 500 });
  }
}
