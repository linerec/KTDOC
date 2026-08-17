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
import { notifyEventAfterResponse } from '@/lib/mail/notify';
import { isAdmin } from '@/lib/isAdmin';
import { getPermMatrix, effectiveAllowedByKey, viewerOf } from '@/lib/admin/permissions';
import {
  approveMember,
  rejectMember,
  setMemberStatus,
  setMemberRole,
  setMemberAdmin,
  setTempPassword,
  linkGuardianToStudent,
  getMemberById,
  countActiveAdmins,
  MEMBER_ROLES,
  type MemberRole,
} from '@/lib/members';
import { generateTempPassword, hashPassword } from '@/lib/password';
import { notifyMemberApproved } from '@/lib/push/system';

interface RouteParams {
  params: Promise<{ id: string }>;
}

type Action =
  | 'approve'
  | 'reject'
  | 'suspend'
  | 'restore'
  /** 신분 변경(원생·학부모·선생님·운영) — 관리 권한은 건드리지 않는다 */
  | 'setRole'
  /** 관리 권한 부여·회수 — 신분은 건드리지 않는다 */
  | 'setAdmin'
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
    const matrix = await getPermMatrix();
    if (!effectiveAllowedByKey('members', viewerOf(session), matrix)) {
      return NextResponse.json(
        { success: false, error: '회원 관리 접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const action: Action = body.action;

    // 락아웃 방지: 활성 관리자를 막는 조치(거절/정지)는 마지막 관리자·자기 자신을 보호.
    // 신분이 아니라 관리 권한(is_admin)을 본다 — 선생님이든 원생이든 권한자면 보호 대상.
    if (action === 'reject' || action === 'suspend') {
      const target = await getMemberById(id);
      if (target?.is_admin && target.status === 'active') {
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
        // 승인 알림(인앱+푸시) — 가입자가 다음 로그인 때 알림함에서 확인한다
        await notifyMemberApproved(session!.user.id, id).catch((err) =>
          console.error('승인 알림 발송 실패:', err)
        );
        // 메일도 함께 — 로그인하지 않아도 승인 사실을 알 수 있어야 한다.
        // 이름은 승인 뒤에 읽는다(위 락아웃 검사의 target은 reject·suspend 전용 스코프).
        notifyEventAfterResponse('member.approved', {
          userIds: [id],
          data: {
            name: (await getMemberById(id))?.name ?? '',
            url: process.env.AUTH_URL ?? '',
          },
        });
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
        // 신분 변경은 관리자 전용
        if (!isAdmin(session)) {
          return NextResponse.json(
            { success: false, error: '신분 변경은 관리자만 가능합니다.' },
            { status: 403 }
          );
        }
        const role: MemberRole = body.role;
        if (!role || !MEMBER_ROLES.includes(role)) {
          return NextResponse.json(
            { success: false, error: '유효하지 않은 신분입니다.' },
            { status: 400 }
          );
        }
        // 신분을 바꿔도 관리 권한은 그대로 남는다(0034). 그래서 여기에는
        // 락아웃 방지가 필요 없다 — 권한을 건드리는 곳은 setAdmin뿐이다.
        await setMemberRole(id, role);
        break;
      }
      case 'setAdmin': {
        // 관리 권한 부여·회수는 관리자 전용
        if (!isAdmin(session)) {
          return NextResponse.json(
            { success: false, error: '관리자 권한 변경은 관리자만 가능합니다.' },
            { status: 403 }
          );
        }
        const grant = body.isAdmin === true;
        if (!grant) {
          // 회수는 자기 자신과 마지막 관리자를 보호한다.
          if (id === session!.user.id) {
            return NextResponse.json(
              { success: false, error: '자기 자신의 관리자 권한은 해제할 수 없습니다.' },
              { status: 403 }
            );
          }
          const target = await getMemberById(id);
          if (
            target?.is_admin &&
            target.status === 'active' &&
            (await countActiveAdmins()) <= 1
          ) {
            return NextResponse.json(
              { success: false, error: '마지막 관리자의 권한은 해제할 수 없습니다.' },
              { status: 400 }
            );
          }
        }
        await setMemberAdmin(id, grant);
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
        // 관리자 계정 탈취 방지: 관리 권한자 대상 발급은 관리자만 가능
        if (target.is_admin && !isAdmin(session)) {
          return NextResponse.json(
            { success: false, error: '관리자 계정의 임시 비밀번호는 관리자만 발급할 수 있습니다.' },
            { status: 403 }
          );
        }
        const tempPassword = generateTempPassword();
        await setTempPassword(id, await hashPassword(tempPassword), session.user.id);
        // 회원에게 메일로도 보낸다 — 지금까지는 전달 수단이 없어 구두·메신저로
        // 알려야 했다. 본문에 평문이 실리므로 발송 내역에는 본문을 남기지 않는다
        // (lib/mail/events.ts의 redactBody).
        notifyEventAfterResponse('member.temp_password', {
          userIds: [id],
          data: { name: target.name ?? '', tempPassword, url: process.env.AUTH_URL ?? '' },
        });
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
