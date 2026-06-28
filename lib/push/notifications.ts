/**
 * 알림 발송 로그(notifications) — MySQL
 *
 * 운영진이 보낸 푸시 알림을 "발송 1건 = 1행"으로 기록한다.
 * 발송 화면(/admin/notify)에서 최근 내역과 도달/실패 수를 보여준다.
 */

import { query } from '@/lib/db';

export type NotifyTargetType = 'all' | 'role' | 'user';

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

export async function logNotification(input: LogNotificationInput): Promise<void> {
  await query(
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
