/**
 * Admin Program Enrollments API
 * POST /api/admin/programs/[id]/enrollments - 프로그램에 회원 수강생 배정
 *
 * 권한: 운영진(관리자·선생님).
 * 회원(MySQL)과 프로그램(D1)은 다른 저장소라 user_id를 문자열로만 보관한다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isStaff } from '@/lib/isAdmin';
import { getProgramById, createEnrollment } from '@/lib/d1';
import { notifyEventAfterResponse } from '@/lib/mail/notify';
import { getMemberById } from '@/lib/members';
import type { MemberRole } from '@/types/members';
import { ENROLLMENT_STATUSES, type EnrollmentStatus } from '@/types/programs';

/**
 * 수업에 배정할 수 있는 신분.
 *
 * 원생만 허용하면 **일요 성인반 신청자를 배정할 수 없다** — 성인 수강생은 보통
 * 'user' 로 가입하고, 선생님도 함께 서는 무대·연수로 수업에 배정된다.
 * 신청서 승격(응답 → 수강 배정)이 이 목록에 걸려 있다.
 */
const ASSIGNABLE_ROLES: MemberRole[] = ['student', 'teacher', 'parent', 'user'];

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json(
        { success: false, error: '운영진 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const programId = parseInt(id);
    if (isNaN(programId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 프로그램 ID입니다.' },
        { status: 400 }
      );
    }

    const program = await getProgramById(programId);
    if (!program) {
      return NextResponse.json(
        { success: false, error: '프로그램을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const userId = typeof body.user_id === 'string' ? body.user_id.trim() : '';
    if (!userId) {
      return NextResponse.json(
        { success: false, error: '배정할 원생을 선택하세요.' },
        { status: 400 }
      );
    }

    // 대상 회원이 존재하고 원생인지 확인 — '내 수업' 연동이 동작하려면 회원 계정이어야 한다.
    const member = await getMemberById(userId);
    if (!member) {
      return NextResponse.json(
        { success: false, error: '회원을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    // 일요 성인반·선생님 연수처럼 원생이 아닌 회원도 수업에 배정된다.
    // 'student' 만 허용하면 성인반 신청자를 배정할 수 없고, 신청서 승격이 전부 막힌다.
    if (!ASSIGNABLE_ROLES.includes(member.role)) {
      return NextResponse.json(
        { success: false, error: '이 회원은 수강생으로 배정할 수 없습니다.' },
        { status: 400 }
      );
    }

    const status: EnrollmentStatus = ENROLLMENT_STATUSES.includes(body.status)
      ? body.status
      : 'active';
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;

    await createEnrollment(programId, {
      user_id: userId,
      status,
      note,
      enrolled_by: session!.user!.id,
    });

    // 등록 안내 — 원생이면 보호자에게도 함께 간다(notifyEvent가 붙인다).
    // 실제로 수강하게 된 경우에만 알린다: 대기·취소 상태를 등록 완료로
    // 안내하면 원생과 보호자가 잘못 알게 된다.
    if (status === 'active') {
      const member = await getMemberById(userId).catch(() => null);
      notifyEventAfterResponse('enrollment.created', {
        userIds: [userId],
        data: {
          name: member?.name ?? '',
          title: program.title_ko,
          schedule: program.schedule_ko ?? '',
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin enrollment create error:', error);
    return NextResponse.json(
      { success: false, error: '수강생 배정에 실패했습니다.' },
      { status: 500 }
    );
  }
}
