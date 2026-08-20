# 업로드 시점 이미지 파이프라인(슬림판) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사진을 업로드 시점에 딱 한 번 리사이즈·재인코딩해 R2에 저장하고, 조회는 정적 파일 그대로 서빙한다 — Vercel 이미지 변환(과금·402) 의존을 영구히 제거.

**Architecture:** 서버 단일 관문 `uploadToR2()`(모든 업로드 라우트 8곳이 경유) 안에 sharp 처리를 삽입한다. 라우트 수정 0. 기존 R2 이미지 ~124건은 일회성 스크립트로 같은 규칙으로 재처리해 새 키에 올리고 DB URL을 갱신한다. 2026-08-19 사고로 `images.unoptimized: true`가 이미 적용돼 있어(main ee24355) Vercel 이미지 캐시 무효화 제약이 사라졌으므로, 7월 문서의 5단계 순서 제약은 더 이상 적용되지 않는다.

**Tech Stack:** sharp(신규 dependency), @aws-sdk/client-s3(기존), Cloudflare D1 REST(기존 패턴), mysql2(기존), node --test(기존 테스트 러너, `npm test`가 `lib/**/*.test.ts` 실행).

**Spec:** 이 계획 자체가 스펙을 겸한다(대화에서 합의된 슬림 설계). 배경 문서: `docs/operations/image-optimization-strategy.md`(2026-07-09 원판 — 본 계획이 규모 재조정판으로 대체하며, Task 5에서 그 문서에 대체 사실을 기록한다).

## Global Constraints

- 처리 규칙(업로드·마이그레이션 공통):
  - **JPEG(및 sharp가 디코드 가능한 HEIC)** → WebP q80, `.rotate()`(EXIF 방향 적용), 장변 ≤2000px(초과 시에만 축소, 확대 금지), 메타데이터(EXIF GPS 포함) 제거(sharp 기본).
  - **PNG** → 장변 >2000px이면 PNG 유지한 채 축소, 이하면 원본 그대로 통과(스크린샷 재인코딩 화질 저하 방지).
  - **WebP** → 장변 >2000px이면 WebP q80으로 축소, 이하면 통과.
  - **GIF/SVG/디코드 불가(코덱 없는 HEIC 등)** → 원본 그대로 통과(현재 동작과 동일, 회귀 없음).
- R2 업로드 객체에 `CacheControl: 'public, max-age=31536000, immutable'` — 키가 timestamp+난수로 유일하므로 immutable이 정확하다.
- 마이그레이션은 **기존 객체를 덮어쓰지 않는다**(새 키 업로드 + DB URL 갱신, 원본 객체는 남긴다). 같은 키 재사용 금지 — immutable 캐시와 충돌.
- 업로드 한도 4MB → **15MB**(`lib/uploadLimits.ts`): Vercel 함수 바디 한도가 100MB로 상향된 것을 전제(2026 플랫폼 변경). 주석의 4.5MB 근거 문구도 함께 갱신할 것.
- 커밋 메시지는 저장소 관례(한국어, `type(scope): 요약`) + Co-Authored-By/Claude-Session 푸터.
- 완료 게이트: `npm test` 전건 통과, `npm run build` 성공, 로컬 dev(원격 R2·D1 공유)에서 실업로드 1건 확인 후 main 반영.

---

### Task 1: 처리 모듈 `lib/images/processForUpload.ts` (TDD)

**Files:**
- Create: `lib/images/processForUpload.ts`
- Test: `lib/images/processForUpload.test.ts`
- Modify: `package.json` (dependencies에 `sharp` 추가)

**Interfaces:**
- Produces: `processForUpload(buffer: Buffer, filename: string): Promise<ProcessedUpload>`
  - `ProcessedUpload = { buffer: Buffer; filename: string; contentType: string; width: number | null; height: number | null; processed: boolean }`
  - `filename`은 재인코딩 시 확장자가 `.webp`로 바뀐다(그 외 원본 유지). `processed=false`면 buffer가 입력과 동일 참조.
- Consumes: 없음(신규 리프 모듈).

