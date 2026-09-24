/**
 * 이벤트 체크인(참여 응답) API
 * GET    /api/library/checkins                                  - 내가 체크인한 이벤트 id 목록
 * POST   /api/library/checkins {eventId, forUserId?, response?} - 참여(기본) 또는 불참
 * DELETE /api/library/checkins {eventId, forUserId?}            - 응답 거두기(참여·불참 모두)
 *
 * response: 'going'(기본 — 말하지 않으면 참여) | 'declined'. 참여와 불참은 서로를
 *   밀어낸다(lib/d1/checkins.ts). 판정은 lib/library/response.ts.
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
  declineEvent,
  clearDecline,
  getCheckinEventState,
  getUserCheckedInEventIds,
} from '@/lib/d1';
import { isGuardianOf, getUserNamesByIds } from '@/lib/members';
import { parseResponse, type EventResponse } from '@/lib/library/response';

function unauthorized() {
  return NextResponse.json(
    { success: false, error: '로그인이 필요합니다.' },
    { status: 401 }
  );
}

/** body 또는 쿼리스트링에서 eventId·forUserId·response 파싱 */
async function readBody(request: Request): Promise<{
  eventId: number | null;
  forUserId: string | null;
  /** null = 알 수 없는 값(거절). 말하지 않으면 'going'. */
  response: EventResponse | null;
}> {
  const { searchParams } = new URL(request.url);
  let rawEvent: unknown = searchParams.get('eventId');
  let forUserId: string | null = searchParams.get('forUserId');
  let rawResponse: unknown = searchParams.get('response');
  if (rawEvent === null) {
    const body = await request.json().catch(() => ({}));
    rawEvent = (body as { eventId?: unknown }).eventId;
    const f = (body as { forUserId?: unknown }).forUserId;
    if (typeof f === 'string') forUserId = f;
    rawResponse = (body as { response?: unknown }).response;
  }
  const id = Number(rawEvent);
  return {
    eventId: Number.isInteger(id) && id > 0 ? id : null,
    forUserId: forUserId || null,
    response: parseResponse(rawResponse),
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
    const { eventId, forUserId, response } = await readBody(request);
    if (eventId === null) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 이벤트입니다.' },
        { status: 400 }
      );
    }
    if (response === null) {
      return NextResponse.json(
        { success: false, error: '알 수 없는 응답입니다.' },
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

    if (response === 'declined') {
      // 불참은 안내 메일을 보내지 않는다 — "안 간다"를 확인하는 메일은 읽을 이유가 없다.
      await declineEvent(eventId, target.userId);
      return NextResponse.json({
        success: true,
        data: { eventId, checkedIn: false, response: 'declined' },
      });
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

    return NextResponse.json({
      success: true,
      data: { eventId, checkedIn: true, response: 'going' },
    });
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

    // 응답을 거둔다 — 참여든 불참이든 미응답으로 돌아간다.
    await checkOutEvent(eventId, target.userId);
    await clearDecline(eventId, target.userId);
    return NextResponse.json({
      success: true,
      data: { eventId, checkedIn: false, response: null },
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { success: false, error: '체크아웃에 실패했습니다.' },
      { status: 500 }
    );
  }
}
