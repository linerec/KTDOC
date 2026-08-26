/**
 * lib/d1/formResponses.ts — 신청 응답 저장소 접근
 *
 * 두 가지 규칙이 이 파일 전체를 지배한다:
 *
 * 1. **응답 본체는 단일 INSERT 로 착지한다.** D1은 트랜잭션을 거부하므로(실측)
 *    "응답 1행 + 선택 N행 + 동의 M행"을 원자적으로 쓸 방법이 없다. 응답만은
 *    반드시 한 문장으로 들어가야 한다 — 그래야 반쯤 저장된 신청이 생기지 않는다.
 *
 * 2. **answers_json 이 유일한 진실의 원천이고, 파생 두 테이블은 언제든 재계산된다.**
 *    파생 INSERT 가 실패하면 derived_dirty=1 을 세우고 응답은 정상 저장한다.
 *    조회 경로가 그 표시를 보고 조용히 재구축한다 — 운영자에게 "재구축 버튼"을
 *    보여주지 않기 위해서다(파생 인덱스라는 개념을 원장에게 설명해야 하는 UI는 실패다).
 */

import { batchD1, executeD1, queryD1 } from './client';
import { chunkParams } from './chunk';
import { lockFormOnFirstResponse } from './forms';
import { applyBindings, type DerivedConsent, type DerivedSelection } from '@/lib/forms/schema';
import type {
  Answers,
  FormResponseConsent,
  FormResponseNote,
  FormResponseRow,
  FormResponseSelection,
  FormSchema,
  LinkSource,
  ResponseSource,
  ResponseStatus,
} from '@/types/forms';

/** 파생 INSERT 는 행당 컬럼이 6개(선택)·5개(동의)라 15행이면 90개 안쪽이다. */
const DERIVED_ROWS_PER_STATEMENT = 15;

export interface InsertResponseInput {
  formId: number;
  formTitleKo: string | null;
  schemaVersion: number;
  season: string | null;
  locale: string;
  schema: FormSchema;
  answers: Answers;
  submittedByUserId: string | null;
  studentUserId: string | null;
  linkSource: LinkSource | null;
  source: ResponseSource;
  metaJson: string | null;
  submitIpHash: string | null;
}

/**
 * 응답을 저장하고 파생을 만든다. 반환은 응답 id.
 * 파생이 실패해도 응답은 남는다(derived_dirty=1).
 */
export async function insertResponse(input: InsertResponseInput): Promise<number> {
  const { core, selections, consents, hasMedical } = applyBindings(
    input.schema,
    input.answers,
    input.schemaVersion
  );

  // ── 1) 응답 본체: 단일 INSERT. 여기서 실패하면 아무것도 남지 않는다.
  const { lastRowId } = await executeD1(
    `INSERT INTO form_responses
       (form_id, form_title_ko, form_schema_version, season, locale,
        submitted_by_user_id, student_user_id, link_source,
        student_name, student_name_norm, student_grade, email, email_norm, phone, guardian_name,
        status, source, is_latest, has_medical, derived_dirty,
        answers_json, meta_json, submit_ip_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, 1, ?, 0, ?, ?, ?)`,
    [
      input.formId,
      input.formTitleKo,
      input.schemaVersion,
      input.season,
      input.locale,
      input.submittedByUserId,
      input.studentUserId,
      input.linkSource,
      core.student_name,
      core.student_name_norm,
      core.student_grade,
      core.email,
      core.email_norm,
      core.phone,
      core.guardian_name,
      input.source,
      hasMedical ? 1 : 0,
      JSON.stringify(input.answers),
      input.metaJson,
      input.submitIpHash,
    ]
  );

  // ── 2) 파생: 실패해도 응답을 되돌리지 않는다. 표시만 남기고 나중에 재구축한다.
  try {
    await writeDerived(lastRowId, selections, consents);
  } catch (error) {
    console.error('form derived write failed, marking dirty:', error);
    await executeD1('UPDATE form_responses SET derived_dirty = 1 WHERE id = ?', [lastRowId]);
  }

  // ── 3) 구조 잠금: 첫 제출이 들어왔으니 이제 문항·선택지를 지울 수 없다.
  try {
    await lockFormOnFirstResponse(input.formId);
  } catch (error) {
    console.error('form lock failed:', error);
  }

  // ── 4) 재제출 정리: 같은 (폼, 이메일, 학생이름) 그룹의 옛 응답을 내린다.
  //     두 문장이라 원자적이지 않다 — 조회 경로에서 그룹당 최신 1건으로 한 번 더 접는다.
  if (core.email_norm && core.student_name_norm) {
    try {
      await executeD1(
        `UPDATE form_responses SET is_latest = 0
          WHERE form_id = ? AND email_norm = ? AND student_name_norm = ? AND id != ?`,
        [input.formId, core.email_norm, core.student_name_norm, lastRowId]
      );
    } catch (error) {
      console.error('form is_latest cleanup failed:', error);
    }
  }

  return lastRowId;
}

