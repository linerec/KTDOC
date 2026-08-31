/**
 * 공연 자료함 — 상세·수정·삭제
 * GET    /api/admin/resources/[id]  자료함 + 파일 + 접근 기록 + (복호한) 비밀번호
 * PATCH  /api/admin/resources/[id]  설정 수정 · 비밀번호 변경 · 받기 링크 무효화
 * DELETE /api/admin/resources/[id]  R2 객체까지 함께 지운다
 */

import { NextResponse } from 'next/server';
import { deleteFromR2 } from '@/lib/r2/upload';
import {
  bumpLinkEpoch,
  deleteVault,
  getVaultById,
  listAccessLog,
  listItems,
  logAccess,
  updateVault,
} from '@/lib/d1/resources';
import { authSecret, guardResourceAdmin, parseId } from '@/lib/resources/adminGuard';
import {
  decryptPasscode,
  encryptPasscode,
  isValidPasscode,
  PASSCODE_MAX,
  PASSCODE_MIN,
} from '@/lib/resources/passcode';
import { hashIp } from '@/lib/resources/tokens';
import type { UpdateVaultInput } from '@/types/resources';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const guard = await guardResourceAdmin();
  if (!guard.ok) return guard.response;

  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ success: false, error: '잘못된 주소입니다.' }, { status: 400 });

  try {
    const vault = await getVaultById(id);
    if (!vault) {
      return NextResponse.json({ success: false, error: '자료함을 찾을 수 없습니다.' }, { status: 404 });
    }

    const [items, log] = await Promise.all([listItems(id), listAccessLog(id, 100)]);

    // 비밀번호를 드러내 보이는 것도 기록에 남긴다 — 누가 언제 봤는지가 있어야
    // "어디서 샜나"에 답할 수 있다.
    const passcode = decryptPasscode(vault.passcodeEnc, authSecret());
    await logAccess({
      vaultId: id,
      code: vault.code,
      action: 'passcode_view',
      ipHash: hashIp(request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null, authSecret()),
      userAgent: request.headers.get('user-agent'),
      detail: guard.userId,
    });

    // passcodeEnc는 응답에 싣지 않는다 — 복호값(또는 null)만 나간다
    const { passcodeEnc: _omit, ...safeVault } = vault;
    void _omit;

    return NextResponse.json({
      success: true,
      data: { vault: safeVault, items, log, passcode },
    });
  } catch (error) {
    console.error('[resources] 상세 조회 실패:', error);
    return NextResponse.json(
      { success: false, error: '자료함을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  const guard = await guardResourceAdmin();
  if (!guard.ok) return guard.response;

  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ success: false, error: '잘못된 주소입니다.' }, { status: 400 });

  try {
    const vault = await getVaultById(id);
    if (!vault) {
      return NextResponse.json({ success: false, error: '자료함을 찾을 수 없습니다.' }, { status: 404 });
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const patch: UpdateVaultInput = {};

    if (typeof body?.title === 'string') {
      const title = body.title.trim();
      if (!title) {
        return NextResponse.json({ success: false, error: '제목을 비울 수 없습니다.' }, { status: 400 });
      }
      patch.title = title;
    }
    if (typeof body?.note === 'string') patch.note = body.note.trim() || null;
    if (body?.eventId === null || typeof body?.eventId === 'number') {
      patch.eventId = body.eventId as number | null;
    }
    if (typeof body?.allowDownload === 'boolean') patch.allowDownload = body.allowDownload;
    if (typeof body?.allowEmail === 'boolean') patch.allowEmail = body.allowEmail;
    if (typeof body?.active === 'boolean') patch.active = body.active;
    if (body?.expiresAt === null || typeof body?.expiresAt === 'string') {
      patch.expiresAt = (body.expiresAt as string | null) || null;
    }

    if (typeof body?.passcode === 'string' && body.passcode) {
      if (!isValidPasscode(body.passcode)) {
        return NextResponse.json(
          { success: false, error: `비밀번호는 숫자 ${PASSCODE_MIN}~${PASSCODE_MAX}자리로 정해 주세요.` },
          { status: 400 }
        );
      }
      patch.passcodeEnc = encryptPasscode(body.passcode, authSecret());
    }

    await updateVault(id, patch);

    // 받기 링크 무효화는 같은 표의 같은 행을 고치는 일이라 라우트를 나누지 않는다
    if (body?.revokeLinks === true) await bumpLinkEpoch(id);

    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (error) {
    console.error('[resources] 수정 실패:', error);
    return NextResponse.json({ success: false, error: '저장하지 못했습니다.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const guard = await guardResourceAdmin();
  if (!guard.ok) return guard.response;

  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ success: false, error: '잘못된 주소입니다.' }, { status: 400 });

  try {
    const vault = await getVaultById(id);
    if (!vault) {
      return NextResponse.json({ success: false, error: '자료함을 찾을 수 없습니다.' }, { status: 404 });
    }

    // R2를 **먼저** 지운다. D1 행을 먼저 지우면 키를 잃어 고아 객체가 남고,
    // 그 객체는 공개 버킷에 영원히 누워 있게 된다.
    const items = await listItems(id);
    for (const item of items) {
      try {
        await deleteFromR2(item.r2Key);
      } catch (error) {
        console.error(`[resources] R2 삭제 실패(${item.r2Key}):`, error);
      }
    }

    await deleteVault(id);
    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (error) {
    console.error('[resources] 삭제 실패:', error);
    return NextResponse.json({ success: false, error: '삭제하지 못했습니다.' }, { status: 500 });
  }
}
