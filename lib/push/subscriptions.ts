/**
 * 웹 푸시 구독(push_subscriptions) 저장소 — MySQL
 *
 * 한 회원이 여러 기기/브라우저에서 구독할 수 있다. endpoint는 브라우저가 발급한
 * 고유 주소라 (user_id, endpoint) 단위로 관리하며, endpoint는 길어서 sha256 해시로
 * 유일성을 보장한다(uniq_user_endpoint).
 *
 * 이 표는 "지금 켜져 있는 기기"만 담는다 — 끄거나 만료되면 행이 사라진다.
 * 그래서 사라진 사실 자체는 push_subscription_events(이력)에 남기고, 켜 둔 기기에
 * 알림이 실제로 닿았는지는 도달 집계 컬럼(success/fail)에 쌓는다. 둘 다 없으면
 * 운영진은 "어제 12명이 오늘 9명"이라는 숫자만 보고 이유를 알 수 없다.
 */

import { createHash } from 'crypto';
import { query } from '@/lib/db';
import type { MemberRole } from '@/types/members';
import type { PushEventType } from '@/types/push';

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
 * 생명주기 이력 한 건 기록.
 *
 * 이력 기록이 실패해도 본래 동작(구독 등록·해제·발송)은 막지 않는다 —
 * 추적은 부수적 기능이고, 알림이 안 켜지는 것이 훨씬 큰 문제다.
 */
async function logEvent(
  userId: string,
  endpointHash: string,
  event: PushEventType,
  userAgent?: string | null
): Promise<void> {
  try {
    await query(
      `INSERT INTO push_subscription_events (user_id, endpoint_hash, event, user_agent)
       VALUES (?, ?, ?, ?)`,
      [userId, endpointHash, event, userAgent ?? null]
    );
  } catch (err) {
    console.error('푸시 구독 이력 기록 실패:', err);
  }
}

/** 여러 건을 한 번에 기록(만료 정리처럼 묶음으로 생기는 이벤트용). */
async function logEvents(
  rows: { userId: string; endpointHash: string; userAgent?: string | null }[],
  event: PushEventType
): Promise<void> {
  if (!rows.length) return;
  try {
    const placeholders = rows.map(() => '(?, ?, ?, ?)').join(', ');
    const params: unknown[] = [];
    for (const r of rows) {
      params.push(r.userId, r.endpointHash, event, r.userAgent ?? null);
    }
    await query(
      `INSERT INTO push_subscription_events (user_id, endpoint_hash, event, user_agent)
       VALUES ${placeholders}`,
      params
    );
  } catch (err) {
    console.error('푸시 구독 이력 기록 실패:', err);
  }
}

/**
 * 구독 등록(upsert). 같은 기기에서 재구독하면 키/UA만 갱신한다.
 * 유효하지 않은 구독(키 누락)은 무시한다.
 *
 * 새 기기일 때만 'subscribed' 이력을 남긴다 — 브라우저는 앱을 열 때마다 구독을
 * 재등록하므로, 갱신까지 기록하면 이력이 같은 줄로 뒤덮인다.
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

  const endpointHash = hashEndpoint(endpoint);

  // 신규 여부는 upsert의 affectedRows(1=삽입/2=갱신)로 알 수 있다고 흔히들 말하지만,
  // 그 값은 서버 설정(CLIENT_FOUND_ROWS)과 "값이 그대로인 갱신"에 따라 달라진다 —
  // 실측에서 갱신인데도 1이 나왔다. 이력이 재등록마다 쌓이는 것보다 조회 한 번이 낫다.
  const existing = await query<{ id: number }[]>(
    'SELECT id FROM push_subscriptions WHERE user_id = ? AND endpoint_hash = ? LIMIT 1',
    [userId, endpointHash]
  );
  const isNew = existing.length === 0;

  await query(
    `INSERT INTO push_subscriptions
       (user_id, endpoint, endpoint_hash, p256dh, auth, user_agent, last_used_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       p256dh = VALUES(p256dh),
       auth = VALUES(auth),
       user_agent = VALUES(user_agent),
       last_used_at = NOW()`,
    [userId, endpoint, endpointHash, p256dh, auth, userAgent ?? null]
  );

  if (isNew) await logEvent(userId, endpointHash, 'subscribed', userAgent);
  return true;
}

/** 구독 해제 — endpoint 기준(회원이 알림을 껐을 때). */
export async function deleteSubscriptionByEndpoint(endpoint: string): Promise<void> {
  if (!endpoint) return;
  const endpointHash = hashEndpoint(endpoint);

  // 지우기 전에 누구의 어떤 기기였는지 확보한다(행이 사라지면 알 수 없다).
  const rows = await query<{ user_id: string; user_agent: string | null }[]>(
    'SELECT user_id, user_agent FROM push_subscriptions WHERE endpoint_hash = ?',
    [endpointHash]
  );

  await query('DELETE FROM push_subscriptions WHERE endpoint_hash = ?', [endpointHash]);

  await logEvents(
    rows.map((r) => ({ userId: r.user_id, endpointHash, userAgent: r.user_agent })),
    'unsubscribed'
  );
}

/** 만료(404/410)된 구독을 id로 일괄 정리. */
export async function deleteSubscriptionsByIds(ids: number[]): Promise<void> {
  const list = ids.filter((n) => Number.isFinite(n));
  if (!list.length) return;
  const placeholders = list.map(() => '?').join(', ');

  const rows = await query<
    { user_id: string; endpoint_hash: string; user_agent: string | null }[]
  >(
    `SELECT user_id, endpoint_hash, user_agent
     FROM push_subscriptions WHERE id IN (${placeholders})`,
    list
  );

  await query(
    `DELETE FROM push_subscriptions WHERE id IN (${placeholders})`,
    list
  );

  await logEvents(
    rows.map((r) => ({
      userId: r.user_id,
      endpointHash: r.endpoint_hash,
      userAgent: r.user_agent,
    })),
    'expired'
  );
}

/**
 * 발송 결과를 기기별로 기록한다(도달 성공/실패 횟수와 마지막 시각).
 *
 * "켜 뒀는데 실제로는 안 가는 기기"는 이 집계로만 드러난다 — 발송 화면의
 * 도달 수는 발송 1건의 합계라 어느 기기가 계속 실패하는지 알 수 없다.
 * 추적 실패가 발송을 되돌리지 않도록 오류는 삼킨다.
 */
export async function recordDeliveryResults(
  successIds: number[],
  failureIds: number[]
): Promise<void> {
  const ok = successIds.filter((n) => Number.isFinite(n));
  const bad = failureIds.filter((n) => Number.isFinite(n));

  try {
    if (ok.length) {
      const placeholders = ok.map(() => '?').join(', ');
      await query(
        `UPDATE push_subscriptions
           SET success_count = success_count + 1, last_success_at = NOW()
         WHERE id IN (${placeholders})`,
        ok
      );
    }
    if (bad.length) {
      const placeholders = bad.map(() => '?').join(', ');
      await query(
        `UPDATE push_subscriptions
           SET fail_count = fail_count + 1, last_failure_at = NOW()
         WHERE id IN (${placeholders})`,
        bad
      );
    }
  } catch (err) {
    console.error('푸시 도달 기록 실패:', err);
  }
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
