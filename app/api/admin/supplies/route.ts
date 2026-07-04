/**
 * Admin Supplies API (준비물 카탈로그)
 * GET  /api/admin/supplies - 카탈로그 목록 (비활성 포함)
 * POST /api/admin/supplies - 항목 생성
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isStaff } from '@/lib/isAdmin';
import { getSupplyItems, createSupplyItem } from '@/lib/d1';
import type { CreateSupplyItemInput } from '@/types/supplies';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json({ success: false, error: '운영진 권한이 필요합니다.' }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const result = await getSupplyItems({
      search: searchParams.get('search') || undefined,
      active: 'all',
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Admin supplies fetch error:', error);
    return NextResponse.json({ success: false, error: '준비물 목록을 불러오는데 실패했습니다.' }, { status: 500 });
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
      return NextResponse.json({ success: false, error: '준비물 이름(한글)은 필수입니다.' }, { status: 400 });
    }

    const input: CreateSupplyItemInput = {
      name_ko: body.name_ko,
      name_en: body.name_en,
      description_ko: body.description_ko,
      description_en: body.description_en,
      image_url: body.image_url ?? null,
      image_r2_key: body.image_r2_key ?? null,
      glossary_term_id: body.glossary_term_id ?? null,
      is_active: body.is_active ?? true,
      sort_order: body.sort_order,
      slug: body.slug,
    };

    const id = await createSupplyItem(input);
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Admin supply create error:', error);
    return NextResponse.json({ success: false, error: '준비물 생성에 실패했습니다.' }, { status: 500 });
  }
}
