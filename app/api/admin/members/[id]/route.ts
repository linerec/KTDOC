/**
 * Admin Member Action API
 * PATCH /api/admin/members/[id] - 회원 승인/거절/정지/복구/역할변경/원생연결
 *
 * 권한:
 *  - approve | reject | suspend | restore | linkStudent : 운영진(선생님·관리자, isStaff)
 *  - issueTempPassword (임시 비밀번호 발급)             : 운영진. 단, 관리자 계정 대상은 관리자만
 *  - setRole (역할 변경, 선생님 임명 등)               : 관리자(isAdmin)만
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { getPermMatrix, effectiveAllowedByKey } from '@/lib/admin/permissions';
import {
  approveMember,
  rejectMember,
  setMemberStatus,
  setMemberRole,
  setTempPassword,
  linkGuardianToStudent,
  getMemberById,
  countActiveAdmins,
  MEMBER_ROLES,
  type MemberRole,
} from '@/lib/members';
import { generateTempPassword, hashPassword } from '@/lib/password';

interface RouteParams {
  params: Promise<{ id: string }>;
}

type Action =
  | 'approve'
  | 'reject'
  | 'suspend'
  | 'restore'
  | 'setRole'
  | 'linkStudent'
  | 'issueTempPassword';

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }
    // 메뉴 권한 매트릭스와 일관된 접근 통제 — 'members' 메뉴 접근 권한이 있어야 한다.
    // (페이지뿐 아니라 API 직접 호출도 매트릭스 설정을 따른다. 액션별 플로어는 아래에서 별도 적용.)
    const actorRole = (session.user.role ?? 'user') as MemberRole;
    const matrix = await getPermMatrix();
    if (!effectiveAllowedByKey('members', actorRole, matrix)) {
      return NextResponse.json(
        { success: false, error: '회원 관리 접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const action: Action = body.action;

    // 락아웃 방지: 활성 관리자에 대한 권한 박탈(거절/정지/강등)은 마지막 관리자·자기 자신을 보호.
    if (action === 'reject' || action === 'suspend') {
      const target = await getMemberById(id);
      if (target?.role === 'admin' && target.status === 'active') {
        if (id === session!.user.id) {
          return NextResponse.json(
            { success: false, error: '자기 자신의 접근 권한은 해제할 수 없습니다.' },
            { status: 403 }
          );
        }
        if ((await countActiveAdmins()) <= 1) {
          return NextResponse.json(
            { success: false, error: '마지막 관리자는 정지·거절할 수 없습니다.' },
            { status: 400 }
          );
        }
      }
    }

    switch (action) {
      case 'approve': {
        await approveMember(id, session!.user.id);
        break;
      }
      case 'reject': {
        await rejectMember(id);
        break;
      }
      case 'suspend': {
        await setMemberStatus(id, 'suspended');
        break;
      }
      case 'restore': {
        await setMemberStatus(id, 'active');
        break;
      }
      case 'setRole': {
        // 역할 변경은 관리자 전용
        if (!isAdmin(session)) {
          return NextResponse.json(
            { success: false, error: '역할 변경은 관리자만 가능합니다.' },
            { status: 403 }
          );
        }
        const role: MemberRole = body.role;
        if (!role || !MEMBER_ROLES.includes(role)) {
          return NextResponse.json(
            { success: false, error: '유효하지 않은 역할입니다.' },
            { status: 400 }
          );
        }
        // 마지막 관리자 강등·자기 강등 차단
        if (role !== 'admin') {
          const target = await getMemberById(id);
          if (target?.role === 'admin') {
            if (id === session!.user.id) {
              return NextResponse.json(
                { success: false, error: '자기 자신의 관리자 권한은 해제할 수 없습니다.' },
                { status: 403 }
              );
            }
            if (target.status === 'active' && (await countActiveAdmins()) <= 1) {
              return NextResponse.json(
                { success: false, error: '마지막 관리자는 강등할 수 없습니다.' },
                { status: 400 }
              );
            }
          }
        }
        await setMemberRole(id, role);
        break;
      }
      case 'issueTempPassword': {
        const target = await getMemberById(id);
        if (!target) {
          return NextResponse.json(
            { success: false, error: '회원을 찾을 수 없습니다.' },
            { status: 404 }
          );
        }
        // 관리자 계정 탈취 방지: 관리자 대상 발급은 관리자만 가능
        if (target.role === 'admin' && !isAdmin(session)) {
          return NextResponse.json(
            { success: false, error: '관리자 계정의 임시 비밀번호는 관리자만 발급할 수 있습니다.' },
            { status: 403 }
          );
        }
        const tempPassword = generateTempPassword();
        await setTempPassword(id, await hashPassword(tempPassword), session.user.id);
        // 임시 비밀번호 평문은 이 응답에서 한 번만 노출된다(저장은 해시만).
        return NextResponse.json({
          success: true,
          data: await getMemberById(id),
          tempPassword,
        });
      }
      case 'linkStudent': {
        const linkId: string = body.linkId;
        const studentId: string = body.studentId;
        if (!linkId || !studentId) {
          return NextResponse.json(
            { success: false, error: '연결 정보가 부족합니다.' },
            { status: 400 }
          );
        }
        await linkGuardianToStudent(linkId, studentId);
        break;
      }
      default:
        return NextResponse.json(
          { success: false, error: '알 수 없는 작업입니다.' },
          { status: 400 }
        );
    }

    const updated = await getMemberById(id);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Admin member action error:', error);
    return NextResponse.json(
      { success: false, error: '작업 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