async function writeDerived(
  responseId: number,
  selections: DerivedSelection[],
  consents: DerivedConsent[]
): Promise<void> {
  const statements: Array<{ sql: string; params: unknown[] }> = [];

  for (const chunk of chunkParams(selections, DERIVED_ROWS_PER_STATEMENT)) {
    const values = chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
    statements.push({
      sql: `INSERT INTO form_response_selections
              (response_id, question_key, option_key, option_label_ko, option_label_en, program_id)
            VALUES ${values}
            ON CONFLICT(response_id, question_key, option_key) DO NOTHING`,
      params: chunk.flatMap((s) => [
        responseId,
        s.question_key,
        s.option_key,
        s.option_label_ko,
        s.option_label_en,
        s.program_id,
      ]),
    });
  }

  for (const chunk of chunkParams(consents, DERIVED_ROWS_PER_STATEMENT)) {
    const values = chunk.map(() => '(?, ?, ?, ?, ?)').join(', ');
    statements.push({
      sql: `INSERT INTO form_response_consents
              (response_id, consent_key, question_key, agreed, policy_version)
            VALUES ${values}
            ON CONFLICT(response_id, consent_key) DO UPDATE SET
              agreed = excluded.agreed, policy_version = excluded.policy_version`,
      params: chunk.flatMap((c) => [
        responseId,
        c.consent_key,
        c.question_key,
        c.agreed,
        c.policy_version,
      ]),
    });
  }

  if (statements.length > 0) await batchD1(statements);
}

/**
 * 파생 재구축 — answers_json + **그 응답이 본 스키마 버전**으로 처음부터 다시 만든다.
 *
 * 옛 문안 버전을 쓰는 것이 중요하다. 지금 스키마로 재계산하면 그때 있었으나
 * 이후 retired 된 선택지가 사라진다.
 */
export async function rebuildDerived(responseId: number): Promise<void> {
  const rows = await queryD1<{
    answers_json: string;
    form_id: number;
    form_schema_version: number;
  }>('SELECT answers_json, form_id, form_schema_version FROM form_responses WHERE id = ?', [
    responseId,
  ]);
  const r = rows[0];
  if (!r) return;

  const snapshot = await queryD1<{ schema_json: string }>(
    'SELECT schema_json FROM form_schema_versions WHERE form_id = ? AND version = ?',
    [r.form_id, r.form_schema_version]
  );
  let raw = snapshot[0]?.schema_json;
  if (!raw) {
    // 스냅샷이 없으면 최신 스키마로 폴백한다 — 없는 것보다 낫다.
    const current = await queryD1<{ schema_json: string }>(
      'SELECT schema_json FROM forms WHERE id = ?',
      [r.form_id]
    );
    raw = current[0]?.schema_json;
  }
  if (!raw) return;

  const schema = JSON.parse(raw) as FormSchema;
  const answers = JSON.parse(r.answers_json) as Answers;
  const { selections, consents } = applyBindings(schema, answers, r.form_schema_version);

  await executeD1('DELETE FROM form_response_selections WHERE response_id = ?', [responseId]);
  await executeD1('DELETE FROM form_response_consents WHERE response_id = ?', [responseId]);
  await writeDerived(responseId, selections, consents);
  await executeD1('UPDATE form_responses SET derived_dirty = 0 WHERE id = ?', [responseId]);
}

