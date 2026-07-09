/**
 * POST /api/account/password — 임시 비밀번호 로그인 후 새 비밀번호 확정
 *
 * 운영진이 발급한 임시 비밀번호로 로그인한 회원(must_change_password=1)만
 * 사용할 수 있다. 방금 임시 비밀번호로 인증을 마친 상태이므로 현재 비밀번호를
 * 다시 요구하지 않는다(일반 변경은 /api/admin/password가 현재 비밀번호를 검증).
 * 판정은 토큰 클레임이 아니라 DB 값을 기준으로 한다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import { completePasswordChange } from '@/lib/members';
import { hashPassword, verifyPassword } from '@/lib/password';

interface UserRow {
  id: string;
  password_hash: string;
  must_change_password: 0 | 1;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const newPassword: unknown = body.newPassword;

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: '새 비밀번호는 최소 8자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    const rows = await query<UserRow[]>(
      'SELECT id, password_hash, must_change_password FROM users WHERE id = ?',
      [session.user.id]
    );
    const user = rows[0];
    if (!user) {
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (user.must_change_password !== 1) {
      // 이미 변경을 마친 뒤 남은 옛 토큰(다른 탭 등) — 클라이언트가 재로그인으로 풀도록 코드를 준다
      return NextResponse.json(
        { success: false, error: '새 비밀번호 설정이 필요한 상태가 아닙니다.', code: 'NOT_REQUIRED' },
        { status: 400 }
      );
    }

    // 임시 비밀번호를 그대로 새 비밀번호로 쓰는 것은 막는다
    if (await verifyPassword(newPassword, user.password_hash)) {
      return NextResponse.json(
        { success: false, error: '임시 비밀번호와 다른 비밀번호를 사용해 주세요.' },
        { status: 400 }
      );
    }

    await completePasswordChange(user.id, await hashPassword(newPassword));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Account password change error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    );
  }
}
