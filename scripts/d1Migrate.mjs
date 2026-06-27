#!/usr/bin/env node
/**
 * Cloudflare D1 원격 마이그레이션 러너 (REST API)
 *
 * D1은 원격 REST API로만 접근하므로(로컬 DB 없음), 마이그레이션 .sql을
 * 앱과 동일한 자격증명(CLOUDFLARE_ACCOUNT_ID·CLOUDFLARE_API_TOKEN·D1_DATABASE_ID)으로
 * 한 문장씩 실행한다.
 *
 * - 멱등: ALTER ... ADD COLUMN 이 "duplicate column name"이면 이미 적용된 것으로 보고 통과.
 *   CREATE INDEX/TABLE 은 IF NOT EXISTS 로 작성돼 있어 안전하다.
 * - 대상은 항상 "원격" D1 한 곳뿐이다.
 *
 * 사용: node scripts/d1Migrate.mjs migrations/0009_gallery_photo_uploader.sql
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

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
  console.error('D1 설정 누락: CLOUDFLARE_ACCOUNT_ID·CLOUDFLARE_API_TOKEN·D1_DATABASE_ID 확인.');
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error('사용: node scripts/d1Migrate.mjs <migration.sql>');
  process.exit(1);
}

const sqlText = readFileSync(resolve(root, file), 'utf8');

// -- 주석 제거 후 세미콜론으로 문장 분리(이 프로젝트 마이그레이션엔 문자열 내 ';'·'--' 없음).
const statements = sqlText
  .split('\n')
  .map((l) => l.replace(/--.*$/, ''))
  .join('\n')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

async function exec(sql) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql }),
    }
  );
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok && body.success, body };
}

console.log(`대상: 원격 D1 (${file}) — 문장 ${statements.length}개\n`);

for (const [i, stmt] of statements.entries()) {
  const label = `[${i + 1}/${statements.length}] ${stmt.replace(/\s+/g, ' ').slice(0, 70)}...`;
  const { ok, body } = await exec(stmt);
  if (ok) {
    console.log(`OK   ${label}`);
    continue;
  }
  const msg = body?.errors?.[0]?.message || JSON.stringify(body);
  // ALTER ADD COLUMN 재실행 시 발생 — 이미 적용된 상태로 간주.
  if (/duplicate column name/i.test(msg)) {
    console.log(`SKIP ${label}  (이미 적용됨: ${msg})`);
    continue;
  }
  console.error(`FAIL ${label}\n     ${msg}`);
  process.exit(1);
}

console.log('\n완료. 원격 D1 마이그레이션이 적용되었습니다.');
