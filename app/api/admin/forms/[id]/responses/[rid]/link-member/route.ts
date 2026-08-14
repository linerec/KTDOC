/**
 * 응답 ↔ 회원 연결
 * GET  /api/admin/forms/[id]/responses/[rid]/link-member?q= — 회원 검색
 * POST /api/admin/forms/[id]/responses/[rid]/link-member    — 연결
 *
 * **미검증 이메일로 자동 연결하지 않는다.** 이 사이트는 회원가입 시 이메일을
 * 확인하지 않으므로, 이메일이 같다는 것만으로 두 사람을 같다고 볼 수 없다.
 * 운영진이 눈으로 보고 고른다 — link_source='manual' 이 그 사실을 기록한다.
 *
 * 연결 대상은 **대상 학생**이다. 제출자(학부모일 수 있다)와 구분해서 넣는다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasMenuAccess } from '@/lib/admin/permissions';
import { addResponseNote, getResponseById, linkResponseToMember } from '@/lib/d1';
import { getMemberById, getMembers } from '@/lib/members';

interface RouteParams {
  params: Promise<{ id: string; rid: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'forms'))) {
      return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
    }
    await params;

    const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
    if (q.length < 2) {
      return NextResponse.json({ success: true, data: { members: [] } });
    }

    const { members } = await getMembers({ search: q, limit: 20 });
    return NextResponse.json({
      success: true,
      data: {
        members: members.map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          role: m.role,
          status: m.status,
        })),
      },
    });
  } catch (error) {
    console.error('Admin form member search error:', error);
    return NextResponse.json({ success: false, error: '검색하지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'forms'))) {
      return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const { rid } = await params;
    const responseId = Number(rid);
    if (!Number.isInteger(responseId)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }

    const response = await getResponseById(responseId);
    if (!response) {
      return NextResponse.json({ success: false, error: '응답을 찾을 수 없습니다.' }, { status: 404 });
    }

    const body = await request.json();
    const userId = typeof body.userId === 'string' ? body.userId : '';
    if (!userId) {
      return NextResponse.json({ success: false, error: '연결할 회원을 골라 주세요.' }, { status: 400 });
    }

    const member = await getMemberById(userId);
    if (!member) {
      return NextResponse.json({ success: false, error: '회원을 찾을 수 없습니다.' }, { status: 404 });
    }

    await linkResponseToMember({ responseId, studentUserId: userId, linkSource: 'manual' });
    await addResponseNote({
      responseId,
      kind: 'link',
      body: `${member.name ?? member.email} 회원과 연결했습니다.`,
      authorId: session?.user?.id ?? null,
      authorName: session?.user?.name ?? null,
    });

    return NextResponse.json({ success: true, data: { userId } });
  } catch (error) {
    console.error('Admin form link member error:', error);
    return NextResponse.json({ success: false, error: '연결하지 못했습니다.' }, { status: 500 });
  }
}
