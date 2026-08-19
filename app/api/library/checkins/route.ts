/**
 * 이벤트 체크인 API
 * GET    /api/library/checkins                     - 내가 체크인한 이벤트 id 목록
 * POST   /api/library/checkins {eventId, forUserId?} - 체크인
 * DELETE /api/library/checkins {eventId, forUserId?} - 체크아웃
 *
 * 보안: 로그인 + 정회원(active)만. 기본 대상은 본인(user_id=세션).
 *   forUserId가 주어지면 **학부모가 자녀를 대행**하는 경우만 허용한다 —
 *   요청자가 forUserId(자녀)의 보호자(student_guardians 연결 확정)인지 서버에서 검증.
 *   체크인은 존재하는 이벤트면 공개·비공개 모두 허용.
 */

import { NextResponse } from 'next/server';
import { notifyEventAfterResponse } from '@/lib/mail/notify';
import { auth } from '@/auth';
import { isApproved } from '@/lib/isAdmin';
import {
  checkInEvent,
  checkOutEvent,
  getCheckinEventState,
  getUserCheckedInEventIds,
} from '@/lib/d1';
import { isGuardianOf, getUserNamesByIds } from '@/lib/members';

function unauthorized() {
  return NextResponse.json(
    { success: false, error: '로그인이 필요합니다.' },
    { status: 401 }
  );
}

/** body 또는 쿼리스트링에서 eventId·forUserId 파싱 */
async function readBody(
  request: Request
): Promise<{ eventId: number | null; forUserId: string | null }> {
  const { searchParams } = new URL(request.url);
  let rawEvent: unknown = searchParams.get('eventId');
  let forUserId: string | null = searchParams.get('forUserId');
  if (rawEvent === null) {
    const body = await request.json().catch(() => ({}));
    rawEvent = (body as { eventId?: unknown }).eventId;
    const f = (body as { forUserId?: unknown }).forUserId;
    if (typeof f === 'string') forUserId = f;
  }
  const id = Number(rawEvent);
  return {
    eventId: Number.isInteger(id) && id > 0 ? id : null,
    forUserId: forUserId || null,
  };
}

/**
 * 체크인 대상 user_id를 정한다. forUserId가 본인이 아니면 보호자 관계를 검증한다.
 * 반환: { userId } 성공 | { error, status } 거부.
 */
async function resolveTarget(
  selfId: string,
  forUserId: string | null
): Promise<{ userId: string } | { error: string; status: number }> {
  if (!forUserId || forUserId === selfId) return { userId: selfId };
  const ok = await isGuardianOf(selfId, forUserId);
  if (!ok) {
    return { error: '본인 또는 연결된 자녀만 체크인할 수 있습니다.', status: 403 };
  }
  return { userId: forUserId };
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
    const { eventId, forUserId } = await readBody(request);
    if (eventId === null) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 이벤트입니다.' },
        { status: 400 }
      );
    }

    const target = await resolveTarget(session.user.id, forUserId);
    if ('error' in target) {
      return NextResponse.json({ success: false, error: target.error }, { status: target.status });
    }

    // 비공개(미공개) 이벤트도 체크인 가능(아카이브 공개 여부와 무관). 존재 여부만 검증.
    const state = await getCheckinEventState(eventId);
    if (!state.exists) {
      return NextResponse.json(
        { success: false, error: '이벤트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    await checkInEvent(eventId, target.userId);

    // 참여 확정 안내. 기본은 꺼져 있다(빈도가 높다) — 관리 콘솔에서 켜면 나간다.
    // 이름은 **대상자(자녀일 수 있다)** 의 것을 채운다 — 학부모가 대행 체크인하면
    // 메일도 학부모에게 가는데, 이름이 비면 형제 중 누구 얘긴지 알 수 없다.
    const names = await getUserNamesByIds([target.userId]).catch(
      () => new Map<string, string>()
    );
    notifyEventAfterResponse('checkin.created', {
      userIds: [target.userId],
      data: { title: state.title ?? '', name: names.get(target.userId) ?? '' },
    });

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
    const { eventId, forUserId } = await readBody(request);
    if (eventId === null) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 이벤트입니다.' },
        { status: 400 }
      );
    }

    const target = await resolveTarget(session.user.id, forUserId);
    if ('error' in target) {
      return NextResponse.json({ success: false, error: target.error }, { status: target.status });
    }

    await checkOutEvent(eventId, target.userId);
    return NextResponse.json({ success: true, data: { eventId, checkedIn: false } });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { success: false, error: '체크아웃에 실패했습니다.' },
      { status: 500 }
    );
  }
}
