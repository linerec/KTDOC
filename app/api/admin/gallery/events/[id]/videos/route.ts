/**
 * Admin Gallery Event Videos API
 * POST /api/admin/gallery/events/[id]/videos - 영상 추가
 * DELETE /api/admin/gallery/events/[id]/videos?videoId=xxx - 영상 삭제
 * PUT /api/admin/gallery/events/[id]/videos - 영상 순서 변경
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getEventById, createEventVideo, deleteEventVideo, updateVideoOrder } from '@/lib/d1';
import type { CreateVideoInput } from '@/types/gallery';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - 영상 추가
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
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
    const { youtube_url, title } = body;

    if (!youtube_url) {
      return NextResponse.json(
        { success: false, error: 'YouTube URL이 필요합니다.' },
        { status: 400 }
      );
    }

    const input: CreateVideoInput = {
      youtube_url,
      title,
    };

    try {
      const videoId = await createEventVideo(eventId, input);

      return NextResponse.json({
        success: true,
        data: { id: videoId },
      });
    } catch (e) {
      if (e instanceof Error && e.message === 'Invalid YouTube URL') {
        return NextResponse.json(
          { success: false, error: '유효하지 않은 YouTube URL입니다.' },
          { status: 400 }
        );
      }
      throw e;
    }
  } catch (error) {
    console.error('Admin gallery video create error:', error);
    return NextResponse.json(
      { success: false, error: '영상 추가에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// PUT - 영상 순서 변경
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
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
    const { videoIds } = body;

    if (!Array.isArray(videoIds)) {
      return NextResponse.json(
        { success: false, error: '영상 ID 배열이 필요합니다.' },
        { status: 400 }
      );
    }

    await updateVideoOrder(eventId, videoIds);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin gallery video order update error:', error);
    return NextResponse.json(
      { success: false, error: '영상 순서 변경에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE - 영상 삭제
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
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

    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
      return NextResponse.json(
        { success: false, error: '영상 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    await deleteEventVideo(parseInt(videoId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin gallery video delete error:', error);
    return NextResponse.json(
      { success: false, error: '영상 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
