/**
 * Admin Supply Detail API (준비물 카탈로그)
 * GET    /api/admin/supplies/[id] - 항목 상세
 * PUT    /api/admin/supplies/[id] - 항목 수정
 * DELETE /api/admin/supplies/[id] - 항목 삭제 (연결 CASCADE, 이미지 R2 정리)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isStaff } from '@/lib/isAdmin';
import { getSupplyItemById, updateSupplyItem, deleteSupplyItem } from '@/lib/d1';
import { deleteFromR2 } from '@/lib/r2';
import type { UpdateSupplyItemInput } from '@/types/supplies';

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
    const itemId = parseInt(id);
    if (isNaN(itemId)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }
    const item = await getSupplyItemById(itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: '준비물을 찾을 수 없습니다.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error('Admin supply fetch error:', error);
    return NextResponse.json({ success: false, error: '준비물 정보를 불러오는데 실패했습니다.' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json({ success: false, error: '운영진 권한이 필요합니다.' }, { status: 403 });
    }
    const { id } = await params;
    const itemId = parseInt(id);
    if (isNaN(itemId)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }
    const existing = await getSupplyItemById(itemId);
    if (!existing) {
      return NextResponse.json({ success: false, error: '준비물을 찾을 수 없습니다.' }, { status: 404 });
    }

    const body = await request.json();
    const input: UpdateSupplyItemInput = {};
    const textFields: (keyof UpdateSupplyItemInput)[] = [
      'name_ko', 'name_en', 'description_ko', 'description_en', 'slug', 'image_url', 'image_r2_key',
    ];
    for (const field of textFields) {
      if (body[field] !== undefined) {
        input[field] = body[field];
      }
    }
    if (body.glossary_term_id !== undefined) input.glossary_term_id = body.glossary_term_id ?? null;
    if (body.is_active !== undefined) input.is_active = body.is_active;
    if (body.sort_order !== undefined) input.sort_order = body.sort_order;

    // 이미지 교체 시 기존 R2 객체 삭제
    if (input.image_r2_key && existing.image_r2_key && existing.image_r2_key !== input.image_r2_key) {
      try {
        await deleteFromR2(existing.image_r2_key);
      } catch (e) {
        console.warn('Failed to delete old supply image from R2:', e);
      }
    }

    await updateSupplyItem(itemId, input);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin supply update error:', error);
    return NextResponse.json({ success: false, error: '준비물 수정에 실패했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json({ success: false, error: '운영진 권한이 필요합니다.' }, { status: 403 });
    }
    const { id } = await params;
    const itemId = parseInt(id);
    if (isNaN(itemId)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }
    const removed = await deleteSupplyItem(itemId);
    if (!removed) {
      return NextResponse.json({ success: false, error: '준비물을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (removed.image_r2_key) {
      try {
        await deleteFromR2(removed.image_r2_key);
      } catch (e) {
        console.warn('Failed to delete supply image from R2:', e);
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin supply delete error:', error);
    return NextResponse.json({ success: false, error: '준비물 삭제에 실패했습니다.' }, { status: 500 });
  }
}
