#!/usr/bin/env node
/**
 * 기존 R2 이미지 일괄 정규화 마이그레이션 (일회성, 멱등)
 *
 * 업로드 관문 정규화(lib/images/processForUpload.ts) 도입 이전에 올라간 원본들을
 * 같은 규칙(JPEG→WebP q80·장변 2000·EXIF 제거 / 큰 PNG·WebP 축소 / GIF·SVG 통과)으로
 * 재처리해 "새 키"로 올리고 DB URL을 갱신한다. 기존 객체는 덮어쓰지 않고 남긴다
 * (immutable 캐시와의 충돌 방지 + 롤백 여지). 임계값은 processForUpload.ts와
 * 동기화할 것 — .mjs 단독 실행이라 규칙을 여기 복제해 둔다.
 *
 * 대상: D1 images / gallery_photos / event_images / program_images / supply_items
 *       + MySQL users.profile_photo_url
 *
 * 사용: node scripts/migrateR2Images.mjs           # dry-run (변경 없음)
 *       node scripts/migrateR2Images.mjs --apply   # 실제 실행
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import mysql from 'mysql2/promise';

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

const {
  CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, D1_DATABASE_ID,
  R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL,
  DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME,
} = process.env;

for (const [k, v] of Object.entries({ CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, D1_DATABASE_ID, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL })) {
  if (!v) { console.error(`환경변수 누락: ${k}`); process.exit(1); }
}

const APPLY = process.argv.includes('--apply');

// ── 처리 규칙 (lib/images/processForUpload.ts와 동기화) ────────────────────
const MAX_LONG_EDGE = 2000;
const WEBP_QUALITY = 80;
const HEAVY_PNG_BYTES = 500 * 1024;
/** 이미 이 스크립트가 만든 키 — 재실행 시 스킵(멱등) */
const MIGRATED_KEY_RE = /-w2000\.(webp|png)$/;

const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

async function d1(sql, params = []) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    }
  );
  const data = await res.json();
  if (!data.success) throw new Error(`D1 query 실패: ${JSON.stringify(data.errors)}`);
  return data.result[0].results;
}

function keyFromUrl(url) {
  if (!url || !url.startsWith(`${R2_PUBLIC_URL}/`)) return null;
  return url.slice(R2_PUBLIC_URL.length + 1);
}

/** 규칙 판정 + 처리. 처리 불필요/불가면 null 반환 */
async function processBuffer(buffer, key) {
  const ext = key.toLowerCase().split('.').pop() ?? '';
  if (ext === 'svg' || ext === 'gif') return { skip: 'svg/gif' };

  let meta;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    return { skip: '디코드 불가' };
  }

  const sideways = (meta.orientation ?? 1) >= 5;
  const w = (sideways ? meta.height : meta.width) ?? 0;
  const h = (sideways ? meta.width : meta.height) ?? 0;
  const needsResize = Math.max(w, h) > MAX_LONG_EDGE;

  const resized = (img) =>
    needsResize ? img.resize({ width: MAX_LONG_EDGE, height: MAX_LONG_EDGE, fit: 'inside', withoutEnlargement: true }) : img;

  const heavyPng = meta.format === 'png' && buffer.length > HEAVY_PNG_BYTES;
  // failOn:'none' — 잘린 JPEG 등 부분 손상 파일도 가능한 만큼 살려서 변환한다
  const tolerant = () => sharp(buffer, { failOn: 'none' });

  try {
    if (meta.format === 'jpeg' || meta.format === 'heif' || heavyPng) {
      const out = await resized(tolerant().rotate()).webp({ quality: WEBP_QUALITY }).toBuffer({ resolveWithObject: true });
      return { data: out.data, info: out.info, ext: 'webp', contentType: 'image/webp' };
    }
    if ((meta.format === 'png' || meta.format === 'webp') && needsResize) {
      const img = resized(tolerant().rotate());
      const out = meta.format === 'png'
        ? await img.png().toBuffer({ resolveWithObject: true })
        : await img.webp({ quality: WEBP_QUALITY }).toBuffer({ resolveWithObject: true });
      // 축소 결과가 오히려 크면(이미 고압축) 이득이 없다 — 원본 유지
      if (out.data.length >= buffer.length) return { skip: `재인코딩 이득 없음(${meta.format} ${w}×${h})` };
      return { data: out.data, info: out.info, ext: meta.format, contentType: `image/${meta.format}` };
    }
  } catch (err) {
    // HEVC 코덱 없는 HEIC(.jpg로 위장한 폰 원본 포함) — 지금도 브라우저가 못 그리는
    // 깨진 사진이므로 행을 건드리지 않고 보고만 한다(재업로드 대상 목록).
    return { skip: `변환 불가(${meta.format}) — 재업로드 필요: ${err.message.split('\n')[0]}` };
  }
  return { skip: `이미 작음(${meta.format} ${w}×${h})` };
}

const fmtKB = (n) => `${Math.round(n / 1024)}KB`;
let processedCount = 0, skippedCount = 0, failedCount = 0, bytesBefore = 0, bytesAfter = 0;

/**
 * 한 행 처리. update(newUrl, newKey, info, size)는 DB 갱신 콜백.
 */
