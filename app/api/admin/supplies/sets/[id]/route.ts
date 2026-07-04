/**
 * Admin Supply Set Detail API (준비물 세트)
 * GET    /api/admin/supplies/sets/[id] - 세트 상세(구성 항목 포함)
 * PUT    /api/admin/supplies/sets/[id] - 세트 수정 (item_ids 제공 시 구성 전량 교체)
 * DELETE /api/admin/supplies/sets/[id] - 세트 삭제 (구성·연결 CASCADE)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isStaff } from '@/lib/isAdmin';
import { getSupplySetById, updateSupplySet, deleteSupplySet } from '@/lib/d1';
import type { UpdateSupplySetInput } from '@/types/supplies';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function normalizeItemIds(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json({ success: false, error: '운영진 권한이 필요합니다.' }, { status: 403 });
    }
    const { id } = await params;
    const setId = parseInt(id);
    if (isNaN(setId)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }
    const set = await getSupplySetById(setId);
    if (!set) {
      return NextResponse.json({ success: false, error: '세트를 찾을 수 없습니다.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: set });
  } catch (error) {
    console.error('Admin supply set fetch error:', error);
    return NextResponse.json({ success: false, error: '세트 정보를 불러오는데 실패했습니다.' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json({ success: false, error: '운영진 권한이 필요합니다.' }, { status: 403 });
    }
    const { id } = await params;
    const setId = parseInt(id);
    if (isNaN(setId)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }
    const existing = await getSupplySetById(setId);
    if (!existing) {
      return NextResponse.json({ success: false, error: '세트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const body = await request.json();
    const input: UpdateSupplySetInput = {};
    const textFields: (keyof UpdateSupplySetInput)[] = [
      'name_ko', 'name_en', 'description_ko', 'description_en', 'slug',
    ];
    for (const field of textFields) {
      if (body[field] !== undefined) {
        (input[field] as string) = body[field];
      }
    }
    if (body.is_active !== undefined) input.is_active = body.is_active;
    if (body.sort_order !== undefined) input.sort_order = body.sort_order;
    if (body.item_ids !== undefined) input.item_ids = normalizeItemIds(body.item_ids) ?? [];

    await updateSupplySet(setId, input);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin supply set update error:', error);
    return NextResponse.json({ success: false, error: '세트 수정에 실패했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json({ success: false, error: '운영진 권한이 필요합니다.' }, { status: 403 });
    }
    const { id } = await params;
    const setId = parseInt(id);
    if (isNaN(setId)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }
    const removed = await deleteSupplySet(setId);
    if (!removed) {
      return NextResponse.json({ success: false, error: '세트를 찾을 수 없습니다.' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin supply set delete error:', error);
    return NextResponse.json({ success: false, error: '세트 삭제에 실패했습니다.' }, { status: 500 });
  }
}
