import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePasscode, isValidPasscode } from './passcodeFormat.ts';

test('브라우저에서도 도는 모듈이다 — node:crypto를 가져오지 않는다', async () => {
  // 실제로 겪은 사고: node:crypto의 randomInt는 Next가 끼워 넣는
  // crypto-browserify에 없어서, 관리 화면이 열리는 순간 TypeError로 죽었다.
  const source = await (await import('node:fs/promises')).readFile(
    new URL('./passcodeFormat.ts', import.meta.url),
    'utf8'
  );
  assert.ok(!source.includes("from 'node:crypto'"), 'node:crypto를 가져오면 브라우저에서 깨진다');
  assert.ok(source.includes('globalThis.crypto'), '표준 Web Crypto를 써야 양쪽에서 돈다');
});

test('생성한 비밀번호는 스스로의 검증을 통과한다', () => {
  for (let i = 0; i < 300; i++) {
    assert.equal(isValidPasscode(generatePasscode()), true);
  }
});

test('열 자리 숫자가 모두 나온다 — 한쪽으로 쏠리지 않는다', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 400; i++) {
    for (const ch of generatePasscode(8)) seen.add(ch);
  }
  assert.equal(seen.size, 10, `0~9가 모두 나와야 한다 (본 것: ${[...seen].sort().join('')})`);
});

test('뽑기 함수를 주입하면 그대로 쓴다 — 시험이 값을 고정할 수 있다', () => {
  assert.equal(generatePasscode(4, () => 7), '7777');
});

test('길이를 주면 그 길이로 나온다', () => {
  for (const n of [4, 5, 6, 7, 8]) {
    assert.equal(generatePasscode(n).length, n);
  }
});
