/**
 * 회원(users) 데이터 관리 — MySQL
 *
 * 사이트에 가입한 회원을 관리자 화면에서 조회·승인한다.
 * password_hash 등 민감 정보는 절대 반환하지 않는다.
 */

import { query } from '@/lib/db';
import type {
  Member,
  MemberCounts,
  MemberRole,
  MemberStatus,
  GuardianChild,
  GuardianContact,
} from '@/types/members';

// 서버 코드에서 lib/members 한 곳에서 가져다 쓸 수 있도록 공용 타입·상수 재노출.
export {
  MEMBER_ROLES,
  MEMBER_ROLE_LABELS,
  MEMBER_STATUSES,
  MEMBER_STATUS_LABELS,
  STAFF_ROLES,
} from '@/types/members';
export type {
  Member,
  MemberCounts,
  MemberRole,
  MemberStatus,
  GuardianChild,
  GuardianContact,
} from '@/types/members';

interface GetMembersOptions {
  search?: string;
  role?: MemberRole;
  status?: MemberStatus;
  page?: number;
  limit?: number;
}

// mysql2는 DATETIME/TIMESTAMP를 Date 객체로 반환하므로, RSC 직렬화 및 일관된
// 포매팅을 위해 ISO 문자열로 정규화한다.
interface MemberRow {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  email_verified: Date | string | null;
  role: MemberRole | null;
  status: MemberStatus | null;
  enrollment_year: number | null;
  public_archive_consent: number | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

const VALID_ROLES: MemberRole[] = ['user', 'student', 'parent', 'teacher', 'admin'];
const VALID_STATUSES: MemberStatus[] = ['pending', 'active', 'rejected', 'suspended'];

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
    phone: row.phone ?? null,
    email_verified: toISO(row.email_verified),
    role: row.role && VALID_ROLES.includes(row.role) ? row.role : 'user',
    status: row.status && VALID_STATUSES.includes(row.status) ? row.status : 'active',
    enrollment_year: row.enrollment_year ?? null,
    public_archive_consent: row.public_archive_consent === 1,
    created_at: toISO(row.created_at) ?? '',
    updated_at: toISO(row.updated_at) ?? '',
  };
}

const MEMBER_SELECT = `id, email, name, phone, email_verified, role, status, enrollment_year, public_archive_consent, created_at, updated_at`;

/**
 * 회원 목록 조회 (검색·권한·상태 필터·페이지네이션 지원).
 * 승인 대기(pending)를 먼저, 그다음 최신 가입순으로 정렬한다.
 * 학부모에게는 연결된 자녀, 원생에게는 보호자 정보를 함께 채운다.
 */
export async function getMembers(
  options: GetMembersOptions = {}
): Promise<{ members: Member[]; total: number }> {
  const { search, role, status, page = 1, limit = 100 } = options;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (role) {
    conditions.push('role = ?');
    params.push(role);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
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
    `SELECT ${MEMBER_SELECT}
     FROM users
     ${whereSql}
     ORDER BY (status = 'pending') DESC, created_at DESC
     LIMIT ${safeLimit} OFFSET ${offset}`,
    params
  );

  const members = rows.map(normalizeMember);
  await attachGuardianLinks(members);
  return { members, total };
}

/**
 * 회원 목록에 학부모-원생 연결 정보를 채운다.
 * - 학부모(parent): children (연결된 자녀)
 * - 원생(student): guardians (연결된 보호자)
 */
