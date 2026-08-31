/**
 * 공연 자료함 파일 — 업로드 마무리 · 순서
 * POST  /api/admin/resources/[id]/items   브라우저가 R2에 올린 것을 확인하고 붙인다
 * PATCH /api/admin/resources/[id]/items   { orderedIds } 로 순서를 다시 쓴다
 *
 * 파일 자체는 여기 오지 않는다 — 브라우저가 R2로 곧장 올렸고(lib/uploadClient.ts),
 * 여기 오는 것은 티켓뿐이다. Vercel 4.5MB 본문 한도와 무관한 이유가 그것이다.
 */

import { NextResponse } from 'next/server';
import { readUploads } from '@/lib/r2/readUploads';
import { uploadTargetByKey } from '@/lib/r2/uploadTargets';
import { addItems, getVaultById, reorderItems } from '@/lib/d1/resources';
import { guardResourceAdmin, parseId } from '@/lib/resources/adminGuard';
import type { NewResourceItem } from '@/types/resources';

type Ctx = { params: Promise<{ id: string }> };

/** 확장자를 뗀 파일명이 기본 표시 이름 — 「부채춤 반주.mp3」→「부채춤 반주」 */
function defaultTitle(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  return base.replace(/\.[^.]+$/, '') || base;
}

export async function POST(request: Request, { params }: Ctx) {
  const guard = await guardResourceAdmin();
  if (!guard.ok) return guard.response;

  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ success: false, error: '잘못된 주소입니다.' }, { status: 400 });

  try {
    const vault = await getVaultById(id);
    if (!vault) {
      return NextResponse.json({ success: false, error: '자료함을 찾을 수 없습니다.' }, { status: 404 });
    }

    const target = uploadTargetByKey('resource-items', `resources/${id}`);
    if (!target) {
      return NextResponse.json(
        { success: false, error: '업로드 설정을 찾지 못했습니다.' },
        { status: 500 }
      );
    }

    const intake = await readUploads(request, { target, userId: guard.userId, maxFiles: 20 });
    if (!intake.uploads.length) {
      return NextResponse.json(
        { success: false, error: intake.error ?? '올릴 파일이 없습니다.' },
        { status: 400 }
      );
    }

    // 음원 길이는 브라우저가 읽어 보낸다(서버는 오디오를 열지 않는다).
    // 표시 전용이라 틀려도 아무것도 깨지지 않는다 — 그래서 믿고 쓴다.
    let durations: Record<string, number> = {};
    try {
      const raw = intake.field('durations');
      if (raw) durations = JSON.parse(raw) as Record<string, number>;
    } catch {
      durations = {};
    }

    const rows: NewResourceItem[] = intake.uploads.map((upload) => {
      const seconds = durations[upload.originalName];
      return {
        title: defaultTitle(upload.originalName),
        r2Key: upload.key,
        fileName: upload.originalName,
        contentType: upload.contentType,
        sizeBytes: upload.size,
        durationSeconds: Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : null,
      };
    });

    const items = await addItems(id, rows);
    return NextResponse.json({ success: true, data: { items } });
  } catch (error) {
    console.error('[resources] 파일 추가 실패:', error);
    return NextResponse.json({ success: false, error: '파일을 저장하지 못했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  const guard = await guardResourceAdmin();
  if (!guard.ok) return guard.response;

  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ success: false, error: '잘못된 주소입니다.' }, { status: 400 });

  try {
    const body = (await request.json().catch(() => null)) as { orderedIds?: unknown } | null;
    const orderedIds = Array.isArray(body?.orderedIds)
      ? body.orderedIds.filter((n): n is number => Number.isInteger(n))
      : [];

    if (!orderedIds.length) {
      return NextResponse.json({ success: false, error: '순서가 비어 있습니다.' }, { status: 400 });
    }

    await reorderItems(id, orderedIds);
    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (error) {
    console.error('[resources] 순서 변경 실패:', error);
    return NextResponse.json({ success: false, error: '순서를 바꾸지 못했습니다.' }, { status: 500 });
  }
}
