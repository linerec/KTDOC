#!/usr/bin/env node
/**
 * 원격 D1 읽기 전용 조회 (진단용, 임시)
 * 사용: node scripts/d1Query.mjs "SELECT ..."
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
function loadEnv(file) {
  let text;
  try { text = readFileSync(join(root, file), 'utf8'); } catch { return; }
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    const value = m[2].trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnv('.env.local');
const A = process.env.CLOUDFLARE_ACCOUNT_ID, T = process.env.CLOUDFLARE_API_TOKEN, D = process.env.D1_DATABASE_ID;
const sql = process.argv[2];
if (!sql) { console.error('사용: node scripts/d1Query.mjs "SELECT ..."'); process.exit(1); }
if (!/^\s*(select|pragma|with)\b/i.test(sql)) { console.error('읽기 전용: SELECT/PRAGMA/WITH만 허용'); process.exit(1); }
const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${A}/d1/database/${D}/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ sql }),
});
const body = await res.json();
if (!body.success) { console.error(JSON.stringify(body.errors, null, 2)); process.exit(1); }
console.log(JSON.stringify(body.result[0].results, null, 2));
