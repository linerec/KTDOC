/**
 * Admin Applications API
 * GET /api/admin/applications - 신청자 목록 (PII 포함, 관리자용)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { getApplications } from '@/lib/d1';
import { APPLICATION_STATUSES, type ApplicationStatus } from '@/types/programs';

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
    const statusParam = searchParams.get('status');
    const programIdParam = searchParams.get('program_id');

    const result = await getApplications({
      program_id: programIdParam ? parseInt(programIdParam) : undefined,
      status:
        statusParam && APPLICATION_STATUSES.includes(statusParam as ApplicationStatus)
          ? (statusParam as ApplicationStatus)
          : undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Admin applications fetch error:', error);
    return NextResponse.json(
      { success: false, error: '신청 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
