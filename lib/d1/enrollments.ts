/**
 * 수업·프로그램 수강생(원생 배정) — Cloudflare D1
 *
 * 운영진(관리자·선생님)이 programs(D1)에 원생(MySQL users.id)을 수강생으로 배정한다.
 * 저장소가 달라(D1↔MySQL) user_id는 FK 없이 UUID 문자열만 보관하며,
 * 회원 이름은 호출부에서 getUserNamesByIds(MySQL)로 해석한다(event_checkins 패턴과 동일).
 *
 * 이 데이터로:
 *  - 운영진의 프로그램별 수강생 명단(편집 화면)
 *  - 원생 본인의 '내 수업'
 *  - 학부모의 자녀 수업 화면
 */

import { queryD1, executeD1 } from './client';
import type {
  Program,
  ProgramEnrollment,
  ProgramWithMeta,
  MyEnrollment,
  CreateEnrollmentInput,
  UpdateEnrollmentInput,
  EnrollmentStatus,
} from '@/types/programs';

/** 특정 프로그램의 수강생 행 목록(배정 순). 이름 해석은 호출부(MySQL). */
export async function getProgramEnrollments(
  programId: number
): Promise<ProgramEnrollment[]> {
  return queryD1<ProgramEnrollment>(
    `SELECT * FROM program_enrollments
     WHERE program_id = ?
     ORDER BY enrolled_at ASC, id ASC`,
    [programId]
  );
}

/** 단일 수강생 행 조회 — API에서 소속 프로그램 검증용. */
export async function getEnrollmentById(
  id: number
): Promise<ProgramEnrollment | null> {
  const rows = await queryD1<ProgramEnrollment>(
    'SELECT * FROM program_enrollments WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] ?? null;
}

/** 여러 프로그램의 수강생 수(취소 제외) — 목록 표시용(여러 프로그램 한 번에). */
export async function getEnrollmentCountsByProgram(
  programIds: number[]
): Promise<Map<number, number>> {
  if (programIds.length === 0) return new Map();
  const placeholders = programIds.map(() => '?').join(', ');
  const rows = await queryD1<{ program_id: number; count: number }>(
    `SELECT program_id, COUNT(*) AS count
     FROM program_enrollments
     WHERE program_id IN (${placeholders}) AND status != 'cancelled'
     GROUP BY program_id`,
    programIds
  );
  const map = new Map<number, number>();
  for (const r of rows) map.set(r.program_id, r.count);
  return map;
}

/** programs JOIN 행(프로그램 모든 컬럼 + enrollment 메타 별칭) */
type MyEnrollmentRow = Program & {
  enrollment_id: number;
  enroll_status: EnrollmentStatus;
  enroll_note: string | null;
  enroll_at: string;
  enroll_user_id: string;
};

function mapMyEnrollment(row: MyEnrollmentRow): MyEnrollment {
  const {
    enrollment_id,
    enroll_status,
    enroll_note,
    enroll_at,
    enroll_user_id,
    ...program
  } = row;
  return {
    enrollment_id,
    user_id: enroll_user_id,
    status: enroll_status,
    note: enroll_note,
    enrolled_at: enroll_at,
    program: program as ProgramWithMeta,
  };
}

const MY_ENROLLMENT_SELECT = `SELECT p.*,
       e.id AS enrollment_id,
       e.status AS enroll_status,
       e.note AS enroll_note,
       e.enrolled_at AS enroll_at,
       e.user_id AS enroll_user_id
FROM program_enrollments e
JOIN programs p ON p.id = e.program_id`;

/** 원생 본인이 배정된 수업 목록(프로그램 메타 포함) — '내 수업'. 최신 배정순. */
export async function getEnrollmentsForUser(
  userId: string
): Promise<MyEnrollment[]> {
  const rows = await queryD1<MyEnrollmentRow>(
    `${MY_ENROLLMENT_SELECT}
     WHERE e.user_id = ?
     ORDER BY e.enrolled_at DESC, e.id DESC`,
    [userId]
  );
  return rows.map(mapMyEnrollment);
}

/** 여러 회원이 배정된 수업 목록 — 학부모의 자녀별 '내 수업'(user_id로 그룹핑). */
export async function getEnrollmentsForUsers(
  userIds: string[]
): Promise<MyEnrollment[]> {
  if (userIds.length === 0) return [];
  const placeholders = userIds.map(() => '?').join(', ');
  const rows = await queryD1<MyEnrollmentRow>(
    `${MY_ENROLLMENT_SELECT}
     WHERE e.user_id IN (${placeholders})
     ORDER BY e.enrolled_at DESC, e.id DESC`,
    userIds
  );
  return rows.map(mapMyEnrollment);
}

/**
 * 한 회원의 수업별 배정 상태 — programId → status.
 *
 * 신청서 승격이 "이미 취소해 둔 수업"을 되살리지 않으려고 먼저 확인하는 용도다.
 * createEnrollment 는 멱등 UPSERT라 무조건 덮어쓰는데, 운영진이 수업 화면에서
 * 취소로 내려 둔 사람을 다른 화면(신청 상세)의 배정 버튼이 조용히 되살리면
 * 두 화면이 서로의 결정을 지우게 된다.
 */
export async function getEnrollmentStatusesForUser(
  userId: string
): Promise<Map<number, EnrollmentStatus>> {
  const rows = await queryD1<{ program_id: number; status: EnrollmentStatus }>(
    'SELECT program_id, status FROM program_enrollments WHERE user_id = ?',
    [userId]
  );
  return new Map(rows.map((r) => [r.program_id, r.status]));
}

/**
 * 수강생 배정(멱등). 이미 있으면 상태·메모·배정자를 갱신한다(취소했다가 재배정 포함).
 * 어떤 회원을 배정할지(원생 역할 등)는 호출부에서 강제한다.
 */
export async function createEnrollment(
  programId: number,
  input: CreateEnrollmentInput
): Promise<void> {
  await executeD1(
    `INSERT INTO program_enrollments (program_id, user_id, status, note, enrolled_by)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(program_id, user_id)
       DO UPDATE SET status = excluded.status,
                     note = excluded.note,
                     enrolled_by = excluded.enrolled_by`,
    [
      programId,
      input.user_id,
      input.status ?? 'active',
      input.note ?? null,
      input.enrolled_by ?? null,
    ]
  );
}

/** 수강생 상태·메모 변경. */
export async function updateEnrollment(
  id: number,
  input: UpdateEnrollmentInput
): Promise<void> {
  const fields: string[] = [];
  const params: unknown[] = [];
  if (input.status !== undefined) {
    fields.push('status = ?');
    params.push(input.status);
  }
  if (input.note !== undefined) {
    fields.push('note = ?');
    params.push(input.note);
  }
  if (fields.length === 0) return;
  params.push(id);
  await executeD1(
    `UPDATE program_enrollments SET ${fields.join(', ')} WHERE id = ?`,
    params
  );
}

/** 수강생 배정 해제(행 삭제). 삭제 성공 시 true. */
export async function deleteEnrollment(id: number): Promise<boolean> {
  const { changes } = await executeD1(
    'DELETE FROM program_enrollments WHERE id = ?',
    [id]
  );
  return changes > 0;
}
