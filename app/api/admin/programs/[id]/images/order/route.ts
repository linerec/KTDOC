/**
 * Admin Program Image Order API
 * PUT /api/admin/programs/[id]/images/order - 묶음 사진 순서 변경
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isStaff } from '@/lib/isAdmin';
import { updateProgramImageOrder } from '@/lib/d1';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
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

    const body = await request.json();
    const imageIds: number[] = body.imageIds;
    if (!Array.isArray(imageIds)) {
      return NextResponse.json(
        { success: false, error: 'imageIds 배열이 필요합니다.' },
        { status: 400 }
      );
    }

    await updateProgramImageOrder(programId, imageIds);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin program image order error:', error);
    return NextResponse.json(
      { success: false, error: '순서 변경에 실패했습니다.' },
      { status: 500 }
    );
  }
}
