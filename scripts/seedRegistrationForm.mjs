#!/usr/bin/env node
/**
 * 2026–2027 수강 신청서 시드
 *
 * lib/forms/presets.ts 의 정규 학기 프리셋을 원격 D1 에 신청서 1건으로 심는다.
 * **초안(draft)으로만 심는다** — 원장 확인(lib/forms/provisionalNotes.ts)이 끝나기 전에
 * 게시되면 안 되기 때문이다. 게시 후에는 선택지를 쪼갤 수 없다.
 *
 * 같은 slug 가 이미 있으면 **덮지 않고 중단한다.** 응답이 달린 폼을 덮어쓰는 사고를 막는다.
 * 문안을 다시 심으려면 관리 화면에서 편집하거나, 초안 상태에서 폼을 지우고 다시 돌린다.
 *
 * 사용: node scripts/seedRegistrationForm.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { seasonPreset2026 } from '../lib/forms/presets.ts';
import { PROVISIONAL_NOTES } from '../lib/forms/provisionalNotes.ts';
import { validateSchema, warnSchema } from '../lib/forms/schema.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnv(file) {
  let text;
  try {
    text = readFileSync(join(root, file), 'utf8');
  } catch {
    return;
  }
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    const value = m[2].trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnv('.env.local');

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const DB_ID = process.env.D1_DATABASE_ID;

if (!ACCOUNT_ID || !API_TOKEN || !DB_ID) {
  console.error('D1 환경변수가 없습니다 (.env.local 의 CLOUDFLARE_ACCOUNT_ID·CLOUDFLARE_API_TOKEN·D1_DATABASE_ID).');
  process.exit(1);
}

async function q(sql, params = []) {
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    }
  );
  const j = await r.json();
  if (!j.success) throw new Error(JSON.stringify(j.errors));
  return j.result[0];
}

const SLUG = '2026-2027-regular';
const SEASON = '2026-2027';
const TITLE_KO = 'KTDOC 2026–2027 수강 신청서';
const TITLE_EN = 'KTDOC 2026–2027 Class Registration Form';
const DESC_KO = [
  '안녕하세요. KTDOC(Korean Traditional Dance of Choomnoori) 2026–2027 정규과정 수강신청서입니다.',
  '',
  '신규 학생과 재학생 모두 아래 내용을 작성해 주시기 바랍니다.',
  '',
  '감사합니다.',
].join('\n');
const DESC_EN = [
  'Welcome to the KTDOC 2026–2027 Regular Program Registration.',
  '',
  'This form is for both new and returning students. Please complete all required information.',
].join('\n');

const schema = seasonPreset2026();

// 게이트를 스스로 통과하는지 먼저 본다 — 시작점이 막히면 아무것도 만들 수 없다.
const errors = validateSchema(schema);
if (errors.length > 0) {
  console.error('스키마 검증 실패:');
  for (const e of errors) console.error('  ✘', e);
  process.exit(1);
}

const existing = await q('SELECT id, status FROM forms WHERE slug = ?', [SLUG]);
if (existing.results.length > 0) {
  const row = existing.results[0];
  console.error(`이미 "${SLUG}" 신청서가 있습니다 (id ${row.id}, 상태 ${row.status}).`);
  console.error('덮어쓰지 않습니다. 문안을 고치려면 /admin/forms 에서 편집해 주세요.');
  process.exit(1);
}

const inserted = await q(
  `INSERT INTO forms
     (slug, season, kind, preset_key, title_ko, title_en, description_ko, description_en,
      schema_json, schema_version, status, requires_login, created_by)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'draft', 0, NULL)`,
  [SLUG, SEASON, 'season', 'season-2026', TITLE_KO, TITLE_EN, DESC_KO, DESC_EN, JSON.stringify(schema)]
);
const formId = inserted.meta.last_row_id;

await q(
  `INSERT INTO form_schema_versions (form_id, version, schema_json, note, created_by)
   VALUES (?, 1, ?, ?, NULL) ON CONFLICT(form_id, version) DO NOTHING`,
  [formId, JSON.stringify(schema), '시드 생성 (2026–2027 구글폼 문안 이관)']
);

const questionCount = schema.sections.flatMap((s) => s.questions).filter((x) => x.type !== 'info').length;
const optionCount =
  schema.sections.flatMap((s) => s.questions).find((x) => x.key === 'q7_classes')?.options?.length ?? 0;

console.log(`✔ 신청서를 심었습니다 — id ${formId}, slug "${SLUG}"`);
console.log(`  문항 ${questionCount}개 · 과목 선택지 ${optionCount}개 · 상태 draft(비공개)`);
console.log(`  편집: /admin/forms/${formId}`);

const warnings = warnSchema(schema);
if (warnings.length > 0) {
  console.log('\n운영 준비 상태 — 게시는 가능하지만 확인이 필요합니다:');
  for (const w of warnings) console.log('  ⚠', w);
}

if (PROVISIONAL_NOTES.length > 0) {
  console.log(`\n🚧 원장 확인이 필요한 잠정 판단 ${PROVISIONAL_NOTES.length}건 — 게시 전에 확정해야 합니다:`);
  for (const n of PROVISIONAL_NOTES) console.log(`  · [${n.id}] ${n.question}`);
  console.log('\n  확인 문서: docs/operations/registration-form-open-questions.md');
  console.log('  확인이 끝나면 lib/forms/provisionalNotes.ts 의 해당 항목을 지웁니다.');
}