- [ ] **Step 1:** `npm install sharp` (worktree에서; package.json/package-lock.json 변경 확인)
- [ ] **Step 2:** 실패하는 테스트 작성 — sharp로 테스트 입력을 합성한다(픽스처 파일 불필요):

```ts
// lib/images/processForUpload.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { processForUpload } from './processForUpload';

async function makeJpeg(w: number, h: number, withExif = false) {
  let img = sharp({ create: { width: w, height: h, channels: 3, background: { r: 120, g: 80, b: 40 } } }).jpeg({ quality: 90 });
  if (withExif) img = img.withMetadata({ exif: { IFD0: { Copyright: 'gps-stand-in' }, GPS: { GPSLatitudeRef: 'N' } } });
  return img.toBuffer();
}

test('큰 JPEG은 장변 2000 WebP로 축소·재인코딩된다', async () => {
  const input = await makeJpeg(3000, 1500);
  const out = await processForUpload(input, 'photo.JPG');
  assert.equal(out.processed, true);
  assert.equal(out.contentType, 'image/webp');
  assert.equal(out.filename, 'photo.webp');
  const meta = await sharp(out.buffer).metadata();
  assert.equal(meta.format, 'webp');
  assert.equal(meta.width, 2000);
  assert.equal(meta.height, 1000);
  assert.equal(out.width, 2000);
  assert.equal(out.height, 1000);
});

test('작은 JPEG도 WebP 재인코딩된다(EXIF 제거 목적) — 크기는 유지', async () => {
  const input = await makeJpeg(800, 600, true);
  const out = await processForUpload(input, 'small.jpeg');
  assert.equal(out.processed, true);
  const meta = await sharp(out.buffer).metadata();
  assert.equal(meta.format, 'webp');
  assert.equal(meta.width, 800);
  assert.equal(meta.exif, undefined); // 메타데이터(EXIF·GPS) 소거
});

test('EXIF 방향(6)은 픽셀에 적용되어 가로세로가 뒤집힌다', async () => {
  const input = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#333' } })
    .jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const out = await processForUpload(input, 'rotated.jpg');
  const meta = await sharp(out.buffer).metadata();
  // orientation 6 = 90° 회전 → 3000×2000이 2000×3000이 되고 장변 2000으로 축소 → 1333×2000
  assert.equal(meta.height, 2000);
  assert.ok((meta.width ?? 0) < 2000);
});

test('작은 PNG는 원본 그대로 통과한다', async () => {
  const input = await sharp({ create: { width: 800, height: 600, channels: 4, background: '#fff0' } }).png().toBuffer();
  const out = await processForUpload(input, 'shot.png');
  assert.equal(out.processed, false);
  assert.equal(out.buffer, input);
  assert.equal(out.filename, 'shot.png');
  assert.equal(out.contentType, 'image/png');
});

test('큰 PNG는 PNG를 유지한 채 축소된다', async () => {
  const input = await sharp({ create: { width: 2600, height: 1300, channels: 4, background: '#fff' } }).png().toBuffer();
  const out = await processForUpload(input, 'big.png');
  assert.equal(out.processed, true);
  const meta = await sharp(out.buffer).metadata();
  assert.equal(meta.format, 'png');
  assert.equal(meta.width, 2000);
});

test('SVG·GIF·디코드 불가 파일은 그대로 통과한다', async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
  const outSvg = await processForUpload(svg, 'icon.svg');
  assert.equal(outSvg.processed, false);
  assert.equal(outSvg.contentType, 'image/svg+xml');

  const junk = Buffer.from('not-an-image');
  const outHeic = await processForUpload(junk, 'IMG_0001.heic');
  assert.equal(outHeic.processed, false);
  assert.equal(outHeic.buffer, junk);
});
```

- [ ] **Step 3:** `npm test` — 모듈 부재로 FAIL 확인
- [ ] **Step 4:** 최소 구현:

