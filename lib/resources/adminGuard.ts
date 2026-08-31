/**
 * 자료함 관리 API의 첫 줄 — 네 라우트가 같은 판정을 쓴다.
 *
 * 이 판정은 세 곳에서 같아야 한다:
 *   ① 여기(관리 API)
 *   ② app/admin/resources/* 페이지의 requireMenuAccess('resources')
 *   ③ lib/r2/uploadTargets.ts의 'resource-items'
 *
 * ①과 ③이 어긋나면 "화면은 막는데 서명은 나가는" 구멍이 된다. 그래서 둘 다
 * isAdmin 한 함수를 부른다. 학내 행사 때 메뉴만 열고 API가 막아 겪은 일의
 * 반대 방향이다 — 그쪽은 불편이었고 이쪽은 사고다.
 */

import 'server-only';
import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';

export type AdminGuard =
  | { ok: true; session: Session; userId: string }
  | { ok: false; response: NextResponse };

export async function guardResourceAdmin(): Promise<AdminGuard> {
  const session = await auth();
  if (!isAdmin(session) || !session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: '권한이 없습니다.' },
        { status: 403 }
      ),
    };
  }
  return { ok: true, session, userId: session.user.id };
}

/** 경로의 :id를 자료함 번호(정수)로 읽는다. 아니면 null. */
export function parseId(value: string): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** AUTH_SECRET — 없으면 자료함이 통째로 동작할 수 없으므로 던진다. */
export function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET 없음 — 자료함 비밀번호를 다룰 수 없습니다.');
  return secret;
}
