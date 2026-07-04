/**
 * Admin Supply Sets API (준비물 세트)
 * GET  /api/admin/supplies/sets - 세트 목록(구성 항목 포함)
 * POST /api/admin/supplies/sets - 세트 생성
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isStaff } from '@/lib/isAdmin';
import { getSupplySets, createSupplySet } from '@/lib/d1';
import type { CreateSupplySetInput } from '@/types/supplies';

function normalizeItemIds(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json({ success: false, error: '운영진 권한이 필요합니다.' }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const result = await getSupplySets({
      search: searchParams.get('search') || undefined,
      active: 'all',
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Admin supply sets fetch error:', error);
    return NextResponse.json({ success: false, error: '세트 목록을 불러오는데 실패했습니다.' }, { status: 500 });
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
      return NextResponse.json({ success: false, error: '세트 이름(한글)은 필수입니다.' }, { status: 400 });
    }
    const input: CreateSupplySetInput = {
      name_ko: body.name_ko,
      name_en: body.name_en,
      description_ko: body.description_ko,
      description_en: body.description_en,
      is_active: body.is_active ?? true,
      sort_order: body.sort_order,
      item_ids: normalizeItemIds(body.item_ids),
    };
    const id = await createSupplySet(input);
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Admin supply set create error:', error);
    return NextResponse.json({ success: false, error: '세트 생성에 실패했습니다.' }, { status: 500 });
  }
}