/**
 * 조회 경로에서 부르는 **조용한 자동 재구축**. 최대 20건.
 * 운영자는 이 함수가 있는지도 모른다 — 그게 의도다.
 */
export async function rebuildDirtyForForm(formId: number, limit = 20): Promise<number> {
  const rows = await queryD1<{ id: number }>(
    'SELECT id FROM form_responses WHERE form_id = ? AND derived_dirty = 1 LIMIT ?',
    [formId, limit]
  );
  for (const row of rows) {
    try {
      await rebuildDerived(row.id);
    } catch (error) {
      console.error('rebuildDerived failed for response', row.id, error);
    }
  }
  return rows.length;
}

export async function countDirty(formId: number): Promise<number> {
  const rows = await queryD1<{ n: number }>(
    'SELECT COUNT(*) AS n FROM form_responses WHERE form_id = ? AND derived_dirty = 1',
    [formId]
  );
  return rows[0]?.n ?? 0;
}

export async function getResponseById(id: number): Promise<FormResponseRow | null> {
  const rows = await queryD1<FormResponseRow>('SELECT * FROM form_responses WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export async function getSelections(responseId: number): Promise<FormResponseSelection[]> {
  return queryD1<FormResponseSelection>(
    'SELECT * FROM form_response_selections WHERE response_id = ? ORDER BY id',
    [responseId]
  );
}

export async function getConsents(responseId: number): Promise<FormResponseConsent[]> {
  return queryD1<FormResponseConsent>(
    'SELECT * FROM form_response_consents WHERE response_id = ? ORDER BY id',
    [responseId]
  );
}

/** 운영 응답 목록 — formViews.adminResponseList 의 관점을 실행한다. */
export async function getResponses(view: {
  formId: number;
  latestOnly: boolean;
  statuses?: ResponseStatus[];
  search?: string;
  limit: number;
  offset: number;
}): Promise<{ rows: FormResponseRow[]; total: number }> {
  const where: string[] = ['form_id = ?'];
  const params: unknown[] = [view.formId];

  if (view.latestOnly) where.push('is_latest = 1');
  if (view.statuses?.length) {
    where.push(`status IN (${view.statuses.map(() => '?').join(', ')})`);
    params.push(...view.statuses);
  }
  if (view.search?.trim()) {
    where.push('(student_name LIKE ? OR email LIKE ? OR phone LIKE ? OR guardian_name LIKE ?)');
    const like = `%${view.search.trim()}%`;
    params.push(like, like, like, like);
  }

  const clause = `WHERE ${where.join(' AND ')}`;
  const [rows, counts] = await Promise.all([
    queryD1<FormResponseRow>(
      `SELECT * FROM form_responses ${clause} ORDER BY submitted_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, view.limit, view.offset]
    ),
    queryD1<{ n: number }>(`SELECT COUNT(*) AS n FROM form_responses ${clause}`, params),
  ]);
  return { rows, total: counts[0]?.n ?? 0 };
}

/** 폼별 응답 수 — 목록 화면에서 N+1 쿼리를 피한다. */
export async function getResponseCountsByForm(): Promise<Record<number, number>> {
  const rows = await queryD1<{ form_id: number; n: number }>(
    'SELECT form_id, COUNT(*) AS n FROM form_responses WHERE is_latest = 1 GROUP BY form_id'
  );
  return Object.fromEntries(rows.map((r) => [r.form_id, r.n]));
}

/** 대시보드 콜아웃 — 처리 대기(new) 건수. getApplicationCounts 를 대체한다. */
export async function getPendingResponseCounts(): Promise<{ total: number }> {
  const rows = await queryD1<{ n: number }>(
    `SELECT COUNT(*) AS n FROM form_responses WHERE status = 'new' AND is_latest = 1`
  );
  return { total: rows[0]?.n ?? 0 };
}

export async function updateResponseStatus(
  id: number,
  status: ResponseStatus,
  reviewerId: string | null
): Promise<void> {
  await executeD1(
    `UPDATE form_responses
        SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?`,
    [status, reviewerId, id]
  );
}

/**
 * 처리 이력 한 줄 추가. body가 있으면 form_responses.internal_note(요약 칸)도 갱신한다.
 *
 * **system: true 면 요약 칸을 건드리지 않는다.** '회원 연결했습니다', '수업 3개에
 * 배정했습니다' 같은 자동 문장이 요약 칸을 덮어쓰는 바람에, 선생님이 쓴 운영 판단이
 * 처리 몇 분 만에 사라졌다(예: "결석하는날이 있으면 일요성인수업때 메이크업 가능").
 * 실제로 처리된 응답 전부에서 일어났고, CSV의 '운영 메모' 열에 사람이 쓴 말이
 * 한 줄도 남지 않았다. 이력 테이블에는 그대로 있으니 요약 칸만 지키면 된다.
 */
export async function addResponseNote(input: {
  responseId: number;
  kind: FormResponseNote['kind'];
  fromStatus?: string | null;
  toStatus?: string | null;
  body?: string | null;
  authorId: string | null;
  authorName: string | null;
  /** 시스템이 자동으로 쓴 문장인가. true면 요약 칸(internal_note)을 덮지 않는다. */
  system?: boolean;
}): Promise<void> {
  await executeD1(
    `INSERT INTO form_response_notes
       (response_id, kind, from_status, to_status, body, author_id, author_name)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.responseId,
      input.kind,
      input.fromStatus ?? null,
      input.toStatus ?? null,
      input.body ?? null,
      input.authorId,
      input.authorName,
    ]
  );
  if (input.body?.trim() && !input.system) {
    await executeD1(
      `UPDATE form_responses SET internal_note = ?, updated_at = datetime('now') WHERE id = ?`,
      [input.body.trim(), input.responseId]
    );
  }
}

export async function getResponseNotes(responseId: number): Promise<FormResponseNote[]> {
  return queryD1<FormResponseNote>(
    'SELECT * FROM form_response_notes WHERE response_id = ? ORDER BY created_at DESC, id DESC',
    [responseId]
  );
}

/** 의료정보를 누가 언제 열어 봤는지 남긴다. "샜는지조차 모르는" 상태를 피한다. */
export async function recordSensitiveView(input: {
  responseId: number;
  viewerId: string;
  viewerName: string | null;
  context: 'detail' | 'csv';
}): Promise<void> {
  await executeD1(
    `INSERT INTO form_sensitive_views (response_id, viewer_id, viewer_name, context)
     VALUES (?, ?, ?, ?)`,
    [input.responseId, input.viewerId, input.viewerName, input.context]
  );
}

export async function linkResponseToMember(input: {
  responseId: number;
  studentUserId: string;
  linkSource: LinkSource;
}): Promise<void> {
  await executeD1(
    `UPDATE form_responses
        SET student_user_id = ?, link_source = ?, updated_at = datetime('now')
      WHERE id = ?`,
    [input.studentUserId, input.linkSource, input.responseId]
  );
}

export async function markPromoted(responseId: number): Promise<void> {
  await executeD1(
    `UPDATE form_responses
        SET status = 'enrolled', enrolled_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?`,
    [responseId]
  );
}

export interface RosterRow {
  option_key: string;
  option_label_ko: string | null;
  program_id: number | null;
  response_id: number;
  student_name: string;
  student_grade: string | null;
  email: string | null;
  phone: string | null;
  status: ResponseStatus;
  period_key: string | null;
  submitted_at: string;
}

/**
 * 과목별 명단 — 1년 등록 우선 → 선착순.
 *
 * 이 정렬이 배정 규칙 자체다: 삼고무·오고무는 보유 북 수량이 제한되어
 * 1년 과정 등록 학생에게 우선 배정되고 잔여 자리는 선착순이다.
 */
export async function getRoster(view: {
  formId: number;
  periodQuestionKey: string;
  fullYearOptionKey: string;
}): Promise<RosterRow[]> {
  const periodPath = `$.${view.periodQuestionKey}`;
  return queryD1<RosterRow>(
    `SELECT s.option_key, s.option_label_ko, s.program_id,
            r.id AS response_id, r.student_name, r.student_grade, r.email, r.phone, r.status,
            json_extract(r.answers_json, ?) AS period_key,
            r.submitted_at
       FROM form_response_selections s
       JOIN form_responses r ON r.id = s.response_id
      WHERE r.form_id = ? AND r.is_latest = 1 AND r.status != 'cancelled'
      ORDER BY s.option_key,
               CASE WHEN json_extract(r.answers_json, ?) = ? THEN 0 ELSE 1 END,
               r.submitted_at, r.id`,
    [periodPath, view.formId, periodPath, view.fullYearOptionKey]
  );
}

/** 과목별 신청 수 — 명단 화면의 `7 / 10` 표시용. */
export async function getSelectionCounts(formId: number): Promise<Record<string, number>> {
  const rows = await queryD1<{ option_key: string; n: number }>(
    `SELECT s.option_key, COUNT(*) AS n
       FROM form_response_selections s
       JOIN form_responses r ON r.id = s.response_id
      WHERE r.form_id = ? AND r.is_latest = 1 AND r.status != 'cancelled'
      GROUP BY s.option_key`,
    [formId]
  );
  return Object.fromEntries(rows.map((r) => [r.option_key, r.n]));
}

/**
 * 내보내기용 전체 응답 — 페이지를 나누지 않는다.
 * 취소본과 옛 재제출본은 뺀다(운영이 쓰는 것은 살아 있는 최신본이다).
 * 상한을 두는 이유: 실수로 수만 건을 한 번에 긁어 원격 D1을 때리지 않기 위해서다.
 */
export async function getResponsesForExport(
  formId: number,
  limit = 2000
): Promise<FormResponseRow[]> {
  return queryD1<FormResponseRow>(
    `SELECT * FROM form_responses
      WHERE form_id = ? AND is_latest = 1 AND status != 'cancelled'
      ORDER BY submitted_at, id
      LIMIT ?`,
    [formId, limit]
  );
}

/**
 * 제출자·대상 학생을 나중에 붙인다.
 *
 * 신청서 안에서 가입할 때 쓴다: 응답을 **먼저** 저장하고(신청이 목적이다)
 * 계정을 만든 뒤 그 결과를 여기서 얹는다. 순서를 뒤집으면 응답 저장이 실패했을 때
 * 계정만 덩그러니 남는다.
 */
export async function attachSubmitter(input: {
  responseId: number;
  submittedByUserId: string;
  /** 학생 본인이 가입한 경우에만 채운다. 학부모 계정을 여기 넣으면 수업에 학부모가 배정된다. */
  studentUserId: string | null;
  linkSource: LinkSource;
}): Promise<void> {
  await executeD1(
    `UPDATE form_responses
        SET submitted_by_user_id = ?,
            student_user_id = COALESCE(?, student_user_id),
            link_source = ?,
            updated_at = datetime('now')
      WHERE id = ?`,
    [input.submittedByUserId, input.studentUserId, input.linkSource, input.responseId]
  );
}
