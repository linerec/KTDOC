/**
 * Admin Profile API
 * PATCH /api/admin/profile - 로그인한 사용자가 자신의 프로필(이름)을 변경
 *
 * 이메일(로그인 ID)·권한은 여기서 변경하지 않는다. 비밀번호는 /api/admin/password.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import { setPublicArchiveConsent } from '@/lib/members';

interface ProfileBody {
  name?: string;
  /** 공개 수강생 페이지 노출 동의(opt-in) — 본인 것만 변경 */
  publicArchiveConsent?: boolean;
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const body: ProfileBody = await request.json();
    const rawName = typeof body.name === 'string' ? body.name.trim() : '';

    if (!rawName) {
      return NextResponse.json(
        { success: false, error: '이름을 입력해주세요.' },
        { status: 400 }
      );
    }
    if (rawName.length > 100) {
      return NextResponse.json(
        { success: false, error: '이름은 100자 이내로 입력해주세요.' },
        { status: 400 }
      );
    }

    await query('UPDATE users SET name = ? WHERE id = ?', [rawName, session.user.id]);

    // 공개 노출 동의는 선택적으로 함께 갱신(boolean이 넘어온 경우에만)
    if (typeof body.publicArchiveConsent === 'boolean') {
      await setPublicArchiveConsent(session.user.id, body.publicArchiveConsent);
    }

    return NextResponse.json({ success: true, name: rawName, message: '저장되었습니다.' });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    );
  }
}
