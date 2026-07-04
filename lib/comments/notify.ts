/**
 * 댓글 알림 — 새 댓글/대댓글이 달리면 그 수업/이벤트 관련 회원(작성자 제외)에게
 * 푸시(web-push) + 인박스(notifications/notification_recipients)로 알린다.
 *
 * 관련 회원:
 *  - program: 배정 수강생 + 그 학부모
 *  - event:   체크인 참가자 + 그 학부모
 * 대댓글이면 부모 댓글 작성자도 포함(중복 제거).
 *
 * 서버 전용(web-push). Node 런타임 라우트에서만 호출할 것.
 */

import {
  getProgramById,
  getEventById,
  getProgramEnrollments,
  getEventCheckins,
} from '@/lib/d1';
import { getGuardianUserIdsForStudents } from '@/lib/members';
import { sendToUsers } from '@/lib/push/webpush';
import { logNotification, addRecipients } from '@/lib/push/notifications';
import type { CommentTargetType } from '@/types/comments';

interface NotifyInput {
  targetType: CommentTargetType;
  targetId: number;
  authorId: string;
  authorName: string;
  body: string;
  commentId: number;
  isAnnouncement?: boolean;
  /** 대댓글일 때 부모 댓글 작성자 id(알림 대상에 반드시 포함). */
  parentAuthorId?: string | null;
}

/** 대상 회원(작성자 제외) user_id 집합과 대상 제목·링크를 만든다. */
async function resolveAudience(
  targetType: CommentTargetType,
  targetId: number
): Promise<{ title: string; url: string; studentIds: string[] } | null> {
  if (targetType === 'program') {
    const program = await getProgramById(targetId);
    if (!program) return null;
    const enrollments = await getProgramEnrollments(targetId);
    return {
      title: program.title_ko,
      url: `/admin/my-classes/${targetId}`,
      studentIds: enrollments.map((e) => e.user_id),
    };
  }
  const event = await getEventById(targetId);
  if (!event) return null;
  const checkins = await getEventCheckins(targetId);
  return {
    title: event.title_ko,
    url: `/admin/library/${targetId}`,
    studentIds: checkins.map((c) => c.user_id),
  };
}

export async function notifyNewComment(input: NotifyInput): Promise<void> {
  const audience = await resolveAudience(input.targetType, input.targetId);
  if (!audience) return;

  // 수강생/참가자 + 그 학부모 + (대댓글이면) 부모 댓글 작성자
  const guardianIds = await getGuardianUserIdsForStudents(audience.studentIds);
  const recipients = new Set<string>([...audience.studentIds, ...guardianIds]);
  if (input.parentAuthorId) recipients.add(input.parentAuthorId);
  recipients.delete(input.authorId); // 작성자 본인 제외

  const userIds = Array.from(recipients);
  if (userIds.length === 0) return;

  const snippet = input.body.length > 80 ? `${input.body.slice(0, 80)}…` : input.body;
  const title = input.isAnnouncement
    ? `📢 ${audience.title} · 공지`
    : `${audience.title} · 새 댓글`;
  const bodyText = `${input.authorName}: ${snippet}`.slice(0, 500);
  const url = `${audience.url}#comment-${input.commentId}`;

  // 1) 푸시(구독 기기). 실패해도 인박스는 진행.
  let result = { sent: 0, failed: 0 };
  try {
    result = await sendToUsers(userIds, { title, body: bodyText, url, tag: `comment-${input.commentId}` });
  } catch (e) {
    console.warn('Comment push failed:', e);
  }

  // 2) 인박스 기록(푸시 미설정 회원도 로그인 후 확인)
  try {
    const notificationId = await logNotification({
      senderId: input.authorId,
      title,
      body: bodyText,
      url,
      targetType: 'user',
      targetValue: `${input.targetType}:${input.targetId}`,
      sentCount: result.sent,
      failCount: result.failed,
    });
    await addRecipients(notificationId, userIds);
  } catch (e) {
    console.warn('Comment inbox log failed:', e);
  }
}
