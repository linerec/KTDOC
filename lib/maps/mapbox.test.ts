/**
 * lib/maps/mapbox.test.ts — Mapbox 지오코더의 '해석' 부분을 잠근다.
 *
 * 네트워크는 fetch를 갈아끼워 흉내 낸다. 지키려는 것은 구글 쪽과 같다:
 * **못 찾았을 때 못 찾았다고 말하는 것**, 그리고 확신이 낮은 결과를 정확한 결과와
 * 섞지 않는 것. 이전 제공자(Photon)는 둘 다 하지 않아 오답이 정답처럼 저장됐다.
 */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mapboxGeocoder } from './providers/mapbox.ts';

const realFetch = globalThis.fetch;
const realToken = process.env.MAPBOX_ACCESS_TOKEN;

let lastUrl = '';

function mockFetch(payload: unknown, ok = true, status = 200) {
  globalThis.fetch = (async (url: string) => {
    lastUrl = String(url);
    return { ok, status, json: async () => payload } as unknown as Response;
  }) as unknown as typeof fetch;
}

/** v6 응답 한 건 만들기 */
function feature(props: Record<string, unknown>) {
  return {
    geometry: { coordinates: [-74.0435, 40.8859] },
    properties: {
      coordinates: { longitude: -74.0435, latitude: 40.8859 },
      ...props,
    },
  };
}

beforeEach(() => {
  process.env.MAPBOX_ACCESS_TOKEN = 'test-token';
  lastUrl = '';
});

afterEach(() => {
  globalThis.fetch = realFetch;
  if (realToken === undefined) delete process.env.MAPBOX_ACCESS_TOKEN;
  else process.env.MAPBOX_ACCESS_TOKEN = realToken;
});

test('결과가 없으면 빈 배열 — 오류가 아니다', async () => {
  mockFetch({ features: [] });
  assert.deepEqual(await mapboxGeocoder.geocode('없는주소 12345'), []);
});

test('full_address(정규화된 주소)와 좌표를 그대로 쓴다', async () => {
  mockFetch({
    features: [
      feature({
        feature_type: 'address',
        name: '1 Bergen County Plaza',
        full_address: '1 Bergen County Plaza, Hackensack, New Jersey 07601, United States',
        match_code: { confidence: 'exact' },
      }),
    ],
  });
  const [r] = await mapboxGeocoder.geocode('1 bergen county plaza hackensack nj');
  assert.equal(r.address, '1 Bergen County Plaza, Hackensack, New Jersey 07601, United States');
  assert.equal(r.lat, 40.8859);
  assert.equal(r.lng, -74.0435);
  assert.equal(r.approximate, false);
});

test('full_address가 없으면 name + place_formatted로 조립한다', async () => {
  mockFetch({
    features: [
      feature({
        feature_type: 'place',
        name: 'Hackensack',
        place_formatted: 'New Jersey, United States',
      }),
    ],
  });
  const [r] = await mapboxGeocoder.geocode('hackensack');
  assert.equal(r.address, 'Hackensack, New Jersey, United States');
});

test('match_code가 없으면 근사치다 — 주소를 못 찾고 더 성긴 단위로 물러난 것', async () => {
  // 실제 사례: "1 Bergen County Plaza, Hackensack, NJ"를 넣으면
  // [street] County Place가 나온다. 이름만 비슷한 1km 떨어진 다른 길이다.
  mockFetch({
    features: [
      feature({
        feature_type: 'street',
        name: 'County Place',
        full_address: 'County Place, Hackensack, New Jersey 07601, United States',
      }),
    ],
  });
  const [r] = await mapboxGeocoder.geocode('1 Bergen County Plaza, Hackensack, NJ');
  assert.equal(
    r.approximate,
    true,
    '거리 수준 대체품을 정확한 주소로 넘기면 엉뚱한 좌표가 확정된 것처럼 저장된다'
  );
});

test('confidence가 낮으면 근사치로 구분한다', async () => {
  mockFetch({
    features: [
      feature({ feature_type: 'address', full_address: 'A', match_code: { confidence: 'exact' } }),
      feature({ feature_type: 'address', full_address: 'B', match_code: { confidence: 'high' } }),
      feature({ feature_type: 'address', full_address: 'C', match_code: { confidence: 'medium' } }),
      feature({ feature_type: 'address', full_address: 'D', match_code: { confidence: 'low' } }),
    ],
  });
  const out = await mapboxGeocoder.geocode('x');
  assert.deepEqual(
    out.map((r) => r.approximate),
    [false, false, true, true]
  );
});

test('주소로 해석된 결과만 정확할 수 있다', async () => {
  // confidence가 붙는다는 것 자체가 '주소로 해석됐다'는 뜻이다.
  mockFetch({
    features: [
      feature({ feature_type: 'address', full_address: '주소', match_code: { confidence: 'exact' } }),
      feature({ feature_type: 'postcode', full_address: '우편번호 구역' }),
      feature({ feature_type: 'neighborhood', full_address: '동네' }),
    ],
  });
  const out = await mapboxGeocoder.geocode('x');
  assert.deepEqual(out.map((r) => r.approximate), [false, true, true]);
});

test('주소형 결과의 name은 장소명으로 쓰지 않는다 — 주소와 중복된다', async () => {
  mockFetch({
    features: [
      feature({ feature_type: 'address', name: '1 Bergen County Plaza', full_address: '1 Bergen County Plaza, …' }),
      feature({ feature_type: 'poi', name: 'Bergen PAC', name_preferred: 'Bergen Performing Arts Center', full_address: '30 N Van Brunt St, …' }),
    ],
  });
  const out = await mapboxGeocoder.geocode('x');
  assert.equal(out[0].name, null);
  assert.equal(out[1].name, 'Bergen Performing Arts Center');
});

test('좌표나 주소가 없는 결과는 버린다', async () => {
  mockFetch({
    features: [
      { properties: { full_address: '좌표 없음' } },
      feature({ feature_type: 'address' }), // 주소 문자열 없음
      feature({ feature_type: 'address', full_address: '정상' }),
    ],
  });
  const out = await mapboxGeocoder.geocode('x');
  assert.equal(out.length, 1);
  assert.equal(out[0].address, '정상');
});

test('토큰이 없으면 조용히 빈 결과가 아니라 오류로 알린다', async () => {
  delete process.env.MAPBOX_ACCESS_TOKEN;
  mockFetch({ features: [] });
  await assert.rejects(() => mapboxGeocoder.geocode('아무거나'), /MAPBOX_ACCESS_TOKEN/);
});

test('토큰이 잘못되면(401) 사유를 삼키지 않는다', async () => {
  mockFetch({ message: 'Not Authorized - Invalid Token' }, false, 401);
  await assert.rejects(() => mapboxGeocoder.geocode('아무거나'), /HTTP 401[\s\S]*Invalid Token/);
});

test('질의는 근처 가중치와 영문 표기로 보낸다 (필터가 아니라 가중치)', async () => {
  mockFetch({ features: [] });
  await mapboxGeocoder.geocode('아무거나');
  assert.match(lastUrl, /proximity=/);
  assert.match(lastUrl, /language=en/);
  // country= 로 하드 필터를 걸면 미국 밖 주소를 아예 못 찾게 된다
  assert.ok(!lastUrl.includes('country='), 'country 하드 필터를 걸면 안 된다');
});

test('limit은 v6 상한(10)을 넘지 않는다', async () => {
  mockFetch({ features: [] });
  await mapboxGeocoder.geocode('x', { limit: 50 });
  assert.match(lastUrl, /limit=10/);
});
