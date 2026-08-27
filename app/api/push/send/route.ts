import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isStaff } from '@/lib/isAdmin';
import { sendToUsers, type PushPayload, type SendResult } from '@/lib/push/webpush';
import {
  logNotification,
  addRecipients,
  type NotifyTargetType,
} from '@/lib/push/notifications';
import { getActiveMemberIds, getMemberIdsByRoles } from '@/lib/members';
import { getActiveEnrollmentUserIds, getProgramById } from '@/lib/d1';
import { notifyEvent } from '@/lib/mail/notify';
import { MEMBER_ROLES, type MemberRole } from '@/types/members';

interface SendBody {
  title?: string;
  body?: string;
  url?: string;
  /**
   * 휴대폰 알림과 함께 이메일로도 보낼지. **기본은 보낸다.**
   * 푸시를 켜신 분이 회원의 절반뿐이라, 푸시만으로는 절반에게 닿지 않는다.
   */
  alsoEmail?: boolean;
  target?: {
    type?: NotifyTargetType;
    roles?: string[];
    userId?: string;
    programId?: number;
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
    if (!targetType || !['all', 'role', 'user', 'class'].includes(targetType)) {
      return NextResponse.json({ error: '발송 대상을 선택해 주세요.' }, { status: 400 });
    }
    // 값이 없으면 켠 것으로 본다 — 옛 호출부(체크박스가 없던 시절)도 이메일이 나가야 한다.
    const alsoEmail = data?.alsoEmail !== false;

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
    } else if (targetType === 'class') {
      const programId = Number(data?.target?.programId);
      if (!Number.isInteger(programId) || programId <= 0) {
        return NextResponse.json({ error: '수업을 선택해 주세요.' }, { status: 400 });
      }
      const program = await getProgramById(programId);
      if (!program) {
        return NextResponse.json({ error: '수업을 찾을 수 없습니다.' }, { status: 404 });
      }
      userIds = await getActiveEnrollmentUserIds(programId);
      if (!userIds.length) {
        return NextResponse.json(
          { error: `‘${program.title_ko}’에 수강 중인 원생이 없습니다.` },
          { status: 400 }
        );
      }
      targetValue = String(programId);
    } else {
      const userId = data?.target?.userId?.trim();
      if (!userId) {
        return NextResponse.json({ error: '대상 회원을 선택해 주세요.' }, { status: 400 });
      }
      userIds = [userId];
      targetValue = userId;
    }

    const payload: PushPayload = { title, body, url, tag: `ktdoc-notify-${Date.now()}` };

    // 1) 푸시 발송(구독한 기기에만 도착).
    // 푸시는 best-effort다 — VAPID 미설정 등으로 실패해도 아래 인박스 기록은 남겨
    // 회원이 '내 알림'에서 확인할 수 있게 한다(전체 요청을 500으로 죽이지 않는다).
    let result: SendResult = { sent: 0, failed: 0 };
    try {
      result = await sendToUsers(userIds, payload);
    } catch (pushErr) {
      console.error('푸시 발송 실패(인박스 기록은 계속):', pushErr);
    }

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

    // 3) 이메일. 원생이면 보호자에게도 함께 간다(notifyEvent가 붙인다) —
    //    미성년 원생은 메일을 잘 보지 않으므로 이 흐름이 사실상 학부모 공지다.
    //    수신거부하신 분은 빠진다(공지는 필수 메일이 아니다).
    //    발송이 느려도 화면이 기다리지 않게 응답 뒤로 미루지 않는다 —
    //    보낸 결과를 화면에 말해 줘야 원장님이 다시 누르지 않는다.
    if (alsoEmail) {
      await notifyEvent('notice.broadcast', {
        userIds,
        audiences: ['user'],
        data: { title, message: body, url: url === '/admin/inbox' ? '' : url },
      });
    }

    return NextResponse.json({
      success: true,
      message:
        `${userIds.length}명에게 보냈습니다 · 기기 도달 ${result.sent}` +
        (result.failed ? ` (실패 ${result.failed})` : '') +
        (alsoEmail ? ' · 이메일도 함께 보냈습니다' : '') +
        '. 받은 분은 ‘내 알림’에서 다시 볼 수 있습니다.',
      recipients: userIds.length,
      emailed: alsoEmail,
      ...result,
    });
  } catch (error) {
    console.error('push send error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
