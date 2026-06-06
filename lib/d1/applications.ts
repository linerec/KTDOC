/**
 * Applications D1 Database Queries
 * 수업·캠프 신청(지원) 데이터베이스 쿼리 (lib/d1/gallery.ts 규약을 따름)
 */

import { queryD1, executeD1 } from './client';
import type {
  Application,
  ApplicationWithProgram,
  ApplicationFilters,
  CreateApplicationInput,
  UpdateApplicationStatusInput,
} from '@/types/programs';

export async function getApplications(filters: ApplicationFilters = {}): Promise<{
  applications: ApplicationWithProgram[];
  total: number;
}> {
  const { program_id, status, search, page = 1, limit = 50 } = filters;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (program_id !== undefined) {
    conditions.push('a.program_id = ?');
    params.push(program_id);
  }
  if (status) {
    conditions.push('a.status = ?');
    params.push(status);
  }
  if (search) {
    conditions.push(
      '(a.applicant_name LIKE ? OR a.guardian_name LIKE ? OR a.email LIKE ? OR a.phone LIKE ? OR a.program_title_ko LIKE ?)'
    );
    const term = `%${search}%`;
    params.push(term, term, term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await queryD1<{ count: number }>(
    `SELECT COUNT(*) as count FROM applications a ${whereClause}`,
    params
  );
  const total = countResult[0]?.count || 0;

  const offset = (page - 1) * limit;
  const applications = await queryD1<ApplicationWithProgram>(
    `SELECT a.*, p.program_type as program_type, p.slug as program_slug
     FROM applications a
     LEFT JOIN programs p ON a.program_id = p.id
     ${whereClause}
     ORDER BY (a.status = 'new') DESC, a.created_at DESC, a.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { applications, total };
}

export async function getApplicationById(id: number): Promise<ApplicationWithProgram | null> {
  const rows = await queryD1<ApplicationWithProgram>(
    `SELECT a.*, p.program_type as program_type, p.slug as program_slug
     FROM applications a
     LEFT JOIN programs p ON a.program_id = p.id
     WHERE a.id = ?`,
    [id]
  );
  return rows[0] || null;
}

export async function getApplicationCounts(): Promise<{ total: number; new: number }> {
  const totalRes = await queryD1<{ count: number }>(
    'SELECT COUNT(*) as count FROM applications'
  );
  const newRes = await queryD1<{ count: number }>(
    "SELECT COUNT(*) as count FROM applications WHERE status = 'new'"
  );
  return {
    total: totalRes[0]?.count || 0,
    new: newRes[0]?.count || 0,
  };
}

/**
 * 신청 생성. consent는 항상 1로 저장(서버에서 동의 검증을 통과한 경우에만 호출),
 * status는 기본 'new'. 정원 카운터 등의 부수 효과 없음.
 */
export async function createApplication(
  input: CreateApplicationInput,
  meta: { program_title_snapshot: string | null }
): Promise<number> {
  const { lastRowId } = await executeD1(
    `INSERT INTO applications (
      program_id, program_title_ko, applicant_name, guardian_name,
      email, phone, participant_age, message, consent, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'new')`,
    [
      input.program_id,
      meta.program_title_snapshot,
      input.applicant_name,
      input.guardian_name || null,
      input.email,
      input.phone || null,
      input.participant_age || null,
      input.message || null,
    ]
  );
  return lastRowId;
}

export async function updateApplicationStatus(
  id: number,
  input: UpdateApplicationStatusInput
): Promise<void> {
  await executeD1(
    "UPDATE applications SET status = ?, updated_at = datetime('now') WHERE id = ?",
    [input.status, id]
  );
}

export async function deleteApplication(id: number): Promise<Application | null> {
  const rows = await queryD1<Application>('SELECT * FROM applications WHERE id = ?', [id]);
  if (rows.length === 0) return null;
  await executeD1('DELETE FROM applications WHERE id = ?', [id]);
  return rows[0];
}
