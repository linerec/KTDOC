/**
 * 업로드 정규화 규칙의 계약 테스트.
 * 픽스처 파일 대신 sharp로 입력을 합성한다 — 규칙이 픽셀 크기·포맷에만 의존하므로 충분하다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { processForUpload } from './processForUpload.ts';

async function makeJpeg(w: number, h: number, withExif = false): Promise<Buffer> {
  let img = sharp({ create: { width: w, height: h, channels: 3, background: { r: 120, g: 80, b: 40 } } }).jpeg({ quality: 90 });
  if (withExif) img = img.withMetadata({ exif: { IFD0: { Copyright: 'gps-stand-in' } } });
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
  const input = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#333333' } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const out = await processForUpload(input, 'rotated.jpg');
  const meta = await sharp(out.buffer).metadata();
  // orientation 6 = 90° 회전 → 실표시 2000×3000 → 장변 2000으로 축소 → 1333×2000
  assert.equal(meta.height, 2000);
  assert.ok((meta.width ?? 0) < 2000);
});

test('작은 PNG는 원본 그대로 통과한다', async () => {
  const input = await sharp({ create: { width: 800, height: 600, channels: 4, background: '#ffffff00' } }).png().toBuffer();
  const out = await processForUpload(input, 'shot.png');
  assert.equal(out.processed, false);
  assert.equal(out.buffer, input);
  assert.equal(out.filename, 'shot.png');
  assert.equal(out.contentType, 'image/png');
});

test('큰 PNG는 PNG를 유지한 채 축소된다', async () => {
  const input = await sharp({ create: { width: 2600, height: 1300, channels: 4, background: '#ffffff' } }).png().toBuffer();
  const out = await processForUpload(input, 'big.png');
  assert.equal(out.processed, true);
  const meta = await sharp(out.buffer).metadata();
  assert.equal(meta.format, 'png');
  assert.equal(meta.width, 2000);
});

test('무거운 PNG(>500KB)는 사진으로 보고 WebP로 재인코딩된다', async () => {
  // 노이즈는 PNG로 압축이 안 돼 500KB를 확실히 넘긴다 (xorshift32 — 결정적 백색 잡음)
  const noise = Buffer.alloc(900 * 700 * 3);
  let s = 123456789;
  for (let i = 0; i < noise.length; i++) {
    s ^= s << 13; s |= 0;
    s ^= s >>> 17;
    s ^= s << 5; s |= 0;
    noise[i] = s & 255;
  }
  const input = await sharp(noise, { raw: { width: 900, height: 700, channels: 3 } }).png().toBuffer();
  assert.ok(input.length > 500 * 1024, `테스트 입력이 500KB를 넘어야 한다(실제 ${input.length})`);
  const out = await processForUpload(input, 'phone-photo.png');
  assert.equal(out.processed, true);
  assert.equal(out.contentType, 'image/webp');
  assert.equal(out.filename, 'phone-photo.webp');
  const meta = await sharp(out.buffer).metadata();
  assert.equal(meta.format, 'webp');
  assert.equal(meta.width, 900);
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
