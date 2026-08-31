/**
 * Admin Members API
 * GET  /api/admin/members - 가입 회원 목록 (관리자 전용)
 * POST /api/admin/members - 운영진이 원생 계정을 대신 만든다
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { effectiveAllowedByKey, getPermMatrix, viewerOf } from '@/lib/admin/permissions';
import {
  getMembers,
  getMemberById,
  linkGuardianToStudent,
  setTempPassword,
  MEMBER_ROLES,
  type MemberRole,
} from '@/lib/members';
import { createStudentByStaff } from '@/lib/members/createStudentByStaff';
import { linkResponseToMember } from '@/lib/d1/formResponses';
import { notifyEvent } from '@/lib/mail/notify';
import { generateTempPassword, hashPassword } from '@/lib/password';

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

/**
 * 운영진이 원생 계정을 대신 만든다 — 신청서 안에서 가입한 가족의 자녀처럼
 * **본인이 가입할 수 없는 원생**을 위한 입구다.
 *
 * 한 번의 호출로 네 가지를 끝낸다. 나눠 두면 중간에서 멈춘 계정이 남는다 —
 * 비밀번호 없는 계정, 메일을 못 받은 가족, 연결되지 않은 신청서.
 *
 *   ① 계정 생성(정회원, 약관 시각 없음 — createStudentByStaff 머리말 참고)
 *   ② 임시 비밀번호 발급 → must_change_password=1 (첫 로그인에서 강제 변경)
 *   ③ 한/영 안내 메일 (member.temp_password · 본문은 발송 내역에 남지 않는다)
 *   ④ 보호자 연결·신청서 연결
 *
 * ③을 await 하는 이유: 운영진이 '만들기'를 누른 자리에서 메일이 갔는지를
 * 화면이 말해야 한다. 임시 비밀번호는 응답에 한 번만 실리므로, 메일이 실패한
 * 것을 모르면 그 비밀번호를 전할 길이 사라진다.
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
    }
    // 회원 관리 화면과 같은 판정 — PATCH(승인·임시 비밀번호)와 같은 문을 쓴다
    const matrix = await getPermMatrix();
    if (!effectiveAllowedByKey('members', viewerOf(session), matrix)) {
      return NextResponse.json(
        { success: false, error: '회원 관리 접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => null)) as {
      name?: unknown;
      email?: unknown;
      enrollmentYear?: unknown;
      phone?: unknown;
      /** student_guardians 행 id — 주면 그 '미연결' 자리를 이 계정으로 잇는다 */
      guardianLinkId?: unknown;
      /** 신청서 응답 id — 주면 그 응답의 학생을 이 계정으로 잇는다 */
      responseId?: unknown;
    } | null;

    const created = await createStudentByStaff({
      name: typeof body?.name === 'string' ? body.name : '',
      email: typeof body?.email === 'string' ? body.email : '',
      enrollmentYear: typeof body?.enrollmentYear === 'number' ? body.enrollmentYear : null,
      phone: typeof body?.phone === 'string' ? body.phone : null,
    });
    if (!created.ok) {
      return NextResponse.json({ success: false, error: created.message }, { status: 400 });
    }

    // ② 임시 비밀번호 — 여기서 must_change_password가 켜진다
    const tempPassword = generateTempPassword();
    await setTempPassword(created.userId, await hashPassword(tempPassword), session.user.id);

    // ④ 연결 — 메일보다 먼저 해 둔다. 메일이 늦거나 실패해도 계정은 제자리에 있어야 한다.
    if (typeof body?.guardianLinkId === 'string' && body.guardianLinkId) {
      await linkGuardianToStudent(body.guardianLinkId, created.userId);
    }
    if (typeof body?.responseId === 'number' && Number.isInteger(body.responseId)) {
      await linkResponseToMember({
        responseId: body.responseId,
        studentUserId: created.userId,
        linkSource: 'manual',
      });
    }

    // ③ 한/영 안내 메일. 결과를 붙잡아 화면에 그대로 말한다.
    const member = await getMemberById(created.userId);
    const mail = await notifyEvent('member.temp_password', {
      userIds: [created.userId],
      data: { name: member?.name ?? '', tempPassword, url: process.env.AUTH_URL ?? '' },
    });

    return NextResponse.json({
      success: true,
      data: {
        member,
        // 평문은 이 응답에서 한 번만 나온다(저장은 해시뿐)
        tempPassword,
        mailSent: mail.sent > 0,
      },
    });
  } catch (error) {
    console.error('Admin student create error:', error);
    return NextResponse.json(
      { success: false, error: '원생 계정을 만들지 못했습니다.' },
      { status: 500 }
    );
  }
}