async function migrateOne(label, url, applyUpdate) {
  const key = keyFromUrl(url);
  if (!key) { skippedCount++; console.log(`  - ${label}: R2 외부 URL 스킵 (${url ?? '(없음)'})`); return; }
  if (MIGRATED_KEY_RE.test(key)) { skippedCount++; console.log(`  - ${label}: 이미 정규화됨 스킵`); return; }

  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    const buffer = Buffer.from(await obj.Body.transformToByteArray());
    const result = await processBuffer(buffer, key);
    if (result.skip) { skippedCount++; console.log(`  - ${label}: 스킵 — ${result.skip}, ${fmtKB(buffer.length)}`); return; }

    const slash = key.lastIndexOf('/');
    const folder = slash >= 0 ? key.slice(0, slash) : 'images';
    const base = (slash >= 0 ? key.slice(slash + 1) : key).replace(/\.[^.]+$/, '');
    const unique = Math.random().toString(36).slice(2, 8);
    const newKey = `${folder}/${Date.now()}-${unique}-${base}-w2000.${result.ext}`;
    const newUrl = `${R2_PUBLIC_URL}/${newKey}`;

    console.log(`  * ${label}: ${fmtKB(buffer.length)} → ${fmtKB(result.data.length)} (${result.info.width}×${result.info.height} ${result.ext})${APPLY ? '' : ' [dry-run]'}`);
    bytesBefore += buffer.length;
    bytesAfter += result.data.length;

    if (APPLY) {
      await s3.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: newKey,
        Body: result.data,
        ContentType: result.contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }));
      await applyUpdate(newUrl, newKey, result.info, result.data.length, result.contentType);
    }
    processedCount++;
  } catch (err) {
    failedCount++;
    console.error(`  ! ${label}: 실패 — ${err.message}`);
  }
}

// ── D1 테이블별 실행 ──────────────────────────────────────────────────────
async function run() {
  console.log(`모드: ${APPLY ? 'APPLY(실제 반영)' : 'dry-run(변경 없음)'}\n`);

  console.log('[D1 images]');
  for (const row of await d1('SELECT id, url FROM images')) {
    await migrateOne(`images#${row.id}`, row.url, (url, key, info, size, ct) =>
      d1('UPDATE images SET url=?, r2_key=?, width=?, height=?, size=?, content_type=?, updated_at=datetime("now") WHERE id=?',
        [url, key, info.width, info.height, size, ct, row.id]));
  }

  console.log('[D1 gallery_photos]');
  for (const row of await d1('SELECT id, image_url FROM gallery_photos')) {
    await migrateOne(`gallery_photos#${row.id}`, row.image_url, (url, key, info, size) =>
      d1('UPDATE gallery_photos SET image_url=?, r2_key=?, width=?, height=?, size=?, updated_at=datetime("now") WHERE id=?',
        [url, key, info.width, info.height, size, row.id]));
  }

  console.log('[D1 event_images]');
  for (const row of await d1('SELECT id, image_url FROM event_images')) {
    await migrateOne(`event_images#${row.id}`, row.image_url, (url, key, info, size) =>
      d1('UPDATE event_images SET image_url=?, r2_key=?, width=?, height=?, size=? WHERE id=?',
        [url, key, info.width, info.height, size, row.id]));
  }

  console.log('[D1 program_images]');
  for (const row of await d1('SELECT id, image_url FROM program_images')) {
    await migrateOne(`program_images#${row.id}`, row.image_url, (url, key, info, size) =>
      d1('UPDATE program_images SET image_url=?, r2_key=?, width=?, height=?, size=? WHERE id=?',
        [url, key, info.width, info.height, size, row.id]));
  }

  console.log('[D1 supply_items]');
  for (const row of await d1('SELECT id, image_url FROM supply_items WHERE image_url IS NOT NULL AND image_url != ""')) {
    await migrateOne(`supply_items#${row.id}`, row.image_url, (url, key) =>
      d1('UPDATE supply_items SET image_url=?, image_r2_key=?, updated_at=datetime("now") WHERE id=?', [url, key, row.id]));
  }

  console.log('[MySQL users.profile_photo_url]');
  if (DB_HOST && DB_USER && DB_NAME) {
    const conn = await mysql.createConnection({
      host: DB_HOST, port: Number(DB_PORT ?? 3306), user: DB_USER, password: DB_PASSWORD, database: DB_NAME,
    });
    try {
      const [rows] = await conn.execute('SELECT id, profile_photo_url FROM users WHERE profile_photo_url IS NOT NULL AND profile_photo_url != ""');
      for (const row of rows) {
        await migrateOne(`users#${row.id}`, row.profile_photo_url, (url) =>
          conn.execute('UPDATE users SET profile_photo_url=? WHERE id=?', [url, row.id]));
      }
    } finally {
      await conn.end();
    }
  } else {
    console.log('  - MySQL 설정 없음, 건너뜀');
  }

  console.log(`\n요약: 처리 ${processedCount}건 · 스킵 ${skippedCount}건 · 실패 ${failedCount}건`);
  if (processedCount) console.log(`용량: ${fmtKB(bytesBefore)} → ${fmtKB(bytesAfter)} (${Math.round((1 - bytesAfter / bytesBefore) * 100)}% 절감)`);
  if (failedCount && APPLY) process.exit(1);
}

run().catch((err) => { console.error(err); process.exit(1); });
