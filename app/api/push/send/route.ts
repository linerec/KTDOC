import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isStaff } from '@/lib/isAdmin';
import { sendToUsers, type PushPayload } from '@/lib/push/webpush';
import {
  logNotification,
  addRecipients,
  type NotifyTargetType,
} from '@/lib/push/notifications';
import { getActiveMemberIds, getMemberIdsByRoles } from '@/lib/members';
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

/**
 * 운영진(선생님·관리자)이 푸시 알림을 발송한다(전체/역할별/개인).
 * 대상 회원을 user.id 집합으로 해석한 뒤:
 *   1) 그 회원들의 기기로 푸시 발송, 2) 회원별 인박스(notification_recipients)에 기록.
 * 푸시 미설정 회원도 인박스 기록은 남아 로그인 후 확인할 수 있다.
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const data = (await request.json().catch(() => null)) as SendBody | null;
    const title = data?.title?.trim();
    const body = data?.body?.trim();
    const url = data?.url?.trim() || '/admin/inbox';
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

    // 대상 회원(user.id) 해석
    let userIds: string[] = [];
    let targetValue: string | null = null;

    if (targetType === 'all') {
      userIds = await getActiveMemberIds();
    } else if (targetType === 'role') {
      const roles = (data?.target?.roles ?? []).filter((r): r is MemberRole =>
        MEMBER_ROLES.includes(r as MemberRole)
      );
      if (!roles.length) {
        return NextResponse.json({ error: '역할을 1개 이상 선택해 주세요.' }, { status: 400 });
      }
      userIds = await getMemberIdsByRoles(roles);
      targetValue = roles.join(',');
    } else {
      const userId = data?.target?.userId?.trim();
      if (!userId) {
        return NextResponse.json({ error: '대상 회원을 선택해 주세요.' }, { status: 400 });
      }
      userIds = [userId];
      targetValue = userId;
    }

    const payload: PushPayload = { title, body, url, tag: `ktdoc-notify-${Date.now()}` };

    // 1) 푸시 발송(구독한 기기에만 도착)
    const result = await sendToUsers(userIds, payload);

    // 2) 발송 로그 + 회원별 인박스 기록(푸시 미설정 회원도 포함)
    const notificationId = await logNotification({
      senderId: session!.user!.id!,
      title,
      body,
      url,
      targetType,
      targetValue,
      sentCount: result.sent,
      failCount: result.failed,
    });
    await addRecipients(notificationId, userIds).catch((e) =>
      console.error('인박스 기록 실패:', e)
    );

    return NextResponse.json({
      success: true,
      message: `${userIds.length}명에게 보냈습니다 · 기기 도달 ${result.sent}${
        result.failed ? ` (실패 ${result.failed})` : ''
      }. 받은 분은 ‘내 알림’에서 다시 볼 수 있습니다.`,
      recipients: userIds.length,
      ...result,
    });
  } catch (error) {
    console.error('push send error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
