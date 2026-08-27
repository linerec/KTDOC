/**
 * 알림 발송 로그(notifications) — MySQL
 *
 * 운영진이 보낸 푸시 알림을 "발송 1건 = 1행"으로 기록한다.
 * 발송 화면(/admin/notify)에서 최근 내역과 도달/실패 수를 보여준다.
 */

import { query } from '@/lib/db';

/**
 * 알림 발송 대상.
 * 'class' — 한 수업의 수강생(+보호자). target_value 에 programs.id(D1)를 담는다.
 * 저장소가 달라 FK는 없다(program_enrollments 와 같은 교차 저장소 관례).
 */
export type NotifyTargetType = 'all' | 'role' | 'user' | 'class';

export interface LogNotificationInput {
  senderId: string;
  title: string;
  body: string;
  url?: string | null;
  targetType: NotifyTargetType;
  targetValue?: string | null;
  sentCount: number;
  failCount: number;
}

export interface NotificationLog {
  id: number;
  title: string;
  body: string;
  url: string | null;
  target_type: NotifyTargetType;
  target_value: string | null;
  sent_count: number;
  fail_count: number;
  created_at: string;
  sender_name: string | null;
}

/** 발송 1건을 기록하고 그 notification id를 돌려준다(수신자 펼치기에 사용). */
export async function logNotification(input: LogNotificationInput): Promise<number> {
  const result = await query<{ insertId: number }>(
    `INSERT INTO notifications
       (sender_id, title, body, url, target_type, target_value, sent_count, fail_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.senderId,
      input.title,
      input.body,
      input.url ?? null,
      input.targetType,
      input.targetValue ?? null,
      input.sentCount,
      input.failCount,
    ]
  );
  return Number(result.insertId);
}

/** 발송 1건을 대상 회원 수만큼 인박스 행으로 펼친다(중복은 무시). */
export async function addRecipients(
  notificationId: number,
  userIds: string[]
): Promise<void> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (!unique.length) return;
  const CHUNK = 500;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK);
    const placeholders = slice.map(() => '(?, ?)').join(', ');
    const params: unknown[] = [];
    for (const uid of slice) params.push(notificationId, uid);
    await query(
      `INSERT IGNORE INTO notification_recipients (notification_id, user_id)
       VALUES ${placeholders}`,
      params
    );
  }
}

/* ------------------------------------------------------------------ */
/* 수신자 인박스(받은 알림함)                                          */
/* ------------------------------------------------------------------ */

export interface InboxItem {
  /** notification_recipients.id (읽음/삭제 대상 키) */
  id: number;
  title: string;
  body: string;
  url: string | null;
  read: boolean;
  created_at: string;
  sender_name: string | null;
}

interface InboxRow {
  id: number;
  title: string;
  body: string;
  url: string | null;
  read_at: Date | string | null;
  created_at: Date | string | null;
  sender_name: string | null;
}

/** 한 회원이 받은 알림 목록(최신순). */
export async function getInboxForUser(userId: string, limit = 100): Promise<InboxItem[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 100, 1), 200);
  const rows = await query<InboxRow[]>(
    `SELECT r.id, n.title, n.body, n.url, r.read_at, r.created_at,
            u.name AS sender_name
     FROM notification_recipients r
     JOIN notifications n ON n.id = r.notification_id
     LEFT JOIN users u ON u.id = n.sender_id
     WHERE r.user_id = ?
     ORDER BY r.created_at DESC
     LIMIT ${safeLimit}`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    url: r.url,
    read: r.read_at != null,
    created_at:
      r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at ?? ''),
    sender_name: r.sender_name,
  }));
}

/** 안 읽은 알림 수(대시보드 배지용). */
export async function countUnread(userId: string): Promise<number> {
  const rows = await query<{ n: number | string }[]>(
    `SELECT COUNT(*) AS n FROM notification_recipients WHERE user_id = ? AND read_at IS NULL`,
    [userId]
  );
  return Number(rows[0]?.n ?? 0);
}

/** 한 건 읽음 처리(본인 행만). */
export async function markRead(userId: string, id: number): Promise<void> {
  await query(
    `UPDATE notification_recipients SET read_at = NOW()
     WHERE id = ? AND user_id = ? AND read_at IS NULL`,
    [id, userId]
  );
}

/** 모두 읽음 처리(본인 전체). */
export async function markAllRead(userId: string): Promise<void> {
  await query(
    `UPDATE notification_recipients SET read_at = NOW()
     WHERE user_id = ? AND read_at IS NULL`,
    [userId]
  );
}

/** 한 건 삭제(본인 행만 제거 — 운영진 발송 로그는 유지). */
export async function deleteInboxItem(userId: string, id: number): Promise<void> {
  await query(
    `DELETE FROM notification_recipients WHERE id = ? AND user_id = ?`,
    [id, userId]
  );
}

interface NotificationRow {
  id: number;
  title: string;
  body: string;
  url: string | null;
  target_type: NotifyTargetType;
  target_value: string | null;
  sent_count: number;
  fail_count: number;
  created_at: Date | string | null;
  sender_name: string | null;
}

/** 최근 발송 내역(발송자 이름 포함). */
export async function getRecentNotifications(limit = 20): Promise<NotificationLog[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 20, 1), 100);
  const rows = await query<NotificationRow[]>(
    `SELECT n.id, n.title, n.body, n.url, n.target_type, n.target_value,
            n.sent_count, n.fail_count, n.created_at,
            u.name AS sender_name
     FROM notifications n
     LEFT JOIN users u ON u.id = n.sender_id
     ORDER BY n.created_at DESC
     LIMIT ${safeLimit}`
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    url: r.url,
    target_type: r.target_type,
    target_value: r.target_value,
    sent_count: Number(r.sent_count),
    fail_count: Number(r.fail_count),
    created_at:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at ?? ''),
    sender_name: r.sender_name,
  }));
}