```ts
// lib/images/processForUpload.ts
import sharp from 'sharp';

/** 표시용 최대 장변. 사이트 최대 표시 폭(전폭 히어로) 기준 — 이보다 큰 원본은 화면에 이득이 없다. */
export const MAX_LONG_EDGE = 2000;
const WEBP_QUALITY = 80;

export interface ProcessedUpload {
  buffer: Buffer;
  filename: string;
  contentType: string;
  width: number | null;
  height: number | null;
  processed: boolean;
}

const EXT_CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
};

function extOf(filename: string): string {
  return filename.toLowerCase().split('.').pop() ?? '';
}

function passthrough(buffer: Buffer, filename: string): ProcessedUpload {
  return {
    buffer, filename,
    contentType: EXT_CONTENT_TYPES[extOf(filename)] ?? 'application/octet-stream',
    width: null, height: null, processed: false,
  };
}

/**
 * 업로드 직전 1회 정규화 — 이후로는 어떤 변환도 없이 그대로 서빙된다.
 * 규칙: JPEG/HEIC → WebP q80 + EXIF 제거 + 장변 ≤2000 / PNG·WebP → 초과 시에만 축소 /
 * GIF·SVG·디코드 불가 → 원본 통과. (docs/superpowers/plans/2026-08-20-upload-image-pipeline.md)
 */
export async function processForUpload(buffer: Buffer, filename: string): Promise<ProcessedUpload> {
  const ext = extOf(filename);
  if (ext === 'svg' || ext === 'gif') return passthrough(buffer, filename);

  let meta: sharp.Metadata;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    return passthrough(buffer, filename); // 코덱 없는 HEIC 등 — 현행 동작 유지
  }

  const format = meta.format;
  // EXIF 방향이 90°계(5~8)면 실표시 가로세로가 뒤집힌다
  const sideways = (meta.orientation ?? 1) >= 5;
  const w = (sideways ? meta.height : meta.width) ?? 0;
  const h = (sideways ? meta.width : meta.height) ?? 0;
  const longEdge = Math.max(w, h);
  const needsResize = longEdge > MAX_LONG_EDGE;

  const base = filename.replace(/\.[^.]+$/, '');
  const resized = (img: sharp.Sharp) =>
    needsResize ? img.resize({ width: MAX_LONG_EDGE, height: MAX_LONG_EDGE, fit: 'inside', withoutEnlargement: true }) : img;

  if (format === 'jpeg' || format === 'heif') {
    // .rotate() 인자 없음 = EXIF 방향을 픽셀에 굽고 태그 제거; 재인코딩이 메타데이터를 소거한다
    const out = await resized(sharp(buffer).rotate()).webp({ quality: WEBP_QUALITY }).toBuffer({ resolveWithObject: true });
    return { buffer: out.data, filename: `${base}.webp`, contentType: 'image/webp', width: out.info.width, height: out.info.height, processed: true };
  }

  if ((format === 'png' || format === 'webp') && needsResize) {
    const img = resized(sharp(buffer).rotate());
    const out = format === 'png'
      ? await img.png().toBuffer({ resolveWithObject: true })
      : await img.webp({ quality: WEBP_QUALITY }).toBuffer({ resolveWithObject: true });
    return { buffer: out.data, filename, contentType: `image/${format}`, width: out.info.width, height: out.info.height, processed: true };
  }

  return passthrough(buffer, filename);
}
```

- [ ] **Step 5:** `npm test` PASS 확인
- [ ] **Step 6:** 커밋 `feat(images): 업로드 정규화 모듈 — 1회 리사이즈·EXIF 제거`

### Task 2: `uploadToR2()`에 결선 + CacheControl

**Files:**
- Modify: `lib/r2/upload.ts`

**Interfaces:**
- Consumes: Task 1의 `processForUpload`
- Produces: `UploadResult`에 `width: number | null; height: number | null` 추가(기존 필드 유지 — 호출부 8곳 무수정 호환)

- [ ] **Step 1:** `uploadToR2` 수정 — Put 전에 `processForUpload` 호출, 처리 결과의 filename/contentType/buffer 사용, `CacheControl: 'public, max-age=31536000, immutable'` 추가, 반환에 width/height 포함. 기존 `getContentType`은 processForUpload의 contentType으로 대체된다(함수 제거).
- [ ] **Step 2:** `npm test` + `npx tsc --noEmit`로 회귀 확인
- [ ] **Step 3:** 커밋 `feat(r2): 업로드 관문에 정규화 결선 + 불변 캐시 헤더`

