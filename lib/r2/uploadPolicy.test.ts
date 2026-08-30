/**
 * lib/r2/uploadPolicy.test.ts — "모르는 곳에는 서명하지 않는다"를 잠근다
 *
 * 이 등록소는 버킷 쓰기 허가를 내주는 자리다. 주소 판정이 헐거우면
 * 등록되지 않은 경로가 통과하고, 폴더 판정이 헐거우면 남의 폴더에 쓴다.
 *
 * 여기서 검사하는 것은 "어떤 주소가 어떤 규칙에 걸리는가"다. 권한 판정은
 * lib/r2/uploadTargets.ts가 각 라우트의 함수를 그대로 붙여 쓰므로 두 벌이 아니고,
 * 세션을 만지는 그 파일은 여기서 부르지 않는다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findUploadPolicy } from './uploadPolicy.ts';

test('등록된 주소는 제 폴더를 찾는다', () => {
  assert.equal(findUploadPolicy('/api/admin/gallery/photos')?.folder, 'gallery/photos');
  assert.equal(findUploadPolicy('/api/library/photos')?.folder, 'gallery/submissions');
  assert.equal(findUploadPolicy('/api/admin/news/upload')?.folder, 'news');
});

test('경로의 id가 폴더에 반영된다', () => {
  assert.equal(findUploadPolicy('/api/admin/gallery/events/42/images')?.folder, 'gallery/42');
  assert.equal(findUploadPolicy('/api/admin/programs/7/images')?.folder, 'programs/7');
});

test('등록되지 않은 주소에는 서명하지 않는다', () => {
  for (const path of [
    '/api/admin/gallery/photos/../../etc',
    '/api/admin/gallery/events/abc/images',
    '/api/admin/members',
    '/api/uploads/sign',
    'https://evil.example.com/api/upload',
    '',
    '//api/upload',
  ]) {
    assert.equal(findUploadPolicy(path), null, `열리면 안 되는 주소: ${path}`);
  }
});

test('쿼리·끝 슬래시는 같은 주소로 본다 — 그것으로 규칙을 피할 수 없다', () => {
  assert.equal(findUploadPolicy('/api/upload?x=1')?.key, 'general');
  assert.equal(findUploadPolicy('/api/upload/')?.key, 'general');
  assert.equal(findUploadPolicy('/api/upload#a')?.key, 'general');
});

test('사진 보관함은 원본을 남기고, 화면용 이미지는 남기지 않는다', () => {
  assert.equal(findUploadPolicy('/api/admin/gallery/photos')?.keepOriginal, true);
  assert.equal(findUploadPolicy('/api/library/photos')?.keepOriginal, true);
  assert.equal(findUploadPolicy('/api/admin/news/upload')?.keepOriginal, false);
  assert.equal(findUploadPolicy('/api/admin/profile/photo')?.keepOriginal, false);
});

test('메일 첨부만 이미지가 아니어도 되고, 손대지 않는다', () => {
  const mail = findUploadPolicy('/api/admin/forms/2/responses/121/messages');
  assert.equal(mail?.imagesOnly, false);
  assert.equal(mail?.processImage, false);
  // 사진 쪽은 반대 — 이미지만 받고 정규화한다
  const photos = findUploadPolicy('/api/admin/gallery/photos');
  assert.equal(photos?.imagesOnly, true);
  assert.equal(photos?.processImage, true);
});
