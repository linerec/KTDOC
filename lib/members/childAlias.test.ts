import { test } from 'node:test';
import assert from 'node:assert/strict';
import { childAliasEmail } from './childAlias.ts';

test('보호자 주소에 아이 이름을 별칭으로 붙인다', () => {
  assert.equal(
    childAliasEmail('jin.lim1024@gmail.com', 'Celine Lee'),
    'jin.lim1024+celine@gmail.com'
  );
  assert.equal(
    childAliasEmail('yunsun114@gmail.com', 'Logan Gujun Blum'),
    'yunsun114+logan@gmail.com'
  );
});

test('첫 이름만 쓴다 — 주소가 길어지면 받아 적기 어렵다', () => {
  assert.equal(childAliasEmail('a@b.com', 'Mary Jane Watson'), 'a+mary@b.com');
});

test('보호자 주소에 이미 별칭이 있으면 걷어내고 새로 붙인다', () => {
  // 첫째를 만들 때 쓴 주소로 둘째를 만들면 +celine+logan 이 되어 버린다
  assert.equal(childAliasEmail('jin.lim1024+celine@gmail.com', 'Logan'), 'jin.lim1024+logan@gmail.com');
});

test('대소문자·점·공백을 정리한다', () => {
  assert.equal(childAliasEmail('A@B.COM', '  CeLiNe  '), 'a+celine@b.com');
  assert.equal(childAliasEmail('a@b.com', "O'Brien"), 'a+obrien@b.com');
  assert.equal(childAliasEmail('a@b.com', 'Anne-Marie'), 'a+annemarie@b.com');
});

test('영문으로 옮길 수 없는 이름은 null — 지어내지 않는다', () => {
  // 한글 이름은 로마자 표기가 사람마다 다르다(박민준 = Minjun/Min-Jun/Minjoon).
  // 운영진이 직접 적게 하는 편이 낫다 — 주소는 나중에 바꾸기 번거롭다.
  assert.equal(childAliasEmail('a@b.com', '박민준'), null);
  assert.equal(childAliasEmail('a@b.com', '   '), null);
  assert.equal(childAliasEmail('a@b.com', '123'), 'a+123@b.com');
});

test('망가진 보호자 주소는 null이고 던지지 않는다', () => {
  for (const bad of ['', 'no-at-sign', '@nolocal.com', 'nodomain@', 'a@b@c.com', undefined as unknown as string]) {
    assert.equal(childAliasEmail(bad, 'Celine'), null, `${JSON.stringify(bad)}는 null이어야 한다`);
  }
});

test('아주 긴 이름은 잘라 낸다', () => {
  const alias = childAliasEmail('a@b.com', 'Bartholomewsimpsonjonathanmaximilian');
  assert.ok(alias && alias.length < 40, alias ?? '(null)');
  assert.ok(alias?.startsWith('a+bartholomew'));
});