async function attachGuardianLinks(members: Member[]): Promise<void> {
  const parentIds = members.filter((m) => m.role === 'parent').map((m) => m.id);
  const studentIds = members.filter((m) => m.role === 'student').map((m) => m.id);

  if (parentIds.length) {
    const placeholders = parentIds.map(() => '?').join(', ');
    const links = await query<
      {
        link_id: string;
        guardian_id: string;
        student_id: string | null;
        student_name: string | null;
        claimed_student_name: string;
        claimed_enrollment_year: number | null;
      }[]
    >(
      `SELECT sg.id AS link_id, sg.guardian_id, sg.student_id,
              s.name AS student_name,
              sg.claimed_student_name, sg.claimed_enrollment_year
       FROM student_guardians sg
       LEFT JOIN users s ON s.id = sg.student_id
       WHERE sg.guardian_id IN (${placeholders})
       ORDER BY sg.created_at ASC`,
      parentIds
    );
    const byParent = new Map<string, GuardianChild[]>();
    for (const l of links) {
      const list = byParent.get(l.guardian_id) ?? [];
      list.push({
        linkId: l.link_id,
        studentId: l.student_id,
        studentName: l.student_name,
        claimedName: l.claimed_student_name,
        claimedEnrollmentYear: l.claimed_enrollment_year ?? null,
      });
      byParent.set(l.guardian_id, list);
    }
    for (const m of members) {
      if (m.role === 'parent') m.children = byParent.get(m.id) ?? [];
    }
  }

  if (studentIds.length) {
    const placeholders = studentIds.map(() => '?').join(', ');
    const links = await query<
      {
        student_id: string;
        guardian_id: string;
        guardian_name: string | null;
        guardian_email: string;
      }[]
    >(
      `SELECT sg.student_id, sg.guardian_id,
              g.name AS guardian_name, g.email AS guardian_email
       FROM student_guardians sg
       JOIN users g ON g.id = sg.guardian_id
       WHERE sg.student_id IN (${placeholders})
       ORDER BY sg.created_at ASC`,
      studentIds
    );
    const byStudent = new Map<string, GuardianContact[]>();
    for (const l of links) {
      const list = byStudent.get(l.student_id) ?? [];
      list.push({
        guardianId: l.guardian_id,
        guardianName: l.guardian_name,
        guardianEmail: l.guardian_email,
      });
      byStudent.set(l.student_id, list);
    }
    for (const m of members) {
      if (m.role === 'student') m.guardians = byStudent.get(m.id) ?? [];
    }
  }
}

/**
 * 회원 요약 카운트 (대시보드/필터 표시용).
 */
export async function getMemberCounts(): Promise<MemberCounts> {
  const rows = await query<
    {
      total: number;
      pending: number | string;
      active: number | string;
      admins: number | string;
      teachers: number | string;
      students: number | string;
      parents: number | string;
    }[]
  >(
    `SELECT
       COUNT(*) AS total,
       SUM(status = 'pending') AS pending,
       SUM(status = 'active') AS active,
       SUM(role = 'admin') AS admins,
       SUM(role = 'teacher') AS teachers,
       SUM(role = 'student') AS students,
       SUM(role = 'parent') AS parents
     FROM users`
  );
  const r = rows[0];
  return {
    total: Number(r?.total ?? 0),
    pending: Number(r?.pending ?? 0),
    active: Number(r?.active ?? 0),
    admins: Number(r?.admins ?? 0),
    teachers: Number(r?.teachers ?? 0),
    students: Number(r?.students ?? 0),
    parents: Number(r?.parents ?? 0),
  };
}

/**
 * 단일 회원 조회 (연결 정보 포함).
 */
