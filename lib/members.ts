/**
 * 회원(users) 데이터 관리 — MySQL
 *
 * 사이트에 가입한 회원을 관리자 화면에서 조회한다.
 * password_hash 등 민감 정보는 절대 반환하지 않는다.
 * (지금은 조회 전용이지만, 권한 변경·삭제 등으로 확장하기 쉽게 구성)
 */

import { query } from '@/lib/db';
import type { Member, MemberCounts, MemberRole } from '@/types/members';

// 서버 코드에서 lib/members 한 곳에서 가져다 쓸 수 있도록 공용 타입·상수 재노출.
export {
  MEMBER_ROLES,
  MEMBER_ROLE_LABELS,
} from '@/types/members';
export type { Member, MemberCounts, MemberRole } from '@/types/members';

interface GetMembersOptions {
  search?: string;
  role?: MemberRole;
  page?: number;
  limit?: number;
}

// mysql2는 DATETIME/TIMESTAMP를 Date 객체로 반환하므로, RSC 직렬화 및 일관된
// 포매팅을 위해 ISO 문자열로 정규화한다.
interface MemberRow {
  id: string;
  email: string;
  name: string | null;
  email_verified: Date | string | null;
  role: MemberRole | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

function toISO(value: Date | string | null): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function normalizeMember(row: MemberRow): Member {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    email_verified: toISO(row.email_verified),
    role: row.role === 'admin' ? 'admin' : 'user',
    created_at: toISO(row.created_at) ?? '',
    updated_at: toISO(row.updated_at) ?? '',
  };
}

/**
 * 회원 목록 조회 (검색·권한 필터·페이지네이션 지원). 최신 가입순.
 */
export async function getMembers(
  options: GetMembersOptions = {}
): Promise<{ members: Member[]; total: number }> {
  const { search, role, page = 1, limit = 100 } = options;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (role) {
    conditions.push('role = ?');
    params.push(role);
  }
  if (search) {
    conditions.push('(email LIKE ? OR name LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like);
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRows = await query<{ total: number }[]>(
    `SELECT COUNT(*) AS total FROM users ${whereSql}`,
    params
  );
  const total = Number(countRows[0]?.total ?? 0);

  // LIMIT/OFFSET은 mysql2 prepared statement에서 바인딩 이슈가 있어 정수로 인라인.
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 100, 1), 500);
  const safePage = Math.max(Math.trunc(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const rows = await query<MemberRow[]>(
    `SELECT id, email, name, email_verified, role, created_at, updated_at
     FROM users
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT ${safeLimit} OFFSET ${offset}`,
    params
  );

  return { members: rows.map(normalizeMember), total };
}

/**
 * 회원 요약 카운트 (대시보드/필터 표시용).
 */
export async function getMemberCounts(): Promise<MemberCounts> {
  const rows = await query<
    { total: number; admins: number | string; users: number | string; verified: number | string }[]
  >(
    `SELECT
       COUNT(*) AS total,
       SUM(role = 'admin') AS admins,
       SUM(role IS NULL OR role = 'user') AS users,
       SUM(email_verified IS NOT NULL) AS verified
     FROM users`
  );
  const r = rows[0];
  return {
    total: Number(r?.total ?? 0),
    admins: Number(r?.admins ?? 0),
    users: Number(r?.users ?? 0),
    verified: Number(r?.verified ?? 0),
  };
}

/**
 * 단일 회원 조회 (향후 상세 화면 확장용).
 */
export async function getMemberById(id: string): Promise<Member | null> {
  const rows = await query<MemberRow[]>(
    `SELECT id, email, name, email_verified, role, created_at, updated_at
     FROM users WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] ? normalizeMember(rows[0]) : null;
}
