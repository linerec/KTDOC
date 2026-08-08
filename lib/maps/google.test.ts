/**
 * lib/maps/google.test.ts — Google 지오코더의 '해석' 부분을 잠근다.
 *
 * 네트워크는 fetch를 갈아끼워 흉내 낸다. 여기서 지키려는 것은 하나다:
 * **못 찾았을 때 못 찾았다고 말하는 것.** 이전 제공자(Photon)는 못 찾아도 늘
 * 그럴듯한 오답을 돌려줘서, 관리자가 엉뚱한 좌표를 확정된 주소로 착각했다.
 */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { googleGeocoder } from './providers/google.ts';

const realFetch = globalThis.fetch;
const realKey = process.env.GOOGLE_MAPS_API_KEY;

function mockFetch(payload: unknown, ok = true, status = 200) {
  globalThis.fetch = (async () =>
    ({ ok, status, json: async () => payload }) as unknown as Response) as typeof fetch;
}

beforeEach(() => {
  process.env.GOOGLE_MAPS_API_KEY = 'test-key';
});

afterEach(() => {
  globalThis.fetch = realFetch;
  if (realKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
  else process.env.GOOGLE_MAPS_API_KEY = realKey;
});

test('ZERO_RESULTS는 오류가 아니라 빈 결과다', async () => {
  mockFetch({ status: 'ZERO_RESULTS', results: [] });
  const out = await googleGeocoder.geocode('없는주소 12345');
  assert.deepEqual(out, []);
});

test('정규화된 주소(formatted_address)와 좌표를 그대로 쓴다', async () => {
  mockFetch({
    status: 'OK',
    results: [
      {
        formatted_address: '1 Bergen County Plaza, Hackensack, NJ 07601, USA',
        geometry: { location: { lat: 40.8859, lng: -74.0435 } },
      },
    ],
  });
  const [r] = await googleGeocoder.geocode('1 bergen county plaza hackensack nj');
  assert.equal(r.address, '1 Bergen County Plaza, Hackensack, NJ 07601, USA');
  assert.equal(r.lat, 40.8859);
  assert.equal(r.lng, -74.0435);
  assert.equal(r.approximate, false);
});

test('partial_match는 근사치로 표시한다 — 정확한 결과와 섞이면 안 된다', async () => {
  mockFetch({
    status: 'OK',
    results: [
      {
        formatted_address: 'Hackensack, NJ, USA',
        partial_match: true,
        geometry: { location: { lat: 40.88, lng: -74.04 } },
      },
    ],
  });
  const [r] = await googleGeocoder.geocode('bergen plaza');
  assert.equal(r.approximate, true);
});

test('좌표나 주소가 없는 결과는 버린다', async () => {
  mockFetch({
    status: 'OK',
    results: [
      { formatted_address: '좌표 없음' },
      { geometry: { location: { lat: 1, lng: 2 } } },
      { formatted_address: '정상', geometry: { location: { lat: 3, lng: 4 } } },
    ],
  });
  const out = await googleGeocoder.geocode('무엇이든');
  assert.equal(out.length, 1);
  assert.equal(out[0].address, '정상');
});

test('limit을 넘겨받으면 그만큼만 돌려준다', async () => {
  mockFetch({
    status: 'OK',
    results: Array.from({ length: 10 }, (_, i) => ({
      formatted_address: `주소 ${i}`,
      geometry: { location: { lat: i, lng: i } },
    })),
  });
  const out = await googleGeocoder.geocode('많은 결과', { limit: 3 });
  assert.equal(out.length, 3);
});

test('키가 없으면 조용히 빈 결과가 아니라 오류로 알린다', async () => {
  delete process.env.GOOGLE_MAPS_API_KEY;
  mockFetch({ status: 'OK', results: [] });
  await assert.rejects(() => googleGeocoder.geocode('아무거나'), /GOOGLE_MAPS_API_KEY/);
});

test('구글이 오류 상태를 주면 삼키지 않는다', async () => {
  mockFetch({ status: 'REQUEST_DENIED', error_message: 'API key not valid' });
  await assert.rejects(() => googleGeocoder.geocode('아무거나'), /REQUEST_DENIED/);
});

test('장소 이름은 있을 때만 채운다', async () => {
  mockFetch({
    status: 'OK',
    results: [
      {
        formatted_address: '어딘가',
        address_components: [{ long_name: '버겐 공연장', short_name: 'BPAC', types: ['premise'] }],
        geometry: { location: { lat: 1, lng: 2 } },
      },
      { formatted_address: '이름 없음', geometry: { location: { lat: 3, lng: 4 } } },
    ],
  });
  const out = await googleGeocoder.geocode('x');
  assert.equal(out[0].name, '버겐 공연장');
  assert.equal(out[1].name, null);
});
