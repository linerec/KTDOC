/**
 * Admin Glossary Categories API (말모이 분류)
 * GET  /api/admin/glossary/categories - 분류 목록(용어 수 포함)
 * POST /api/admin/glossary/categories - 분류 생성
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isStaff } from '@/lib/isAdmin';
import { getGlossaryCategories, createGlossaryCategory } from '@/lib/d1';

export async function GET() {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json({ success: false, error: '운영진 권한이 필요합니다.' }, { status: 403 });
    }
    const categories = await getGlossaryCategories();
    return NextResponse.json({ success: true, data: categories });
  } catch (error) {
    console.error('Admin glossary categories fetch error:', error);
    return NextResponse.json({ success: false, error: '분류를 불러오는데 실패했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json({ success: false, error: '운영진 권한이 필요합니다.' }, { status: 403 });
    }
    const body = await request.json();
    if (!body.name_ko) {
      return NextResponse.json({ success: false, error: '분류 이름(한글)은 필수입니다.' }, { status: 400 });
    }
    const id = await createGlossaryCategory({
      name_ko: body.name_ko,
      name_en: body.name_en,
      sort_order: body.sort_order,
      slug: body.slug,
    });
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Admin glossary category create error:', error);
    return NextResponse.json({ success: false, error: '분류 생성에 실패했습니다.' }, { status: 500 });
  }
}
