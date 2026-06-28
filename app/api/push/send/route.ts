import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isStaff } from '@/lib/isAdmin';
import { sendToAll, sendToRoles, sendToUsers, type PushPayload } from '@/lib/push/webpush';
import { logNotification, type NotifyTargetType } from '@/lib/push/notifications';
import { MEMBER_ROLES, type MemberRole } from '@/types/members';

interface SendBody {
  title?: string;
  body?: string;
  url?: string;
  target?: {
    type?: NotifyTargetType;
    roles?: string[];
    userId?: string;
  };
}

/** 운영진(선생님·관리자)이 푸시 알림을 발송한다(전체/역할별/개인). */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const data = (await request.json().catch(() => null)) as SendBody | null;
    const title = data?.title?.trim();
    const body = data?.body?.trim();
    const url = data?.url?.trim() || '/admin';
    const targetType = data?.target?.type;

    if (!title || !body) {
      return NextResponse.json({ error: '제목과 내용을 입력해 주세요.' }, { status: 400 });
    }
    if (title.length > 200 || body.length > 1000) {
      return NextResponse.json({ error: '제목·내용이 너무 깁니다.' }, { status: 400 });
    }
    if (!targetType || !['all', 'role', 'user'].includes(targetType)) {
      return NextResponse.json({ error: '발송 대상을 선택해 주세요.' }, { status: 400 });
    }

    const payload: PushPayload = { title, body, url, tag: `ktdoc-notify-${Date.now()}` };

    let result = { sent: 0, failed: 0 };
    let targetValue: string | null = null;

    if (targetType === 'all') {
      result = await sendToAll(payload);
    } else if (targetType === 'role') {
      const roles = (data?.target?.roles ?? []).filter((r): r is MemberRole =>
        MEMBER_ROLES.includes(r as MemberRole)
      );
      if (!roles.length) {
        return NextResponse.json({ error: '역할을 1개 이상 선택해 주세요.' }, { status: 400 });
      }
      result = await sendToRoles(roles, payload);
      targetValue = roles.join(',');
    } else {
      // user
      const userId = data?.target?.userId?.trim();
      if (!userId) {
        return NextResponse.json({ error: '대상 회원을 선택해 주세요.' }, { status: 400 });
      }
      result = await sendToUsers([userId], payload);
      targetValue = userId;
    }

    await logNotification({
      senderId: session!.user!.id!,
      title,
      body,
      url,
      targetType,
      targetValue,
      sentCount: result.sent,
      failCount: result.failed,
    }).catch((e) => console.error('알림 로그 기록 실패:', e));

    return NextResponse.json({
      success: true,
      message:
        result.sent > 0
          ? `${result.sent}대 기기로 발송했습니다${result.failed ? ` (실패 ${result.failed})` : ''}.`
          : '발송 대상 구독이 없습니다. 수신자가 먼저 알림을 켜야 합니다.',
      ...result,
    });
  } catch (error) {
    console.error('push send error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
