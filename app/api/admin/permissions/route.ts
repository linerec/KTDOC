/**
 * Admin Menu Permissions API
 * POST /api/admin/permissions
 *   - { action: 'save', permissions: {menu_key, role, allowed}[] }  매트릭스 저장
 *   - { action: 'deleteOrphan', menuKey }                            고아 메뉴 정리
 *
 * 권한: 관리자(isAdmin)만. payload는 신뢰하지 않는다 — admin 행 강제 1,
 *       fixed/requireRole 메뉴 무시, 미등록 키 무시(서버 savePermissions에서 처리).
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { savePermissions, deleteOrphanKey } from '@/lib/admin/permissions';
import { MEMBER_ROLES, type MemberRole } from '@/types/members';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const action = body.action;

    if (action === 'deleteOrphan') {
      const menuKey = String(body.menuKey || '');
      if (!menuKey) {
        return NextResponse.json(
          { success: false, error: '메뉴 키가 없습니다.' },
          { status: 400 }
        );
      }
      const deleted = await deleteOrphanKey(menuKey);
      if (!deleted) {
        return NextResponse.json(
          { success: false, error: '사용 중인 메뉴는 삭제할 수 없습니다.' },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'save') {
      const raw = Array.isArray(body.permissions) ? body.permissions : [];
      const desired = raw
        .filter(
          (p: unknown): p is { menu_key: string; role: MemberRole; allowed: boolean } => {
            if (!p || typeof p !== 'object') return false;
            const o = p as Record<string, unknown>;
            return (
              typeof o.menu_key === 'string' &&
              typeof o.role === 'string' &&
              MEMBER_ROLES.includes(o.role as MemberRole) &&
              typeof o.allowed === 'boolean'
            );
          }
        )
        .map((p: { menu_key: string; role: MemberRole; allowed: boolean }) => ({
          menu_key: p.menu_key,
          role: p.role,
          allowed: p.allowed,
        }));

      await savePermissions(desired, session!.user.id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: '알 수 없는 작업입니다.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Menu permissions save error:', error);
    return NextResponse.json(
      { success: false, error: '저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
