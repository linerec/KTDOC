/**
 * Admin Members API
 * GET /api/admin/members - 가입 회원 목록 (관리자 전용)
 *
 * 지금은 조회 전용. 향후 권한 변경(PATCH)·삭제(DELETE) 등으로 확장 가능.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { getMembers, MEMBER_ROLES, type MemberRole } from '@/lib/members';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const roleParam = searchParams.get('role');

    const result = await getMembers({
      role:
        roleParam && MEMBER_ROLES.includes(roleParam as MemberRole)
          ? (roleParam as MemberRole)
          : undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Admin members fetch error:', error);
    return NextResponse.json(
      { success: false, error: '회원 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
