#!/usr/bin/env node
/**
 * 샘플 이벤트 정리기
 *
 * seedSampleEvents.mjs가 넣은 샘플(slug가 'sample-'로 시작)을 원격 D1에서
 * 한 번에 삭제한다. 연결 데이터도 함께 정리:
 *   - gallery_photos: 샘플 이벤트에 연결된 보관함 사진은 연결만 해제(사진 보존)
 *   - event_checkins / event_images / event_videos: 삭제
 *   - 샘플에 이미지가 업로드돼 있었다면 R2 객체는 남는다 — 키 목록을 출력하니 수동 정리
 *
 * 사용: npm run cleanup:sample-events
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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

async function d1(sql, params = []) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) {
    throw new Error(body?.errors?.[0]?.message || `D1 API error (${res.status})`);
  }
  return body.result[0];
}

const SAMPLE_WHERE = "slug LIKE 'sample-%'";
const SAMPLE_IDS = `SELECT id FROM events WHERE ${SAMPLE_WHERE}`;

const targets = (await d1(
  `SELECT id, slug, event_date, title_ko FROM events WHERE ${SAMPLE_WHERE} ORDER BY event_date`
)).results;

if (targets.length === 0) {
  console.log('삭제할 샘플 이벤트가 없습니다. (slug \'sample-%\' 0건)');
  process.exit(0);
}

console.log(`대상: 원격 D1 — 샘플 이벤트 ${targets.length}건\n`);
for (const t of targets) {
  console.log(`  · #${t.id}  ${t.event_date}  ${t.title_ko} (${t.slug})`);
}

// 샘플에 업로드된 이미지가 있으면 R2 객체는 여기서 못 지운다 — 키를 알려준다.
const orphanKeys = (await d1(
  `SELECT r2_key FROM event_images WHERE event_id IN (${SAMPLE_IDS})`
)).results;
if (orphanKeys.length > 0) {
  console.warn(`\n⚠ 샘플 이벤트에 이미지 ${orphanKeys.length}장이 있습니다. DB 기록은 삭제되지만 R2 객체는 남습니다:`);
  for (const k of orphanKeys) console.warn(`  · ${k.r2_key}`);
}

// 보관함 사진은 보존하고 연결만 해제
const unlink = await d1(
  `UPDATE gallery_photos SET event_id = NULL, event_image_id = NULL, updated_at = datetime('now')
   WHERE event_id IN (${SAMPLE_IDS})`
);
if (unlink.meta.changes > 0) {
  console.log(`\n보관함 사진 ${unlink.meta.changes}장의 이벤트 연결을 해제했습니다(사진은 보존).`);
}

// 체크인 → 이미지 → 영상 → 이벤트 순으로 삭제
try {
  const r = await d1(`DELETE FROM event_checkins WHERE event_id IN (${SAMPLE_IDS})`);
  if (r.meta.changes > 0) console.log(`체크인 기록 ${r.meta.changes}건 삭제.`);
} catch (e) {
  if (!/no such table/i.test(String(e.message))) throw e;
}
await d1(`DELETE FROM event_images WHERE event_id IN (${SAMPLE_IDS})`);
await d1(`DELETE FROM event_videos WHERE event_id IN (${SAMPLE_IDS})`);
const del = await d1(`DELETE FROM events WHERE ${SAMPLE_WHERE}`);

console.log(`\n완료: 샘플 이벤트 ${del.meta.changes}건 삭제.`);
