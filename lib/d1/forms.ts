/**
 * lib/d1/forms.ts — 신청서(질문지) 저장소 접근
 *
 * 게시·편집 때마다 form_schema_versions 에 전문을 박는다. schema_json 은 최신본
 * 하나뿐이라, 문안을 고치면 "그때 무엇을 읽고 동의했는가"의 원문이 사라지기 때문이다.
 * 미성년 대상 미디어·환불 동의를 다루는 이상 해시로 '달라졌음'만 아는 것은 증빙이 아니다.
 *
 * 검증·잠금 판정은 전부 lib/forms/schema.ts(순수 함수)가 한다. 이 파일은 그것을
 * 저장소에 옮기기만 한다 — 게이트를 우회하는 경로를 만들지 않는 것이 규칙이다.
 */

import { executeD1, queryD1 } from './client';
import { assertEditAllowed, validateSchema } from '@/lib/forms/schema';
import type { FormKind, FormRow, FormSchema, FormStatus } from '@/types/forms';

/** 잠긴 폼의 파괴적 편집을 API가 409로 옮기기 위한 접두어. */
export const LOCKED_ERROR_PREFIX = 'LOCKED:';

export async function getForms(opts: { status?: FormStatus } = {}): Promise<FormRow[]> {
  const where = opts.status ? 'WHERE status = ?' : '';
  const params = opts.status ? [opts.status] : [];
  return queryD1<FormRow>(
    `SELECT * FROM forms ${where} ORDER BY COALESCE(season, '') DESC, id DESC`,
    params
  );
}

export async function getFormById(id: number): Promise<FormRow | null> {
  const rows = await queryD1<FormRow>('SELECT * FROM forms WHERE id = ?', [id]);
  return rows[0] ?? null;
}

/**
 * 공개 조회 — formViews.publicFormBySlug 의 관점을 그대로 실행한다.
 * 게시된 것만 본다. 초안이 URL 로 새면 안 된다.
 */
export async function getOpenFormBySlug(slug: string): Promise<FormRow | null> {
  const rows = await queryD1<FormRow>(
    "SELECT * FROM forms WHERE slug = ? AND status = 'open'",
    [slug]
  );
  return rows[0] ?? null;
}

/**
 * 제출 화면을 열어 줄 수 있는 신청서 — 접수 중이거나 **임시 게시**.
 * 임시 게시는 끝까지 작성해 볼 수 있어야 하므로 여기 포함되고,
 * 저장하지 않는 판정은 제출 라우트가 status 로 다시 한다.
 */
export async function getSubmittableFormBySlug(slug: string): Promise<FormRow | null> {
  const rows = await queryD1<FormRow>(
    "SELECT * FROM forms WHERE slug = ? AND status IN ('open', 'trial')",
    [slug]
  );
  return rows[0] ?? null;
}

/** 마감·초안 안내를 위해 상태와 무관하게 찾는다(공개 페이지가 "무슨 일인지" 말해야 한다). */
export async function getFormBySlugAnyStatus(slug: string): Promise<FormRow | null> {
  const rows = await queryD1<FormRow>('SELECT * FROM forms WHERE slug = ?', [slug]);
  return rows[0] ?? null;
}

export async function slugExists(slug: string, exceptId?: number): Promise<boolean> {
  const rows = await queryD1<{ n: number }>(
    `SELECT COUNT(*) AS n FROM forms WHERE slug = ?${exceptId ? ' AND id != ?' : ''}`,
    exceptId ? [slug, exceptId] : [slug]
  );
  return (rows[0]?.n ?? 0) > 0;
}

export interface CreateFormInput {
  slug: string;
  season: string | null;
  kind: FormKind;
  preset_key: string | null;
  title_ko: string;
  title_en: string | null;
  description_ko: string | null;
  description_en: string | null;
  schema: FormSchema;
  requires_login: boolean;
  created_by: string | null;
}

export async function createForm(input: CreateFormInput): Promise<number> {
  const errors = validateSchema(input.schema);
  if (errors.length > 0) throw new Error(`스키마 검증 실패: ${errors.join(' / ')}`);

  const { lastRowId } = await executeD1(
    `INSERT INTO forms
       (slug, season, kind, preset_key, title_ko, title_en, description_ko, description_en,
        schema_json, schema_version, status, requires_login, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'draft', ?, ?)`,
    [
      input.slug,
      input.season,
      input.kind,
      input.preset_key,
      input.title_ko,
      input.title_en,
      input.description_ko,
      input.description_en,
      JSON.stringify(input.schema),
      input.requires_login ? 1 : 0,
      input.created_by,
    ]
  );
  await snapshotSchemaVersion(lastRowId, 1, input.schema, '생성', input.created_by);
  return lastRowId;
}

