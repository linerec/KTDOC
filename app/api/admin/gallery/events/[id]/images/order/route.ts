/**
 * Admin Gallery Event Images Order API
 * PUT /api/admin/gallery/events/[id]/images/order - 이미지 순서 변경
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { getEventById, updateImageOrder } from '@/lib/d1';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT - 이미지 순서 변경
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const eventId = parseInt(id);

    if (isNaN(eventId)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 이벤트 ID입니다.' },
        { status: 400 }
      );
    }

    const event = await getEventById(eventId);
    if (!event) {
      return NextResponse.json(
        { success: false, error: '이벤트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { imageIds } = body;

    if (!Array.isArray(imageIds)) {
      return NextResponse.json(
        { success: false, error: '이미지 ID 배열이 필요합니다.' },
        { status: 400 }
      );
    }

    await updateImageOrder(eventId, imageIds);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin gallery image order update error:', error);
    return NextResponse.json(
      { success: false, error: '이미지 순서 변경에 실패했습니다.' },
      { status: 500 }
    );
  }
}
