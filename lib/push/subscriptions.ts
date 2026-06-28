/**
 * 웹 푸시 구독(push_subscriptions) 저장소 — MySQL
 *
 * 한 회원이 여러 기기/브라우저에서 구독할 수 있다. endpoint는 브라우저가 발급한
 * 고유 주소라 (user_id, endpoint) 단위로 관리하며, endpoint는 길어서 sha256 해시로
 * 유일성을 보장한다(uniq_user_endpoint).
 */

import { createHash } from 'crypto';
import { query } from '@/lib/db';
import type { MemberRole } from '@/types/members';

/** 발송에 필요한 구독 한 건(민감하지 않은 키만). */
export interface PushSubRow {
  id: number;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** 클라이언트 PushSubscription.toJSON() 형태. */
export interface WebPushSubscriptionJSON {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
}

function hashEndpoint(endpoint: string): string {
  return createHash('sha256').update(endpoint).digest('hex');
}

/**
 * 구독 등록(upsert). 같은 기기에서 재구독하면 키/UA만 갱신한다.
 * 유효하지 않은 구독(키 누락)은 무시한다.
 */
export async function upsertSubscription(
  userId: string,
  sub: WebPushSubscriptionJSON,
  userAgent?: string | null
): Promise<boolean> {
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (!endpoint || !p256dh || !auth) return false;

  await query(
    `INSERT INTO push_subscriptions
       (user_id, endpoint, endpoint_hash, p256dh, auth, user_agent, last_used_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       p256dh = VALUES(p256dh),
       auth = VALUES(auth),
       user_agent = VALUES(user_agent),
       last_used_at = NOW()`,
    [userId, endpoint, hashEndpoint(endpoint), p256dh, auth, userAgent ?? null]
  );
  return true;
}

/** 구독 해제 — endpoint 기준(브라우저가 구독 취소했거나 만료된 경우). */
export async function deleteSubscriptionByEndpoint(endpoint: string): Promise<void> {
  if (!endpoint) return;
  await query('DELETE FROM push_subscriptions WHERE endpoint_hash = ?', [
    hashEndpoint(endpoint),
  ]);
}

/** 만료(404/410)된 구독을 id로 일괄 정리. */
export async function deleteSubscriptionsByIds(ids: number[]): Promise<void> {
  const list = ids.filter((n) => Number.isFinite(n));
  if (!list.length) return;
  const placeholders = list.map(() => '?').join(', ');
  await query(
    `DELETE FROM push_subscriptions WHERE id IN (${placeholders})`,
    list
  );
}

/** 특정 회원들의 구독 전체. */
export async function getSubscriptionsForUsers(
  userIds: string[]
): Promise<PushSubRow[]> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (!unique.length) return [];
  const placeholders = unique.map(() => '?').join(', ');
  return query<PushSubRow[]>(
    `SELECT id, user_id, endpoint, p256dh, auth
     FROM push_subscriptions WHERE user_id IN (${placeholders})`,
    unique
  );
}

/** 전체 구독(전체 발송용). */
export async function getAllSubscriptions(): Promise<PushSubRow[]> {
  return query<PushSubRow[]>(
    `SELECT id, user_id, endpoint, p256dh, auth FROM push_subscriptions`
  );
}

/** 특정 역할(role) 회원들의 구독 — 회원(users)과 조인. */
export async function getSubscriptionsByRoles(
  roles: MemberRole[]
): Promise<PushSubRow[]> {
  const list = Array.from(new Set(roles.filter(Boolean)));
  if (!list.length) return [];
  const placeholders = list.map(() => '?').join(', ');
  return query<PushSubRow[]>(
    `SELECT ps.id, ps.user_id, ps.endpoint, ps.p256dh, ps.auth
     FROM push_subscriptions ps
     JOIN users u ON u.id = ps.user_id
     WHERE u.role IN (${placeholders})`,
    list
  );
}

/** 전체 구독 건수(대시보드 표시용). */
export async function countSubscriptions(): Promise<number> {
  const rows = await query<{ n: number | string }[]>(
    `SELECT COUNT(*) AS n FROM push_subscriptions`
  );
  return Number(rows[0]?.n ?? 0);
}

/** 특정 회원의 구독 건수(본인 알림 켜짐 여부 보강용). */
export async function countSubscriptionsForUser(userId: string): Promise<number> {
  const rows = await query<{ n: number | string }[]>(
    `SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?`,
    [userId]
  );
  return Number(rows[0]?.n ?? 0);
}