/**
 * 버전 스냅샷 1행. 편집 1회당 1행이므로 연 수십 행 수준이다.
 * ON CONFLICT DO NOTHING: 같은 버전을 두 번 박아도 사고가 되지 않게.
 */
export async function snapshotSchemaVersion(
  formId: number,
  version: number,
  schema: FormSchema,
  note: string | null,
  createdBy: string | null
): Promise<void> {
  await executeD1(
    `INSERT INTO form_schema_versions (form_id, version, schema_json, note, created_by)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(form_id, version) DO NOTHING`,
    [formId, version, JSON.stringify(schema), note, createdBy]
  );
}

/**
 * 응답이 본 문안 버전을 복원한다.
 * 응답 상세는 이것으로 **그때 화면을 재현한다** — 지금 스키마로 그리면 안 된다.
 */
export async function getSchemaVersion(
  formId: number,
  version: number
): Promise<FormSchema | null> {
  const rows = await queryD1<{ schema_json: string }>(
    'SELECT schema_json FROM form_schema_versions WHERE form_id = ? AND version = ?',
    [formId, version]
  );
  if (!rows[0]) return null;
  return JSON.parse(rows[0].schema_json) as FormSchema;
}

export async function getSchemaVersionList(
  formId: number
): Promise<Array<{ version: number; note: string | null; created_at: string }>> {
  return queryD1('SELECT version, note, created_at FROM form_schema_versions WHERE form_id = ? ORDER BY version DESC', [
    formId,
  ]);
}

/**
 * 스키마 저장. 게이트를 통과하지 못하면 저장하지 않는다.
 * 잠긴 폼(locked_at)에서 파괴적 편집이면 LOCKED: 접두어로 던져 API가 409를 내게 한다.
 */
export async function updateFormSchema(
  formId: number,
  schema: FormSchema,
  note: string | null,
  editorId: string | null
): Promise<number> {
  const form = await getFormById(formId);
  if (!form) throw new Error('신청서를 찾을 수 없습니다.');

  const errors = validateSchema(schema);
  if (errors.length > 0) throw new Error(`스키마 검증 실패: ${errors.join(' / ')}`);

  const before = JSON.parse(form.schema_json) as FormSchema;
  const lockErrors = assertEditAllowed(before, schema, form.locked_at != null);
  if (lockErrors.length > 0) throw new Error(`${LOCKED_ERROR_PREFIX}${lockErrors.join(' / ')}`);

  const nextVersion = form.schema_version + 1;
  await executeD1(
    `UPDATE forms SET schema_json = ?, schema_version = ?, updated_at = datetime('now') WHERE id = ?`,
    [JSON.stringify(schema), nextVersion, formId]
  );
  await snapshotSchemaVersion(formId, nextVersion, schema, note, editorId);
  return nextVersion;
}

type FormMetaFields = Pick<
  FormRow,
  | 'slug'
  | 'season'
  | 'title_ko'
  | 'title_en'
  | 'description_ko'
  | 'description_en'
  | 'opens_at'
  | 'closes_at'
  | 'requires_login'
  | 'allow_resubmit'
>;

/** 화이트리스트 밖의 키는 무시한다 — 컬럼명을 문자열로 조립하는 자리다. */
const META_FIELDS: Array<keyof FormMetaFields> = [
  'slug',
  'season',
  'title_ko',
  'title_en',
  'description_ko',
  'description_en',
  'opens_at',
  'closes_at',
  'requires_login',
  'allow_resubmit',
];

export async function updateFormMeta(
  formId: number,
  input: Partial<FormMetaFields>
): Promise<void> {
  const fields = META_FIELDS.filter((f) => input[f] !== undefined);
  if (fields.length === 0) return;
  const sets = fields.map((f) => `${f} = ?`).join(', ');
  await executeD1(`UPDATE forms SET ${sets}, updated_at = datetime('now') WHERE id = ?`, [
    ...fields.map((f) => input[f] as unknown),
    formId,
  ]);
}

export async function publishForm(formId: number): Promise<void> {
  await executeD1(
    `UPDATE forms
        SET status = 'open',
            published_at = COALESCE(published_at, datetime('now')),
            updated_at = datetime('now')
      WHERE id = ?`,
    [formId]
  );
}

/**
 * 임시 게시 — 링크를 아는 누구나 열어 볼 수 있게 하되 저장은 하지 않는다.
 * published_at 을 찍지 않는다: 아직 진짜로 연 것이 아니다.
 */
export async function startTrial(formId: number): Promise<void> {
  await executeD1(
    `UPDATE forms SET status = 'trial', updated_at = datetime('now') WHERE id = ?`,
    [formId]
  );
}

