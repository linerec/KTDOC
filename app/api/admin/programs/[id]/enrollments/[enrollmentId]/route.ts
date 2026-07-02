/**
 * Admin Program Enrollment Detail API
 * PATCH  /api/admin/programs/[id]/enrollments/[enrollmentId] - 수강 상태·메모 변경
 * DELETE /api/admin/programs/[id]/enrollments/[enrollmentId] - 수강생 배정 해제
 *
 * 권한: 운영진(관리자·선생님). enrollment가 해당 프로그램에 속하는지 검증한다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isStaff } from '@/lib/isAdmin';
import { getEnrollmentById, updateEnrollment, deleteEnrollment } from '@/lib/d1';
import { ENROLLMENT_STATUSES, type UpdateEnrollmentInput } from '@/types/programs';

interface RouteParams {
  params: Promise<{ id: string; enrollmentId: string }>;
}

async function resolveEnrollment(
  idRaw: string,
  enrollmentIdRaw: string
): Promise<
  | { error: string; status: number }
  | { programId: number; enrollmentId: number }
> {
  const programId = parseInt(idRaw);
  const enrollmentId = parseInt(enrollmentIdRaw);
  if (isNaN(programId) || isNaN(enrollmentId)) {
    return { error: '유효하지 않은 ID입니다.', status: 400 };
  }
  const enrollment = await getEnrollmentById(enrollmentId);
  if (!enrollment || enrollment.program_id !== programId) {
    return { error: '수강생 배정을 찾을 수 없습니다.', status: 404 };
  }
  return { programId, enrollmentId };
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json(
        { success: false, error: '운영진 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { id, enrollmentId: enrollmentIdRaw } = await params;
    const resolved = await resolveEnrollment(id, enrollmentIdRaw);
    if ('error' in resolved) {
      return NextResponse.json(
        { success: false, error: resolved.error },
        { status: resolved.status }
      );
    }

    const body = await request.json();
    const input: UpdateEnrollmentInput = {};
    if (body.status !== undefined) {
      if (!ENROLLMENT_STATUSES.includes(body.status)) {
        return NextResponse.json(
          { success: false, error: '올바른 상태를 선택하세요.' },
          { status: 400 }
        );
      }
      input.status = body.status;
    }
    if (body.note !== undefined) {
      input.note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;
    }

    await updateEnrollment(resolved.enrollmentId, input);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin enrollment update error:', error);
    return NextResponse.json(
      { success: false, error: '수강생 정보 변경에 실패했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json(
        { success: false, error: '운영진 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { id, enrollmentId: enrollmentIdRaw } = await params;
    const resolved = await resolveEnrollment(id, enrollmentIdRaw);
    if ('error' in resolved) {
      return NextResponse.json(
        { success: false, error: resolved.error },
        { status: resolved.status }
      );
    }

    await deleteEnrollment(resolved.enrollmentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin enrollment delete error:', error);
    return NextResponse.json(
      { success: false, error: '수강생 배정 해제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
