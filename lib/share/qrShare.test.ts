/**
 * 공유·QR 로직 회귀 시험
 *
 *   node --test lib/share/qrShare.test.ts
 *
 * 여기 있는 분기는 **브라우저마다 갈리는 길**이라 개발자 화면에서는 한 갈래밖에
 * 볼 수 없다. 크롬에서 잘 되는 것을 확인해도 사파리에서 공유 시트를 닫았을 때
 * "복사하지 못했습니다"가 뜨는지는 알 수 없다. 그래서 눈이 아니라 시험으로 잠근다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  toShareUrl,
  qrDownloadFileName,
  shareLink,
  copyQrImage,
  type ShareOutcome,
} from './qrShare.ts';

/* ── 공유할 주소 만들기 ────────────────────────────────────────────────── */

test('상대 경로는 사이트 주소를 붙여 절대 주소가 된다', () => {
  assert.equal(
    toShareUrl('/classes/summer', 'https://ktdoc.org'),
    'https://ktdoc.org/classes/summer'
  );
});

test('한글 경로는 퍼센트 인코딩된다 — 스캐너가 읽는 것은 바이트다', () => {
  // '성인-고급무용반'을 그대로 QR에 넣으면 읽는 앱마다 결과가 갈린다.
  const url = toShareUrl('/classes/성인-고급무용반', 'https://ktdoc.org');
  assert.equal(url, 'https://ktdoc.org/classes/%EC%84%B1%EC%9D%B8-%EA%B3%A0%EA%B8%89%EB%AC%B4%EC%9A%A9%EB%B0%98');
  assert.ok(!/[^\x20-\x7E]/.test(url), 'QR에 들어가는 주소는 ASCII여야 한다');
});

test('이미 절대 주소면 그대로 둔다', () => {
  assert.equal(
    toShareUrl('https://other.example/a?b=1#c', 'https://ktdoc.org'),
    'https://other.example/a?b=1#c'
  );
});

test('쿼리와 해시는 잃지 않는다', () => {
  assert.equal(
    toShareUrl('/rsvp/12?ref=kakao#form', 'https://ktdoc.org'),
    'https://ktdoc.org/rsvp/12?ref=kakao#form'
  );
});

test('사이트 주소 끝의 빗금이 겹치지 않는다', () => {
  assert.equal(toShareUrl('/a', 'https://ktdoc.org/'), 'https://ktdoc.org/a');
});

test('경로를 안 주면 사이트 첫 화면', () => {
  assert.equal(toShareUrl(undefined, 'https://ktdoc.org'), 'https://ktdoc.org/');
  assert.equal(toShareUrl('', 'https://ktdoc.org'), 'https://ktdoc.org/');
});

test('망가진 주소는 예외 대신 사이트 첫 화면으로 — QR 자리가 비지 않게', () => {
  assert.equal(toShareUrl('http://[::bad', 'https://ktdoc.org'), 'https://ktdoc.org/');
});

/* ── 내려받을 파일 이름 ────────────────────────────────────────────────── */

test('제목이 파일 이름이 된다 — 공백은 붙임표로', () => {
  assert.equal(qrDownloadFileName('성인 고급무용반'), '성인-고급무용반-qr.png');
});

test('파일 이름에 못 쓰는 글자는 떨어낸다', () => {
  assert.equal(qrDownloadFileName('여름캠프 2026/기초: "가"*?'), '여름캠프-2026기초-가-qr.png');
});

test('제목이 없거나 글자가 다 떨어져 나가면 기본 이름', () => {
  assert.equal(qrDownloadFileName(undefined), 'qr.png');
  assert.equal(qrDownloadFileName('   '), 'qr.png');
  assert.equal(qrDownloadFileName('///'), 'qr.png');
});

test('아주 긴 제목은 자른다 — 붙임표로 끝나지 않게', () => {
  const name = qrDownloadFileName('가'.repeat(200));
  assert.ok(name.length <= 64, `너무 김: ${name.length}`);
  assert.ok(name.endsWith('-qr.png'));
  assert.ok(!name.includes('--'));
});

/* ── 공유 버튼 ─────────────────────────────────────────────────────────── */

test('공유 시트를 지원하면 그것을 쓴다', async () => {
  const calls: unknown[] = [];
  const outcome = await shareLink('https://ktdoc.org/a', '수업', {
    share: async (data) => {
      calls.push(data);
    },
  });
  assert.equal(outcome, 'shared' satisfies ShareOutcome);
  assert.deepEqual(calls, [{ title: '수업', url: 'https://ktdoc.org/a' }]);
});

