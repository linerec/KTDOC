/**
 * 공연 자료함 — 목록·생성
 * GET  /api/admin/resources  목록(요약, 비밀번호 없음)
 * POST /api/admin/resources  새 자료함 (번호는 서버가 뽑는다)
 */

import { NextResponse } from 'next/server';
import { createVault, listVaults } from '@/lib/d1/resources';
import { authSecret, guardResourceAdmin } from '@/lib/resources/adminGuard';
import { encryptPasscode, isValidPasscode, PASSCODE_MAX, PASSCODE_MIN } from '@/lib/resources/passcode';

export async function GET() {
  const guard = await guardResourceAdmin();
  if (!guard.ok) return guard.response;

  try {
    const vaults = await listVaults();
    return NextResponse.json({ success: true, data: { vaults } });
  } catch (error) {
    console.error('[resources] 목록 조회 실패:', error);
    return NextResponse.json(
      { success: false, error: '자료함 목록을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const guard = await guardResourceAdmin();
  if (!guard.ok) return guard.response;

  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const passcode = typeof body?.passcode === 'string' ? body.passcode : '';

    if (!title) {
      return NextResponse.json({ success: false, error: '제목을 입력해 주세요.' }, { status: 400 });
    }
    if (!isValidPasscode(passcode)) {
      return NextResponse.json(
        { success: false, error: `비밀번호는 숫자 ${PASSCODE_MIN}~${PASSCODE_MAX}자리로 정해 주세요.` },
        { status: 400 }
      );
    }

    const created = await createVault({
      title,
      note: typeof body?.note === 'string' ? body.note.trim() || null : null,
      passcodeEnc: encryptPasscode(passcode, authSecret()),
      eventId: typeof body?.eventId === 'number' ? body.eventId : null,
      allowDownload: body?.allowDownload !== false,
      allowEmail: body?.allowEmail !== false,
      expiresAt: typeof body?.expiresAt === 'string' && body.expiresAt ? body.expiresAt : null,
      createdBy: guard.userId,
    });

    return NextResponse.json({ success: true, data: { vault: created } });
  } catch (error) {
    console.error('[resources] 생성 실패:', error);
    return NextResponse.json(
      { success: false, error: '자료함을 만들지 못했습니다.' },
      { status: 500 }
    );
  }
}
