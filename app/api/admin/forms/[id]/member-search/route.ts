/**
 * GET /api/admin/forms/[id]/member-search?q= — 대리 입력에서 고를 회원 찾기
 *
 * 상세 화면의 link-member 와 같은 조회를 쓰지만(lib/forms/memberSearch), 그쪽은
 * 응답 번호를 요구한다. 대리 입력은 **아직 응답이 없는 자리**라 이 라우트가 따로 있다.
 *
 * 문지기는 상세와 같다 — 신청서 메뉴 권한. 회원 관리(관리자 전용)보다 넓지만,
 * 이미 link-member 가 같은 사람들에게 같은 목록을 보여주고 있다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasMenuAccess } from '@/lib/admin/permissions';
import { searchLinkableMembers } from '@/lib/forms/memberSearch';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'forms'))) {
      return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
    }
    await params;

    const q = new URL(request.url).searchParams.get('q') ?? '';
    const members = await searchLinkableMembers(q);

    return NextResponse.json({ success: true, data: { members } });
  } catch (error) {
    console.error('Admin form member search error:', error);
    return NextResponse.json({ success: false, error: '검색하지 못했습니다.' }, { status: 500 });
  }
}
