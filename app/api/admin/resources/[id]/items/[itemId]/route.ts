/**
 * 공연 자료함 파일 하나 — 이름 변경 · 삭제
 * PATCH  /api/admin/resources/[id]/items/[itemId]  { title }
 * DELETE /api/admin/resources/[id]/items/[itemId]  R2 객체까지 지운다
 */

import { NextResponse } from 'next/server';
import { deleteFromR2 } from '@/lib/r2/upload';
import { deleteItem, getItem, updateItem } from '@/lib/d1/resources';
import { guardResourceAdmin, parseId } from '@/lib/resources/adminGuard';

type Ctx = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const guard = await guardResourceAdmin();
  if (!guard.ok) return guard.response;

  const { id: rawId, itemId: rawItemId } = await params;
  const id = parseId(rawId);
  const itemId = parseId(rawItemId);
  if (!id || !itemId) {
    return NextResponse.json({ success: false, error: '잘못된 주소입니다.' }, { status: 400 });
  }

  try {
    const body = (await request.json().catch(() => null)) as { title?: unknown } | null;
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    if (!title) {
      return NextResponse.json({ success: false, error: '이름을 비울 수 없습니다.' }, { status: 400 });
    }

    await updateItem(id, itemId, { title });
    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (error) {
    console.error('[resources] 파일 이름 변경 실패:', error);
    return NextResponse.json({ success: false, error: '저장하지 못했습니다.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const guard = await guardResourceAdmin();
  if (!guard.ok) return guard.response;

  const { id: rawId, itemId: rawItemId } = await params;
  const id = parseId(rawId);
  const itemId = parseId(rawItemId);
  if (!id || !itemId) {
    return NextResponse.json({ success: false, error: '잘못된 주소입니다.' }, { status: 400 });
  }

  try {
    const item = await getItem(id, itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: '파일을 찾을 수 없습니다.' }, { status: 404 });
    }

    // R2를 먼저 — 행을 먼저 지우면 키를 잃어 공개 버킷에 고아가 남는다
    try {
      await deleteFromR2(item.r2Key);
    } catch (error) {
      console.error(`[resources] R2 삭제 실패(${item.r2Key}):`, error);
    }

    await deleteItem(id, itemId);
    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (error) {
    console.error('[resources] 파일 삭제 실패:', error);
    return NextResponse.json({ success: false, error: '삭제하지 못했습니다.' }, { status: 500 });
  }
}
