import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/password';

interface ChangePasswordBody {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

interface UserRow {
  id: string;
  password_hash: string;
}

// POST - 로그인한 사용자가 자신의 비밀번호를 변경 (관리자 대시보드용)
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const body: ChangePasswordBody = await request.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: '모든 항목을 입력해주세요.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: '새 비밀번호는 최소 8자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: '새 비밀번호가 일치하지 않습니다.' },
        { status: 400 }
      );
    }

    if (newPassword === currentPassword) {
      return NextResponse.json(
        { error: '새 비밀번호가 현재 비밀번호와 같습니다.' },
        { status: 400 }
      );
    }

    const users = await query<UserRow[]>(
      'SELECT id, password_hash FROM users WHERE id = ?',
      [session.user.id]
    );

    const user = users[0];
    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const isValid = await verifyPassword(currentPassword, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: '현재 비밀번호가 일치하지 않습니다.' },
        { status: 400 }
      );
    }

    const newHash = await hashPassword(newPassword);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [
      newHash,
      user.id,
    ]);

    return NextResponse.json({ message: '비밀번호가 변경되었습니다.' });
  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    );
  }
}