### Task 3: 업로드 한도 4MB → 15MB

**Files:**
- Modify: `lib/uploadLimits.ts` (상수 2개 + 주석의 4.5MB 근거를 100MB 상향 사실로 갱신)

- [ ] **Step 1:** `MAX_UPLOAD_FILE_BYTES = 15 * 1024 * 1024`, `MAX_UPLOAD_FILE_MB = 15`, 주석 갱신
- [ ] **Step 2:** `npm test` 통과 확인 후 커밋 `feat(upload): 한도 15MB — 폰 원본 사진 수용`

### Task 4: 기존 이미지 일괄 재처리 스크립트

**Files:**
- Create: `scripts/migrateR2Images.mjs`
- Modify: `package.json` (script `"images:migrate": "node scripts/migrateR2Images.mjs"`)

**Interfaces:**
- Consumes: `.env.local`의 R2_*·CLOUDFLARE_*·D1_DATABASE_ID·DB_* 환경변수, sharp, @aws-sdk/client-s3, mysql2
- 처리 규칙은 Task 1과 동일하게 유지하되 .mjs 단독 실행이므로 규칙을 스크립트에 복제하지 말고 **동일 임계값 상수(장변 2000, q80)를 쓰는 자체 함수**로 구현하고 주석으로 `lib/images/processForUpload.ts`와 동기화 의무를 명시

**대상(2026-08-20 실측):** D1 `images`(url·r2_key·width·height·size, 7행) / `gallery_photos`(image_url·r2_key·…, 19행) / `event_images`(38행) / `program_images`(26행) / `supply_items`(image_url·image_r2_key, 34행) + MySQL `users.profile_photo_url`. R2_PUBLIC_URL 호스트가 아닌 URL·SVG·GIF는 건너뛴다.

- [ ] **Step 1:** 스크립트 작성 — 동작: 행 조회 → R2 GetObject → 규칙 판정 → (해당 시) sharp 처리 → 새 키 `same-folder/<ts>-<rand>-<base>-w2000.webp` PutObject(CacheControl 포함) → DB UPDATE(url·key·width·height·size 존재 컬럼만). 기본 dry-run(표 출력: 테이블·id·현재 크기→예상 처리), `--apply`시 실행. 이미 `-w2000.webp` 키는 스킵(멱등).
- [ ] **Step 2:** `npm run images:migrate` (dry-run) — 대상 목록·용량 확인
- [ ] **Step 3:** `npm run images:migrate -- --apply` — 실행 후 요약(처리 n건·스킵 n건·실패 0건) 확인
- [ ] **Step 4:** 공개 페이지에서 표본 검증(단장 사진 URL이 새 webp로 바뀌고 200 + 용량 감소)
- [ ] **Step 5:** 커밋 `feat(scripts): 기존 R2 이미지 일괄 정규화 마이그레이션`

### Task 5: 문서·검증·배포

**Files:**
- Modify: `docs/operations/image-optimization-strategy.md` (상단에 2026-08-20 규모 재조정 단락: 5단계 원판을 슬림판이 대체, unoptimized 영구 유지, 커스텀 도메인은 선택 과제)
- 본 계획 파일 커밋 포함

- [ ] **Step 1:** 문서 갱신 + 커밋 `docs(images): 슬림 파이프라인으로 전략 대체 기록`
- [ ] **Step 2:** `npm run build` 성공 확인
- [ ] **Step 3:** 로컬 dev(원격 R2·D1 공유)에서 실업로드 E2E 1건 — 관리 콘솔로 JPEG 업로드 → 응답 URL이 `.webp`인지, R2 객체에 Cache-Control이 실렸는지 curl 확인 → 테스트 업로드 삭제
- [ ] **Step 4:** 브랜치 push → main fast-forward → Vercel 배포 후 공개 페이지 표본 확인
- [ ] **Step 5:** 메모리(`ktdoc-image-pipeline-strategy`) 갱신
