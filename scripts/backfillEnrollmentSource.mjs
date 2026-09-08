/**
 * program_enrollments.source_response_id 백필 (1회성, 0044 직후)
 *
 * 0044 이전에는 신청서에서 만든 배정이 note 에 '신청서 접수 #173' 문자열로만
 * 출처를 남겼다. 그 숫자를 컬럼으로 옮긴다. note 에 그 패턴이 없는 행(수업 화면에서
 * 직접 넣은 배정)은 NULL 그대로 둔다 — 그것이 "신청서 쪽 사건이 건드리지 않는다"의 근거다.
 *
 *   node scripts/backfillEnrollmentSource.mjs           # 미리 보기
 *   node scripts/backfillEnrollmentSource.mjs --apply   # 실제 갱신
 */
import { readFileSync } from 'node:fs';

function loadEnv(file) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
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
const A = process.env.CLOUDFLARE_ACCOUNT_ID;
const T = process.env.CLOUDFLARE_API_TOKEN;
const D = process.env.D1_DATABASE_ID;

async function run(sql, params = []) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${A}/d1/database/${D}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  });
  const body = await res.json();
  if (!body.success) throw new Error(JSON.stringify(body.errors));
  return body.result[0].results;
}

const apply = process.argv.includes('--apply');
const rows = await run(
  "SELECT id, note FROM program_enrollments WHERE source_response_id IS NULL AND note LIKE '신청서 접수 #%'"
);
const updates = rows
  .map((r) => ({ id: r.id, rid: Number((r.note.match(/#(\d+)/) ?? [])[1]) }))
  .filter((u) => Number.isInteger(u.rid));

console.log(`대상 ${updates.length}건`, updates);
if (!apply) {
  console.log('--apply 를 붙이면 갱신합니다.');
  process.exit(0);
}
for (const u of updates) {
  await run('UPDATE program_enrollments SET source_response_id = ? WHERE id = ?', [u.rid, u.id]);
}
console.log('완료');
