/**
 * 시스템 알림 — 가입·승인 같은 운영 이벤트를 인앱 알림함 + 웹 푸시로 전달.
 * (신뢰·접근성 개선 Phase Step 3 — 승인 플로우의 양방향 깜깜이 제거)
 *
 * 알림 실패가 본 흐름(가입·승인)을 깨뜨리면 안 되므로, 호출부는
 * `.catch(console.error)`로 감싸 비필수 경로로 다룬다. 푸시 발송이 실패해도
 * 인앱 알림함 행은 만들어 로그인 시 확인할 수 있게 한다.
 */

import { getMemberIdsByRoles } from '@/lib/members';
import { MEMBER_ROLE_LABELS, type MemberRole } from '@/types/members';
import { addRecipients, logNotification } from './notifications';
import { sendToUsers } from './webpush';

interface SystemNotice {
  title: string;
  body: string;
  url?: string;
}

/**
 * 대상 회원들에게 웹 푸시를 시도하고, 결과와 무관하게 인앱 알림함 행을 만든다.
 * senderId는 알림함의 "보낸이"로 표시된다.
 */
async function notifyUsers(
  senderId: string,
  userIds: string[],
  notice: SystemNotice,
  targetValue: string
): Promise<void> {
  const targets = Array.from(new Set(userIds.filter(Boolean)));
  if (!targets.length) return;

  // 푸시는 최선 노력 — VAPID 미설정·발송 실패 시에도 인앱 알림은 남긴다
  const push = await sendToUsers(targets, {
    title: notice.title,
    body: notice.body,
    url: notice.url,
  }).catch(() => ({ sent: 0, failed: targets.length }));

  const notificationId = await logNotification({
    senderId,
    title: notice.title,
    body: notice.body,
    url: notice.url ?? null,
    targetType: 'user',
    targetValue,
    sentCount: push.sent,
    failCount: push.failed,
  });
  await addRecipients(notificationId, targets);
}

/** 신규 가입 신청 → 운영진(선생님·관리자)에게 알림. 보낸이는 가입자 본인. */
export async function notifyStaffOfRegistration(newUser: {
  id: string;
  name: string;
  role: MemberRole;
}): Promise<void> {
  const staffIds = await getMemberIdsByRoles(['teacher', 'admin']);
  const roleLabel = MEMBER_ROLE_LABELS[newUser.role] ?? newUser.role;
  await notifyUsers(
    newUser.id,
    staffIds,
    {
      title: '새 가입 신청',
      body: `${newUser.name}님이 ${roleLabel}(으)로 가입을 신청했습니다. 회원 관리에서 확인 후 승인해 주세요.`,
      url: '/admin/members?status=pending',
    },
    'staff:registration'
  );
}

/** 가입 승인 → 가입자 본인에게 알림(다음 로그인 시 알림함에서 확인). */
export async function notifyMemberApproved(
  approverId: string,
  memberId: string
): Promise<void> {
  await notifyUsers(
    approverId,
    [memberId],
    {
      title: '가입이 승인되었습니다',
      body: '정회원이 되었습니다. 이제 일정·수업·알림 등 회원 기능을 이용하실 수 있습니다.',
      url: '/admin',
    },
    `member:${memberId}`
  );
}

/**
 * 신청서 응답 접수 → 운영진(관리자)에게 알림.
 *
 * **본문에 의료정보·연락처를 넣지 않는다.** 알림은 잠금화면에도 뜨고 기록으로 남는다 —
 * 학생 이름과 신청서 제목까지가 안전선이다. 나머지는 열어서 본다.
 * 보낸이가 없는 알림이라(비회원 제출) senderId 는 첫 수신자로 둔다.
 */
export async function notifyStaffOfFormResponse(input: {
  formId: number;
  formTitle: string;
  studentName: string;
}): Promise<void> {
  const staffIds = await getMemberIdsByRoles(['admin']);
  if (staffIds.length === 0) return;
  await notifyUsers(
    staffIds[0],
    staffIds,
    {
      title: '새 신청서 접수',
      body: `${input.studentName} 학생이 "${input.formTitle}"을 제출했습니다.`,
      url: `/admin/forms/${input.formId}/responses`,
    },
    'staff:formResponse'
  );
}
