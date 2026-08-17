/**
 * lib/mail/config.test.ts — 설정 저장·마스킹 규칙을 잠근다
 *
 * 이 규칙이 틀어지면 조용히 사고가 난다:
 *  - 깊은 병합이 깨지면 필드를 추가한 배포에서 옛 저장본이 통째로 기본값이 된다
 *  - 마스킹이 깨지면 API 키가 브라우저로 새어나간다
 *  - "빈 시크릿 = 유지"가 깨지면 다른 칸을 고칠 때마다 키가 지워진다
 *    (그리고 그 사실은 다음 발송이 실패할 때에야 드러난다)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MAIL_CONFIG,
  mergeMailConfig,
  toPublicMailConfig,
  applyMailConfigPatch,
  isValidEmail,
} from './config.ts';

test('빈 저장본은 기본값이 된다', () => {
  assert.deepEqual(mergeMailConfig(null), DEFAULT_MAIL_CONFIG);
  assert.deepEqual(mergeMailConfig(undefined), DEFAULT_MAIL_CONFIG);
  assert.deepEqual(mergeMailConfig('깨진 값'), DEFAULT_MAIL_CONFIG);
});

test('JSON 문자열도 읽는다 — D1은 문자열로 돌려준다', () => {
  const merged = mergeMailConfig(JSON.stringify({ from: 'a@b.com' }));
  assert.equal(merged.from, 'a@b.com');
});

test('옛 저장본에 없는 필드가 추가돼도 깨지지 않는다', () => {
  // quota·events가 없던 시절의 저장본
  const old = { provider: 'resend', from: 'a@b.com', resendApiKey: 'key' };
  const merged = mergeMailConfig(old);
  assert.equal(merged.from, 'a@b.com');
  assert.equal(merged.provider, 'resend');
  assert.equal(merged.quota.dailyLimit, 100);
  assert.deepEqual(merged.events, {});
});

test('smtp를 일부만 저장해도 나머지는 기본값이 채워진다', () => {
  const merged = mergeMailConfig({ smtp: { host: 'smtp.example.com' } });
  assert.equal(merged.smtp.host, 'smtp.example.com');
  assert.equal(merged.smtp.port, 465);
  assert.equal(merged.smtp.secure, true);
});

test('이벤트 스위치의 채널 한 겹이 보존된다 — push가 붙을 자리', () => {
  const merged = mergeMailConfig({
    events: { 'member.signup': { user: { email: false }, staff: { email: true } } },
  });
  assert.deepEqual(merged.events['member.signup'], {
    user: { email: false },
    staff: { email: true },
  });
});

test('알 수 없는 대상 키는 버린다', () => {
  const merged = mergeMailConfig({
    events: { 'x.y': { user: { email: true }, hacker: { email: true } } },
  });
  assert.deepEqual(Object.keys(merged.events['x.y']), ['user']);
});

test('공개뷰에는 시크릿 원문이 없다', () => {
  const config = mergeMailConfig({
    resendApiKey: 're_secret',
    smtp: { password: 'pw' },
  });
  const pub = toPublicMailConfig(config);
  const json = JSON.stringify(pub);
  assert.equal(json.includes('re_secret'), false);
  assert.equal(json.includes('pw'), false);
  assert.equal(pub.resendApiKeySet, true);
  assert.equal(pub.smtp.passwordSet, true);
});

test('빈 시크릿을 보내면 기존 값이 유지된다', () => {
  const current = mergeMailConfig({
    resendApiKey: 'keep-me',
    smtp: { password: 'keep-pw' },
  });
  const next = applyMailConfigPatch(current, {
    from: 'new@example.com',
    resendApiKey: '',
    smtp: { password: '' },
  });
  assert.equal(next.resendApiKey, 'keep-me');
  assert.equal(next.smtp.password, 'keep-pw');
  assert.equal(next.from, 'new@example.com');
});

test('clear 플래그로만 시크릿이 지워진다', () => {
  const current = mergeMailConfig({
    resendApiKey: 'bye',
    smtp: { password: 'bye-pw' },
  });
  const next = applyMailConfigPatch(current, {
    clearResendApiKey: true,
    clearSmtpPassword: true,
  });
  assert.equal(next.resendApiKey, '');
  assert.equal(next.smtp.password, '');
});

test('보낸 키만 반영한다 — 다른 탭 값이 지워지지 않는다', () => {
  const current = mergeMailConfig({
    from: 'a@b.com',
    staffTo: ['ops@b.com'],
    events: { 'member.signup': { user: { email: true } } },
  });
  const next = applyMailConfigPatch(current, { fromName: '이름만 변경' });
  assert.equal(next.from, 'a@b.com');
  assert.deepEqual(next.staffTo, ['ops@b.com']);
  assert.deepEqual(next.events, { 'member.signup': { user: { email: true } } });
  assert.equal(next.fromName, '이름만 변경');
});

test('staffTo는 공백을 털고 빈 줄을 버린다', () => {
  const next = applyMailConfigPatch(DEFAULT_MAIL_CONFIG, {
    staffTo: ['  a@b.com  ', '', '   ', 'c@d.com'],
  });
  assert.deepEqual(next.staffTo, ['a@b.com', 'c@d.com']);
});

test('이메일 형식 검증', () => {
  assert.equal(isValidEmail('a@b.com'), true);
  assert.equal(isValidEmail('a.b+c@d.co.kr'), true);
  assert.equal(isValidEmail('a@b'), false);
  assert.equal(isValidEmail('공백 @b.com'), false);
  assert.equal(isValidEmail(''), false);
  assert.equal(isValidEmail('   '), false);
});

test('한도 값은 정수로 강제되고 범위를 벗어나면 되돌아간다', () => {
  const merged = mergeMailConfig({
    quota: { dailyLimit: -5, monthlyLimit: 12.7, warnAtPercent: 500 },
  });
  assert.equal(merged.quota.dailyLimit, 100); // 음수 → 기본값
  assert.equal(merged.quota.monthlyLimit, 12); // 소수 → 절사
  assert.equal(merged.quota.warnAtPercent, 100); // 상한 고정
});

test('provider는 아는 값만 받는다', () => {
  assert.equal(mergeMailConfig({ provider: 'smtp' }).provider, 'smtp');
  assert.equal(mergeMailConfig({ provider: 'sendgrid' }).provider, '');
});
