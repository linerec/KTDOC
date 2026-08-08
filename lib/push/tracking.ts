/**
 * 푸시 알림 현황 조회 — MySQL (서버 전용)
 *
 * /admin/notify의 '알림 현황'이 쓰는 읽기 전용 질의들. 쓰기 경로(구독 등록·해제·
 * 도달 기록)는 lib/push/subscriptions.ts에 있다.
 *
 * 화면에 넘길 값은 전부 직렬화된 형태(ISO 문자열·숫자)로 바꿔서 돌려준다 —
 * mysql2가 돌려주는 Date 객체를 클라이언트 컴포넌트로 그대로 넘길 수 없다.
 */

import { query } from '@/lib/db';
import type { MemberRole, MemberStatus } from '@/types/members';
import type {
  PushDevice,
  PushEventEntry,
  PushEventType,
  PushMemberOff,
  PushMemberStatus,
  PushSummary,
} from '@/types/push';

/** mysql2의 DATETIME(Date | string | null) → ISO 문자열 | null. */
function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const text = String(value);
  if (!text) return null;
  // 'YYYY-MM-DD HH:MM:SS' 형태는 UTC로 읽는다(DB 세션 타임존과 동일).
  const parsed = new Date(text.includes('T') ? text : text.replace(' ', 'T') + 'Z');
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString();
}

interface DeviceRow {
  id: number;
  user_id: string;
  user_agent: string | null;
  created_at: Date | string | null;
  last_used_at: Date | string | null;
  last_success_at: Date | string | null;
  last_failure_at: Date | string | null;
  success_count: number | string;
  fail_count: number | string;
  name: string | null;
  email: string;
  role: MemberRole;
  status: MemberStatus;
}

/**
 * 알림을 켠 회원 목록(회원 1명 = 1행, 기기는 그 안에 묶임).
 *
 * 기기 수가 많은 회원, 그다음 최근에 켠 회원 순으로 정렬해 운영진이 위에서부터
 * 읽으면 된다.
 */
export async function getPushMemberStatuses(): Promise<PushMemberStatus[]> {
  const rows = await query<DeviceRow[]>(
    `SELECT ps.id, ps.user_id, ps.user_agent, ps.created_at, ps.last_used_at,
            ps.last_success_at, ps.last_failure_at, ps.success_count, ps.fail_count,
            u.name, u.email, u.role, u.status
     FROM push_subscriptions ps
     JOIN users u ON u.id = ps.user_id
     ORDER BY ps.created_at DESC`
  );

  const byUser = new Map<string, PushMemberStatus>();
  for (const r of rows) {
    let member = byUser.get(r.user_id);
    if (!member) {
      member = {
        userId: r.user_id,
        name: r.name,
        email: r.email,
        role: r.role,
        status: r.status,
        devices: [],
      };
      byUser.set(r.user_id, member);
    }
    const device: PushDevice = {
      id: Number(r.id),
      userAgent: r.user_agent,
      createdAt: toIso(r.created_at) ?? '',
      lastUsedAt: toIso(r.last_used_at),
      lastSuccessAt: toIso(r.last_success_at),
      lastFailureAt: toIso(r.last_failure_at),
      successCount: Number(r.success_count ?? 0),
      failCount: Number(r.fail_count ?? 0),
    };
    member.devices.push(device);
  }

  return Array.from(byUser.values()).sort((a, b) => {
    if (b.devices.length !== a.devices.length) return b.devices.length - a.devices.length;
    return (b.devices[0]?.createdAt ?? '').localeCompare(a.devices[0]?.createdAt ?? '');
  });
}

interface OffRow {
  id: string;
  name: string | null;
  email: string;
  role: MemberRole;
  last_off_at: Date | string | null;
}

/**
 * 알림을 켜지 않은 정회원.
 *
 * "한 번도 켠 적 없음"과 "켰다가 껐음"을 구분한다 — 후자는 안내를 다시 하기보다
 * 이유를 물어보는 게 맞다.
 */
