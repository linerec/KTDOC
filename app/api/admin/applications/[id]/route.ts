/**
 * Admin Application Detail API
 * GET    /api/admin/applications/[id] - 신청자 상세
 * PATCH  /api/admin/applications/[id] - 상태 변경 (신규/연락함/확정/취소)
 * DELETE /api/admin/applications/[id] - 신청 삭제
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import {
  getApplicationById,
  updateApplicationStatus,
  deleteApplication,
} from '@/lib/d1';
import { APPLICATION_STATUSES, type ApplicationStatus } from '@/types/programs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const appId = parseInt(id);
    if (isNaN(appId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      );
    }

    const application = await getApplicationById(appId);
    if (!application) {
      return NextResponse.json(
        { success: false, error: '신청을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: application });
  } catch (error) {
    console.error('Admin application fetch error:', error);
    return NextResponse.json(
      { success: false, error: '신청 정보를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const appId = parseInt(id);
    if (isNaN(appId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const status: ApplicationStatus = body.status;
    if (!status || !APPLICATION_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: '올바른 상태값이 아닙니다.' },
        { status: 400 }
      );
    }

    const application = await getApplicationById(appId);
    if (!application) {
      return NextResponse.json(
        { success: false, error: '신청을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    await updateApplicationStatus(appId, { status });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin application status update error:', error);
    return NextResponse.json(
      { success: false, error: '상태 변경에 실패했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const appId = parseInt(id);
    if (isNaN(appId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      );
    }

    const removed = await deleteApplication(appId);
    if (!removed) {
      return NextResponse.json(
        { success: false, error: '신청을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin application delete error:', error);
    return NextResponse.json(
      { success: false, error: '신청 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
