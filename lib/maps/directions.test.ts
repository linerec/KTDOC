/**
 * 길찾기 링크 시험
 *
 *   node --test lib/maps/directions.test.ts
 *
 * 이 함수가 만들어진 이유가 "좌표 없는 행사에도 버튼이 붙게 하는 것"이므로,
 * 좌표가 없을 때 무엇이 나오는지를 가장 촘촘히 잠근다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { directionsDestination, directionsHref } from './directions.ts';

test('좌표가 있으면 좌표를 쓴다 — 가장 정확하다', () => {
  assert.equal(
    directionsDestination({ location: '어딘가', address: '어떤 주소', lat: 40.886, lng: -74.047 }),
    '40.886,-74.047'
  );
});

test('좌표가 없으면 이름과 주소를 함께 넘긴다 — 큰 건물은 주소만으로 입구가 어긋난다', () => {
  assert.equal(
    directionsDestination({
      location: 'Bergen County Administration Building',
      address: '1 Bergen County Plaza, Hackensack, NJ 07601',
    }),
    'Bergen County Administration Building, 1 Bergen County Plaza, Hackensack, NJ 07601'
  );
});

test('주소에 이미 이름이 들어 있으면 겹쳐 쓰지 않는다', () => {
  assert.equal(
    directionsDestination({
      location: 'Barrymore Film Center',
      address: 'Barrymore Film Center, Fort Lee, NJ',
    }),
    'Barrymore Film Center, Fort Lee, NJ'
  );
});

test('주소만 있어도 된다 — 실제로 이런 행사가 많다', () => {
  assert.equal(directionsDestination({ address: '1 Bergen County Plaza' }), '1 Bergen County Plaza');
});

test('이름만 있어도 된다', () => {
  assert.equal(directionsDestination({ location: '춤누리 학원' }), '춤누리 학원');
});

test('갈 곳이 없으면 null — 버튼을 아예 걸지 않는다', () => {
  assert.equal(directionsDestination({}), null);
  assert.equal(directionsDestination({ location: '   ', address: '' }), null);
  assert.equal(directionsHref({}), null);
});

test('좌표가 숫자가 아니면 좌표로 치지 않는다 — 문자열 "40.8"이 그대로 새면 링크가 깨진다', () => {
  const target = { address: '주소', lat: '40.8' as unknown as number, lng: null };
  assert.equal(directionsDestination(target), '주소');
});

test('링크는 구글 지도 공식 범용 URL이고 목적지는 인코딩된다', () => {
  const href = directionsHref({ address: '1 Bergen County Plaza, Hackensack, NJ 07601' });
  assert.ok(href, '주소가 있으면 링크가 나와야 한다');
  assert.ok(href.startsWith('https://www.google.com/maps/dir/?api=1&destination='));
  // 쉼표·공백이 그대로 새면 일부 클라이언트에서 잘린다
  assert.ok(!href.includes(' '));
  assert.equal(
    decodeURIComponent(href.split('destination=')[1]),
    '1 Bergen County Plaza, Hackensack, NJ 07601'
  );
});

test('운영자가 넣은 지도 링크가 있으면 그것을 쓴다 — 상세 페이지와 같은 규칙', () => {
  assert.equal(
    directionsHref({ locationUrl: 'https://naver.me/xyz', address: '무시될 주소' }),
    'https://naver.me/xyz'
  );
});