export async function getMembersWithoutPush(): Promise<PushMemberOff[]> {
  const rows = await query<OffRow[]>(
    `SELECT u.id, u.name, u.email, u.role,
            (SELECT MAX(e.created_at)
               FROM push_subscription_events e
              WHERE e.user_id = u.id AND e.event IN ('unsubscribed', 'expired')
            ) AS last_off_at
     FROM users u
     LEFT JOIN push_subscriptions ps ON ps.user_id = u.id
     WHERE u.status = 'active' AND ps.id IS NULL
     GROUP BY u.id, u.name, u.email, u.role
     ORDER BY u.role, u.name`
  );

  return rows.map((r) => ({
    userId: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    lastOffAt: toIso(r.last_off_at),
  }));
}

interface EventRow {
  id: number;
  user_id: string;
  event: PushEventType;
  user_agent: string | null;
  created_at: Date | string | null;
  name: string | null;
  email: string | null;
}

/** 최근 켜기·끄기·만료 이력(최신순). */
export async function getRecentPushEvents(limit = 30): Promise<PushEventEntry[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 30, 1), 200);
  const rows = await query<EventRow[]>(
    `SELECT e.id, e.user_id, e.event, e.user_agent, e.created_at,
            u.name, u.email
     FROM push_subscription_events e
     LEFT JOIN users u ON u.id = e.user_id
     ORDER BY e.created_at DESC, e.id DESC
     LIMIT ${safeLimit}`
  );

  return rows.map((r) => ({
    id: Number(r.id),
    userId: r.user_id,
    name: r.name,
    email: r.email,
    event: r.event,
    userAgent: r.user_agent,
    createdAt: toIso(r.created_at) ?? '',
  }));
}

/** 현황 요약 숫자(카드 4장). */
export async function getPushSummary(): Promise<PushSummary> {
  const [subs, activeTotal, activeWithPush, recent] = await Promise.all([
    query<{ devices: number | string; members: number | string }[]>(
      `SELECT COUNT(*) AS devices, COUNT(DISTINCT user_id) AS members
       FROM push_subscriptions`
    ),
    query<{ n: number | string }[]>(
      `SELECT COUNT(*) AS n FROM users WHERE status = 'active'`
    ),
    query<{ n: number | string }[]>(
      `SELECT COUNT(DISTINCT u.id) AS n
       FROM users u
       JOIN push_subscriptions ps ON ps.user_id = u.id
       WHERE u.status = 'active'`
    ),
    query<{ event: PushEventType; n: number | string }[]>(
      `SELECT event, COUNT(*) AS n
       FROM push_subscription_events
       WHERE created_at >= NOW() - INTERVAL 30 DAY
       GROUP BY event`
    ),
  ]);

  const counts: Record<PushEventType, number> = {
    subscribed: 0,
    unsubscribed: 0,
    expired: 0,
  };
  for (const r of recent) {
    if (r.event in counts) counts[r.event] = Number(r.n ?? 0);
  }

  const activeMemberCount = Number(activeTotal[0]?.n ?? 0);
  const withPush = Number(activeWithPush[0]?.n ?? 0);

  return {
    memberCount: Number(subs[0]?.members ?? 0),
    deviceCount: Number(subs[0]?.devices ?? 0),
    activeMemberCount,
    offCount: Math.max(activeMemberCount - withPush, 0),
    subscribed30d: counts.subscribed,
    unsubscribed30d: counts.unsubscribed,
    expired30d: counts.expired,
  };
}

/**
 * 회원 id → 알림 켠 기기 수. 회원 목록처럼 여러 회원을 한 화면에 늘어놓는
 * 곳에서 회원마다 질의하지 않도록 한 번에 받아 온다.
 */
export async function getDeviceCountsByUser(
  userIds: string[]
): Promise<Record<string, number>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (!unique.length) return {};
  const placeholders = unique.map(() => '?').join(', ');
  const rows = await query<{ user_id: string; n: number | string }[]>(
    `SELECT user_id, COUNT(*) AS n
     FROM push_subscriptions
     WHERE user_id IN (${placeholders})
     GROUP BY user_id`,
    unique
  );

  const out: Record<string, number> = {};
  for (const r of rows) out[r.user_id] = Number(r.n ?? 0);
  return out;
}
