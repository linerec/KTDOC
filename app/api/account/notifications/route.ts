/**
 * 회원 이메일 수신 설정 — GET/PUT
 *
 * 스위치 하나. 끄면 일반 알림이 오지 않지만, 가입 확인·임시 비밀번호처럼
 * 못 받으면 계정을 쓸 수 없는 메일은 계속 나간다(lib/mail/recipients.ts의
 * essential 관문).
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }
    const rows = await query<{ email_opt_in: 0 | 1 }[]>(
      'SELECT email_opt_in FROM users WHERE id = ?',
      [session.user.id]
    );
    return NextResponse.json({
      success: true,
      emailOptIn: (rows[0]?.email_opt_in ?? 1) !== 0,
    });
  } catch (error) {
    console.error('수신 설정 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '설정을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }
    const body = (await request.json().catch(() => ({}))) as {
      emailOptIn?: unknown;
    };
    if (typeof body.emailOptIn !== 'boolean') {
      return NextResponse.json(
        { success: false, error: '잘못된 요청입니다.' },
        { status: 400 }
      );
    }
    await query('UPDATE users SET email_opt_in = ? WHERE id = ?', [
      body.emailOptIn ? 1 : 0,
      session.user.id,
    ]);
    return NextResponse.json({ success: true, emailOptIn: body.emailOptIn });
  } catch (error) {
    console.error('수신 설정 저장 오류:', error);
    return NextResponse.json(
      { success: false, error: '설정을 저장하지 못했습니다.' },
      { status: 500 }
    );
  }
}
