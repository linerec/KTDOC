/**
 * 학생 이벤트 체크인 API
 * GET    /api/library/checkins        - 내가 체크인한 이벤트 id 목록
 * POST   /api/library/checkins {eventId} - 체크인(공개 이벤트만)
 * DELETE /api/library/checkins {eventId} - 체크아웃(본인 것만)
 *
 * 보안: 로그인 + 정회원(active)만. 체크인/체크아웃 대상 user_id는 항상 본인으로 강제한다
 *   (남의 참여를 조작할 수 없다). 체크인은 공개(published) 이벤트에만 허용한다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isApproved } from '@/lib/isAdmin';
import {
  checkInEvent,
  checkOutEvent,
  getCheckinEventState,
  getUserCheckedInEventIds,
} from '@/lib/d1';

function unauthorized() {
  return NextResponse.json(
    { success: false, error: '로그인이 필요합니다.' },
    { status: 401 }
  );
}

/** body 또는 쿼리스트링에서 eventId를 정수로 파싱 */
async function readEventId(request: Request): Promise<number | null> {
  const { searchParams } = new URL(request.url);
  let raw: unknown = searchParams.get('eventId');
  if (raw === null) {
    const body = await request.json().catch(() => ({}));
    raw = (body as { eventId?: unknown }).eventId;
  }
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !isApproved(session)) return unauthorized();

  try {
    const ids = await getUserCheckedInEventIds(session.user.id);
    return NextResponse.json({ success: true, data: { eventIds: Array.from(ids) } });
  } catch (error) {
    console.error('Checkin list error:', error);
    return NextResponse.json(
      { success: false, error: '체크인 정보를 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !isApproved(session)) return unauthorized();

  try {
    const eventId = await readEventId(request);
    if (eventId === null) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 이벤트입니다.' },
        { status: 400 }
      );
    }

    const state = await getCheckinEventState(eventId);
    if (!state.exists) {
      return NextResponse.json(
        { success: false, error: '이벤트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    if (!state.published) {
      return NextResponse.json(
        { success: false, error: '공개된 이벤트에만 체크인할 수 있습니다.' },
        { status: 409 }
      );
    }

    await checkInEvent(eventId, session.user.id);
    return NextResponse.json({ success: true, data: { eventId, checkedIn: true } });
  } catch (error) {
    console.error('Checkin error:', error);
    return NextResponse.json(
      { success: false, error: '체크인에 실패했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !isApproved(session)) return unauthorized();

  try {
    const eventId = await readEventId(request);
    if (eventId === null) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 이벤트입니다.' },
        { status: 400 }
      );
    }

    await checkOutEvent(eventId, session.user.id);
    return NextResponse.json({ success: true, data: { eventId, checkedIn: false } });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { success: false, error: '체크아웃에 실패했습니다.' },
      { status: 500 }
    );
  }
}