export async function getMemberById(id: string): Promise<Member | null> {
  const rows = await query<MemberRow[]>(
    `SELECT ${MEMBER_SELECT} FROM users WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!rows[0]) return null;
  const member = normalizeMember(rows[0]);
  await attachGuardianLinks([member]);
  return member;
}

/**
 * 원생 선택지 (학부모 연결이 미해결일 때 관리자가 직접 지정하기 위한 목록).
 */
export async function getStudentOptions(): Promise<
  { id: string; name: string | null; enrollment_year: number | null }[]
> {
  return query<{ id: string; name: string | null; enrollment_year: number | null }[]>(
    `SELECT id, name, enrollment_year FROM users
     WHERE role = 'student'
     ORDER BY enrollment_year DESC, name ASC`
  );
}

/** 공개 연도별 수강생 페이지 한 줄(민감정보 제외 — 이름·입학년도만) */
export interface PublicStudent {
  id: string;
  name: string | null;
  enrollment_year: number | null;
}

/**
 * 공개 수강생 명단 — 정회원(active) 원생 중 **공개 동의(opt-in)** 한 학생만.
 * 이메일·전화 등 민감정보는 반환하지 않는다. 연도별 페이지(`/students`)에서
 * 입학년도로 묶어 보여준다. id는 참여도 집계용(미표시).
 */
export async function getActiveStudents(): Promise<PublicStudent[]> {
  return query<PublicStudent[]>(
    `SELECT id, name, enrollment_year FROM users
     WHERE role = 'student' AND status = 'active' AND public_archive_consent = 1
     ORDER BY enrollment_year DESC, name ASC`
  );
}

/** 공개 노출 동의 토글 — 본인 프로필에서만 호출(userId는 항상 본인). */
export async function setPublicArchiveConsent(
  userId: string,
  consent: boolean
): Promise<void> {
  await query('UPDATE users SET public_archive_consent = ? WHERE id = ?', [
    consent ? 1 : 0,
    userId,
  ]);
}

/** 학부모의 (연결 확정된) 자녀 목록 — 대행 체크인 대상. student_id 미해결 자녀는 제외. */
export async function getGuardianChildren(
  guardianId: string
): Promise<{ studentId: string; studentName: string | null }[]> {
  const rows = await query<{ student_id: string; student_name: string | null }[]>(
    `SELECT sg.student_id, s.name AS student_name
     FROM student_guardians sg
     JOIN users s ON s.id = sg.student_id
     WHERE sg.guardian_id = ? AND sg.student_id IS NOT NULL
     ORDER BY s.name ASC`,
    [guardianId]
  );
  return rows.map((r) => ({ studentId: r.student_id, studentName: r.student_name }));
}

/** guardianId가 studentId의 보호자(연결 확정)인지 — 대행 체크인 권한 검증. */
export async function isGuardianOf(
  guardianId: string,
  studentId: string
): Promise<boolean> {
  const rows = await query<{ one: number }[]>(
    `SELECT 1 AS one FROM student_guardians
     WHERE guardian_id = ? AND student_id = ? LIMIT 1`,
    [guardianId, studentId]
  );
  return rows.length > 0;
}

/**
 * 여러 회원 id를 이름으로 일괄 해석한다(id → name).
 * 갤러리 사진의 제출자(uploaded_by, D1)를 운영진 화면에 이름으로 표시할 때 사용.
 * 갤러리(D1)와 회원(MySQL)이 다른 저장소라 조인 대신 별도 조회로 묶는다.
 */
export async function getUserNamesByIds(
  ids: string[]
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const placeholders = unique.map(() => '?').join(', ');
  const rows = await query<{ id: string; name: string | null }[]>(
    `SELECT id, name FROM users WHERE id IN (${placeholders})`,
    unique
  );
  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.name) map.set(r.id, r.name);
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* 승인·상태·역할 변경 액션                                            */
/* ------------------------------------------------------------------ */

/** 현재 활성(active) 관리자 수 — 락아웃(마지막 관리자 강등/정지) 방지용. */
export async function countActiveAdmins(): Promise<number> {
  const rows = await query<{ n: number | string }[]>(
    `SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status = 'active'`
  );
  return Number(rows[0]?.n ?? 0);
}

/** 회원 승인 (승인 대기/거절 → 정회원). 승인자·승인 시각 기록. */
export async function approveMember(id: string, approverId: string): Promise<void> {
  await query(
    `UPDATE users
     SET status = 'active', approved_by = ?, approved_at = NOW()
     WHERE id = ?`,
    [approverId, id]
  );
}

/** 회원 거절. */
export async function rejectMember(id: string): Promise<void> {
  await query(`UPDATE users SET status = 'rejected' WHERE id = ?`, [id]);
}

/** 회원 상태 직접 변경 (정지/복구 등). */
export async function setMemberStatus(
  id: string,
  status: MemberStatus
): Promise<void> {
  await query(`UPDATE users SET status = ? WHERE id = ?`, [status, id]);
}

/** 회원 역할 변경 (관리자 전용 — 선생님 임명 등). */
export async function setMemberRole(id: string, role: MemberRole): Promise<void> {
  await query(`UPDATE users SET role = ? WHERE id = ?`, [role, id]);
}

/** 미해결 학부모 연결에 실제 원생을 지정. */
export async function linkGuardianToStudent(
  linkId: string,
  studentId: string
): Promise<void> {
  await query(`UPDATE student_guardians SET student_id = ? WHERE id = ?`, [
    studentId,
    linkId,
  ]);
}
