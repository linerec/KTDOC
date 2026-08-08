/**
 * 기기 라벨 파서 시험
 *
 *   node --test lib/push/deviceLabel.test.ts
 *
 * 여기 있는 user-agent는 전부 실제 기기가 보내는 문자열이다. 브라우저 UA는
 * 서로를 흉내 낸다(크롬도 "Safari"를 달고 다니고, 엣지는 "Chrome"을 단다).
 * 판별 순서가 조용히 뒤집히면 "안드로이드 · Safari" 같은 라벨이 나오므로
 * 시험으로 고정한다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { describeDevice, deviceKind } from './deviceLabel.ts';

/* ── 모바일 ────────────────────────────────────────────────────────────── */

test('iPhone Safari — 원생 대부분이 쓰는 조합', () => {
  const ua =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1';
  assert.deepEqual(describeDevice(ua), {
    device: 'iPhone',
    browser: 'Safari',
    label: 'iPhone · Safari',
  });
  assert.equal(deviceKind(ua), 'iphone');
});

test('iPad는 iPhone과 구분한다', () => {
  const ua =
    'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  assert.equal(describeDevice(ua).device, 'iPad');
  assert.equal(deviceKind(ua), 'ipad');
});

test('안드로이드 폰 크롬', () => {
  const ua =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
  assert.deepEqual(describeDevice(ua), {
    device: '안드로이드 폰',
    browser: 'Chrome',
    label: '안드로이드 폰 · Chrome',
  });
  assert.equal(deviceKind(ua), 'android');
});

test('안드로이드인데 Mobile이 없으면 태블릿으로 본다', () => {
  const ua =
    'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  assert.equal(describeDevice(ua).device, '안드로이드 태블릿');
  assert.equal(deviceKind(ua), 'android');
});

test('삼성 인터넷은 크롬으로 오인하지 않는다', () => {
  const ua =
    'Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36';
  assert.equal(describeDevice(ua).browser, '삼성 인터넷');
});

/* ── 데스크톱 ──────────────────────────────────────────────────────────── */

test('윈도우 크롬', () => {
  const ua =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  assert.deepEqual(describeDevice(ua), {
    device: '윈도우 PC',
    browser: 'Chrome',
    label: '윈도우 PC · Chrome',
  });
  assert.equal(deviceKind(ua), 'windows');
});

test('엣지는 크롬으로 오인하지 않는다', () => {
  const ua =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0';
  assert.equal(describeDevice(ua).browser, 'Edge');
});

test('맥 사파리 — 크롬 문자열이 없다', () => {
  const ua =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
  assert.deepEqual(describeDevice(ua), {
    device: 'Mac',
    browser: 'Safari',
    label: 'Mac · Safari',
  });
  assert.equal(deviceKind(ua), 'mac');
});

test('파이어폭스', () => {
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0';
  assert.equal(describeDevice(ua).browser, 'Firefox');
});

/* ── 빈 값·미지의 기기 ─────────────────────────────────────────────────── */

test('user-agent가 없으면 라벨 하나로 뭉갠다', () => {
  for (const empty of [null, undefined, '', '   ']) {
    assert.deepEqual(describeDevice(empty), {
      device: '알 수 없는 기기',
      browser: '',
      label: '알 수 없는 기기',
    });
    assert.equal(deviceKind(empty), 'other');
  }
});

test('처음 보는 기기는 브라우저만이라도 알려준다', () => {
  const ua = 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';
  const info = describeDevice(ua);
  assert.equal(info.browser, 'Chrome');
  assert.equal(info.label.includes('Chrome'), true);
});
