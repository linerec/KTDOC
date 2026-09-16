#!/usr/bin/env node
/**
 * 게시된 신청서의 선택지 학비 코드(courseCode)를 바꾼다 — 구조는 손대지 않는다.
 *
 * 2026-09-16: 성인반 학비표가 도착해 일요 성인반 3종을 성인 코드로 옮긴다. 그 전까지
 * 어린이 단품 행에 임시로 붙어 있어 운영 화면이 어린이 가격($650 등)을 보여 줬다.
 * 편집 화면의 '과목·기간' 탭에서도 되지만, 세 줄을 한 번에 검증·기록하려고 스크립트로 한다.
 * updateFormSchema 를 그대로 쓰므로 검증·잠금 규칙·버전 스냅샷이 화면과 같다.
 *
 *   node scripts/patchFormCourseCodes.mjs <formId> key=code [key=code ...]           # 미리 보기
 *   node scripts/patchFormCourseCodes.mjs <formId> key=code [key=code ...] --apply
 */
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
    const value = m[2].trim().replace(/^["']|["']$/g, '');
    if (!(m[1] in process.env)) process.env[m[1]] = value;
  }
}
loadEnv('.env.local');
register('./appAliasHooks.mjs', import.meta.url);

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const formId = Number(args[0]);
const pairs = args
  .slice(1)
  .filter((a) => a.includes('='))
  .map((a) => a.split('=', 2));
if (!Number.isInteger(formId) || pairs.length === 0) {
  console.error('사용: node scripts/patchFormCourseCodes.mjs <formId> key=code ... [--apply]');
  process.exit(1);
}

const { getFormById, updateFormSchema } = await import('../lib/d1/forms.ts');
const { patchOption } = await import('../lib/forms/edit.ts');

const form = await getFormById(formId);
if (!form) throw new Error(`신청서 ${formId} 없음`);
let schema = JSON.parse(form.schema_json);
const subject = schema.sections.flatMap((s) => s.questions).find((q) => q.selectionOf === 'class');
if (!subject) throw new Error('과목 문항이 없습니다');

for (const [key, code] of pairs) {
  const o = subject.options.find((x) => x.key === key);
  if (!o) throw new Error(`선택지 ${key} 없음`);
  console.log(`${key}: ${o.courseCode ?? '(없음)'} → ${code}   [${o.label.ko.trim()}]`);
  schema = patchOption(schema, subject.key, key, { courseCode: code });
}

if (!apply) {
  console.log('\n--apply 를 붙이면 저장합니다(문안 버전이 하나 올라갑니다).');
  process.exit(0);
}
const v = await updateFormSchema(formId, schema, '성인반 학비 코드 연결(2026-09-16 학원 안내표)', null);
console.log(`저장 완료 — ${form.slug} 문안 v${form.schema_version} → v${v}`);