/** 임시 게시를 걷고 초안으로 되돌린다. */
export async function endTrial(formId: number): Promise<void> {
  await executeD1(
    `UPDATE forms SET status = 'draft', updated_at = datetime('now') WHERE id = ?`,
    [formId]
  );
}

export async function closeForm(formId: number): Promise<void> {
  await executeD1(`UPDATE forms SET status = 'closed', updated_at = datetime('now') WHERE id = ?`, [
    formId,
  ]);
}

/** 첫 제출이 들어온 순간 구조를 잠근다. 이미 잠겼으면 시각을 덮지 않는다. */
export async function lockFormOnFirstResponse(formId: number): Promise<void> {
  await executeD1(
    `UPDATE forms SET locked_at = datetime('now') WHERE id = ? AND locked_at IS NULL`,
    [formId]
  );
}

/**
 * 연차 복제 — 요구 R2.1. schema_json 컬럼 하나를 복사하면 끝난다.
 * (문항을 정규화 테이블로 쪼갰다면 여기가 행 N+M개 복사가 된다. 그게 이 모델을 고른 이유다.)
 */
export async function duplicateForm(
  sourceId: number,
  input: { slug: string; season: string | null; title_ko: string; createdBy: string | null }
): Promise<number> {
  const src = await getFormById(sourceId);
  if (!src) throw new Error('복제할 신청서를 찾을 수 없습니다.');

  const { lastRowId } = await executeD1(
    `INSERT INTO forms
       (slug, season, kind, preset_key, title_ko, title_en, description_ko, description_en,
        schema_json, schema_version, status, requires_login, allow_resubmit,
        copied_from_form_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'draft', ?, ?, ?, ?)`,
    [
      input.slug,
      input.season,
      src.kind,
      src.preset_key,
      input.title_ko,
      src.title_en,
      src.description_ko,
      src.description_en,
      src.schema_json,
      src.requires_login,
      src.allow_resubmit,
      sourceId,
      input.createdBy,
    ]
  );
  await snapshotSchemaVersion(
    lastRowId,
    1,
    JSON.parse(src.schema_json) as FormSchema,
    `${src.title_ko} 복제`,
    input.createdBy
  );
  return lastRowId;
}

/** 응답이 하나라도 있으면 지울 수 없다. 증빙이 매달려 있기 때문이다. */
export async function deleteForm(formId: number): Promise<void> {
  const rows = await queryD1<{ n: number }>(
    'SELECT COUNT(*) AS n FROM form_responses WHERE form_id = ?',
    [formId]
  );
  if ((rows[0]?.n ?? 0) > 0) throw new Error('응답이 있는 신청서는 삭제할 수 없습니다.');
  await executeD1('DELETE FROM form_schema_versions WHERE form_id = ?', [formId]);
  await executeD1('DELETE FROM forms WHERE id = ?', [formId]);
}

/** 수업 상세의 신청 버튼이 어느 폼으로 갈지 — programs.active_form_id 의 slug */
export async function getFormSlugById(id: number): Promise<string | null> {
  const rows = await queryD1<{ slug: string; status: FormStatus }>(
    'SELECT slug, status FROM forms WHERE id = ?',
    [id]
  );
  const row = rows[0];
  if (!row || row.status !== 'open') return null;
  return row.slug;
}

/**
 * 수업에 붙은 신청서의 지금 상태 — **신청 경로를 정하는 유일한 근거**.
 *
 * 왜 slug만으로는 안 되는가: getFormSlugById 는 접수 중이 아니면 null을 준다.
 * 그러면 호출부가 "신청서가 없는 수업"과 "신청서가 마감된 수업"을 구별하지 못하고,
 * 마감된 순간 옛 모달로 조용히 되돌아갔다. 둘은 전혀 다른 상황이다 —
 * 전자는 옛 경로가 정답이고, 후자는 '접수 마감'이 정답이다.
 *
 * 화면(수업 상세)과 서버(POST /api/applications)가 **같은 이 함수**를 보고
 * 판단해야 한 페이지에 서로 다른 곳으로 가는 버튼이 다시 생기지 않는다.
 */
export interface LinkedForm {
  id: number;
  slug: string;
  status: FormStatus;
  /** 지금 이 신청서로 받고 있는가 */
  isOpen: boolean;
}

export async function getLinkedForm(formId: number | null): Promise<LinkedForm | null> {
  if (!formId) return null;
  const rows = await queryD1<{ id: number; slug: string; status: FormStatus }>(
    'SELECT id, slug, status FROM forms WHERE id = ?',
    [formId]
  );
  const row = rows[0];
  if (!row) return null;
  return { ...row, isOpen: row.status === 'open' };
}
