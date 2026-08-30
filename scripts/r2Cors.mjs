#!/usr/bin/env node
/**
 * R2 버킷 CORS 설정 — 브라우저가 R2로 직접 올릴 수 있게 한다.
 *
 * 사진은 이제 우리 서버를 지나지 않고 브라우저에서 R2로 곧장 간다
 * (Vercel 함수의 요청 본문 4.5MB 한도를 피하는 유일한 방법이다).
 * 그러려면 버킷이 "이 사이트에서 오는 PUT은 받는다"고 선언해야 한다 —
 * 이 설정이 없으면 브라우저가 요청을 보내기도 전에 막는다(CORS 오류).
 *
 * 허용 출처를 좁게 유지하는 이유: 서명된 주소가 유출돼도 아무 사이트나
 * 그 주소로 파일을 밀어 넣지 못하게 한다(서명 자체가 1차 방어, 이건 2차).
 *
 * S3 API가 아니라 Cloudflare REST API를 쓴다 — R2 S3 키는 객체 읽기·쓰기
 * 범위라 버킷 설정(CORS)에는 손대지 못한다(AccessDenied). 버킷 설정은
 * 계정 토큰(CLOUDFLARE_API_TOKEN)의 일이다.
 *
 * 사용: node scripts/r2Cors.mjs          (현재 설정 보기)
 *       node scripts/r2Cors.mjs --apply  (설정 적용)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const line of readFileSync(join(root, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) {
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const BUCKET = process.env.R2_BUCKET_NAME;

if (!ACCOUNT || !TOKEN || !BUCKET) {
  console.error('CLOUDFLARE_ACCOUNT_ID·CLOUDFLARE_API_TOKEN·R2_BUCKET_NAME 이 필요합니다.');
  process.exit(1);
}

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/cors`;

/**
 * 허용 출처.
 * - 운영 도메인
 * - Vercel 프리뷰(배포마다 주소가 바뀌므로 와일드카드 한 칸)
 * - 로컬 개발 서버
 */
const RULES = [
  {
    allowed: {
      origins: [
        'https://ktdoc.org',
        'https://www.ktdoc.org',
        'https://*.vercel.app',
        'http://localhost:3000',
        'http://localhost:3001',
      ],
      // PUT: 업로드. GET/HEAD: 올라간 파일 확인·표시.
      methods: ['PUT', 'GET', 'HEAD'],
      // 서명에 Content-Type이 묶여 있어 브라우저가 그 헤더를 함께 보낸다
      headers: ['content-type'],
    },
    exposeHeaders: ['ETag'],
    maxAgeSeconds: 3600,
  },
];

async function call(method, body) {
  const res = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function show() {
  const json = await call('GET');
  if (!json.success) {
    const code = json.errors?.[0]?.code;
    if (code === 10059) {
      console.log(`현재 CORS (${BUCKET}): 없음 — 브라우저 직접 업로드가 막힙니다.`);
      return;
    }
    console.error('조회 실패:', JSON.stringify(json.errors));
    process.exit(1);
  }
  console.log(`현재 CORS (${BUCKET}):`);
  console.log(JSON.stringify(json.result?.rules ?? json.result, null, 2));
}

if (process.argv.includes('--apply')) {
  const json = await call('PUT', { rules: RULES });
  if (!json.success) {
    console.error('적용 실패:', JSON.stringify(json.errors));
    process.exit(1);
  }
  console.log(`적용 완료 (${BUCKET}).`);
  await show();
} else {
  await show();
  console.log('\n적용하려면: node scripts/r2Cors.mjs --apply');
}