test('공유 시트가 없으면 링크를 복사한다', async () => {
  let copied = '';
  const outcome = await shareLink('https://ktdoc.org/a', '수업', {
    writeText: async (text) => {
      copied = text;
    },
  });
  assert.equal(outcome, 'link-copied');
  assert.equal(copied, 'https://ktdoc.org/a');
});

test('사용자가 공유를 취소한 것은 실패가 아니다', async () => {
  // AbortError를 실패로 처리하면 취소할 때마다 빨간 문구가 뜬다.
  const abort = Object.assign(new Error('취소됨'), { name: 'AbortError' });
  const outcome = await shareLink('https://ktdoc.org/a', '수업', {
    share: async () => {
      throw abort;
    },
    writeText: async () => {
      throw new Error('취소했는데 복사로 넘어가면 안 된다');
    },
  });
  assert.equal(outcome, 'cancelled');
});

test('공유 시트가 취소가 아닌 이유로 죽으면 링크 복사로 넘어간다', async () => {
  let copied = '';
  const outcome = await shareLink('https://ktdoc.org/a', '수업', {
    share: async () => {
      throw new Error('NotAllowedError');
    },
    writeText: async (text) => {
      copied = text;
    },
  });
  assert.equal(outcome, 'link-copied');
  assert.equal(copied, 'https://ktdoc.org/a');
});

test('공유도 복사도 못 하면 실패로 알린다', async () => {
  const outcome = await shareLink('https://ktdoc.org/a', '수업', {});
  assert.equal(outcome, 'failed');
});

/* ── QR 복사 버튼 ──────────────────────────────────────────────────────── */

const fakeBlob = { type: 'image/png' } as unknown as Blob;

test('클립보드에 이미지를 넣을 수 있으면 넣는다', async () => {
  let written: unknown = null;
  const outcome = await copyQrImage(async () => fakeBlob, 'qr.png', {
    createItem: (blobPromise) => ({ blobPromise }) as unknown as ClipboardItem,
    write: async (items) => {
      written = items;
    },
  });
  assert.equal(outcome, 'qr-copied');
  assert.equal(Array.isArray(written) && written.length, 1);
});

test('사파리를 위해 blob이 아니라 blob 약속을 건넨다', async () => {
  // 사파리는 사용자 제스처가 끝난 뒤의 write()를 거부한다. ClipboardItem에
  // Promise를 넣어야 제스처 안에서 write가 시작된 것으로 인정된다.
  let handed: unknown = null;
  await copyQrImage(async () => fakeBlob, 'qr.png', {
    createItem: (blobPromise) => {
      handed = blobPromise;
      return {} as ClipboardItem;
    },
    write: async () => {},
  });
  assert.ok(handed instanceof Promise, 'ClipboardItem에 Promise를 넘겨야 한다');
});

test('클립보드 이미지가 안 되면 파일로 내려받는다', async () => {
  const saved: { blob: Blob; name: string }[] = [];
  const outcome = await copyQrImage(async () => fakeBlob, '수업-qr.png', {
    download: (blob, name) => saved.push({ blob, name }),
  });
  assert.equal(outcome, 'qr-downloaded');
  assert.deepEqual(saved, [{ blob: fakeBlob, name: '수업-qr.png' }]);
});

test('클립보드가 거부해도 내려받기로 넘어간다', async () => {
  const saved: string[] = [];
  const outcome = await copyQrImage(async () => fakeBlob, '수업-qr.png', {
    createItem: () => ({}) as ClipboardItem,
    write: async () => {
      throw new Error('NotAllowedError');
    },
    download: (_blob, name) => saved.push(name),
  });
  assert.equal(outcome, 'qr-downloaded');
  assert.deepEqual(saved, ['수업-qr.png']);
});

test('QR 그림 자체를 못 만들면 실패 — 빈 파일을 내려주지 않는다', async () => {
  const saved: string[] = [];
  const outcome = await copyQrImage(async () => null, '수업-qr.png', {
    createItem: () => ({}) as ClipboardItem,
    write: async () => {},
    download: (_blob, name) => saved.push(name),
  });
  assert.equal(outcome, 'failed');
  assert.deepEqual(saved, []);
});
