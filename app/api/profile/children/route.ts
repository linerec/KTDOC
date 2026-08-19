/**
 * 학부모 셀프 자녀 연결
 * GET    /api/profile/children              - 내 자녀 연결 목록(확정·미해결 모두)
 * POST   /api/profile/children {name, enrollmentYear} - 자녀 연결 신청
 * DELETE /api/profile/children {linkId}     - 내 **미해결** 신청 삭제
 *
 * 신청은 **항상 미해결(student_id NULL)로 만든다.** 이름만으로 자동 연결하면
 * 아무 학부모나 아무 원생에게 스스로를 붙여 그 원생의 일정·참여 기록에 닿을 수 있다.
 * 가입 때의 자동 매칭은 승인(pending→active)이 사람 관문이었지만, 이미 승인된
 * 계정에는 관문이 없다 — 그래서 운영진의 확정(회원 관리)이 관문이 된다.
 *
 * 확정된 연결의 해제도 운영진만 한다(잘못 눌러 자녀가 사라지는 사고 방지).
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isApproved } from '@/lib/isAdmin';
import {
  addGuardianChildLink,
  getGuardianLinkById,
  getMemberById,
  removeGuardianChildLink,
} from '@/lib/members';
import { MAX_CHILDREN, parseEnrollmentYear } from '@/lib/members/childEntries';
import { notifyStaffOfChildLinkRequest } from '@/lib/push/system';

function unauthorized() {
  return NextResponse.json(
    { success: false, error: '로그인이 필요합니다.' },
    { status: 401 }
  );
}

/** 학부모 본인 세션인지 확인하고 회원 정보를 돌려준다. */
async function requireParent() {
  const session = await auth();
  if (!session?.user?.id || !isApproved(session)) return null;
  if (session.user.role !== 'parent') return null;
  return session.user;
}

export async function GET() {
  const user = await requireParent();
  if (!user) return unauthorized();
  const member = await getMemberById(user.id!);
  return NextResponse.json({ success: true, data: { children: member?.children ?? [] } });
}

export async function POST(request: Request) {
  const user = await requireParent();
  if (!user) return unauthorized();

  try {
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const year = parseEnrollmentYear(body.enrollmentYear);
    if (!name) {
      return NextResponse.json(
        { success: false, error: '자녀(원생)의 이름을 입력해주세요.' },
        { status: 400 }
      );
    }
    if (year === null) {
      return NextResponse.json(
        { success: false, error: '자녀(원생)의 입학년도를 올바르게 선택해주세요.' },
        { status: 400 }
      );
    }

    // 상한은 서버가 지킨다 — 화면 버튼만 믿으면 API 직접 호출로 무제한 신청
    // + 신청마다 운영진 알림이 나가 스팸이 된다.
    const current = await getMemberById(user.id!);
    if ((current?.children ?? []).length >= MAX_CHILDREN) {
      return NextResponse.json(
        { success: false, error: `자녀 연결은 최대 ${MAX_CHILDREN}명까지 가능합니다. 그 이상은 학원에 문의해 주세요.` },
        { status: 400 }
      );
    }

    const added = await addGuardianChildLink({
      guardianId: user.id!,
      claimedName: name,
      claimedEnrollmentYear: year,
    });
    if (!added.ok) {
      return NextResponse.json(
        { success: false, error: '이미 신청된 자녀입니다. 운영진 확인을 기다려 주세요.' },
        { status: 409 }
      );
    }

    // 운영진이 확정해야 화면에 나타난다 — 알림이 실패해도 신청은 되돌리지 않는다.
    await notifyStaffOfChildLinkRequest({
      id: user.id!,
      name: user.name ?? '',
      childName: name,
    }).catch((err) => console.error('자녀 연결 신청 알림 실패:', err));

    const member = await getMemberById(user.id!);
    return NextResponse.json({
      success: true,
      data: { children: member?.children ?? [] },
    });
  } catch (error) {
    console.error('child link request error:', error);
    return NextResponse.json(
      { success: false, error: '신청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const user = await requireParent();
  if (!user) return unauthorized();

  try {
    const body = await request.json().catch(() => ({}));
    const linkId = typeof body.linkId === 'string' ? body.linkId : '';
    if (!linkId) {
      return NextResponse.json(
        { success: false, error: '삭제할 신청이 없습니다.' },
        { status: 400 }
      );
    }

    const link = await getGuardianLinkById(linkId);
    // 내 것이 아니거나, 이미 확정된 연결은 여기서 못 지운다(확정 해제는 운영진).
    if (!link || link.guardianId !== user.id) {
      return NextResponse.json(
        { success: false, error: '내 신청만 삭제할 수 있습니다.' },
        { status: 404 }
      );
    }
    if (link.studentId) {
      return NextResponse.json(
        { success: false, error: '확정된 연결은 학원에 해제를 요청해 주세요.' },
        { status: 403 }
      );
    }

    await removeGuardianChildLink(linkId);
    const member = await getMemberById(user.id!);
    return NextResponse.json({
      success: true,
      data: { children: member?.children ?? [] },
    });
  } catch (error) {
    console.error('child link delete error:', error);
    return NextResponse.json(
      { success: false, error: '삭제 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
