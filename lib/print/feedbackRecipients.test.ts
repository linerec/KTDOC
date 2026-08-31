/**
 * lib/print/feedbackRecipients.test.ts — 회신이 도착할 주소를 잠근다
 *
 * 도안 회신은 관리 콘솔의 '운영진 주소'로 보내지 않는다. 거기 적힌 값은 학원
 * 대표 메일(원장님)이라, 단장님이 답을 보내면 도안을 고칠 사람에게는 오지 않고
 * 학원 메일함에만 쌓인다. 그래서 이 사건만 수신처를 따로 갖는다.
 *
 * 여기가 빈 배열을 돌려주면 회신은 아무 데도 가지 않는다 — 환경변수에 오타가
 * 있어도 기본 주소로 떨어져야 하는 이유다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePrintFeedbackTo,
  DEFAULT_PRINT_FEEDBACK_TO,
} from './feedbackRecipients.ts';

test('설정이 없으면 기본 주소로 간다', () => {
  assert.deepEqual(resolvePrintFeedbackTo(undefined), [DEFAULT_PRINT_FEEDBACK_TO]);
  assert.deepEqual(resolvePrintFeedbackTo(''), [DEFAULT_PRINT_FEEDBACK_TO]);
  assert.deepEqual(resolvePrintFeedbackTo('   '), [DEFAULT_PRINT_FEEDBACK_TO]);
});

test('환경변수로 수신처를 바꿀 수 있다', () => {
  assert.deepEqual(resolvePrintFeedbackTo('someone@example.com'), [
    'someone@example.com',
  ]);
});

test('쉼표로 여러 명에게', () => {
  assert.deepEqual(
    resolvePrintFeedbackTo('a@example.com, b@example.com'),
    ['a@example.com', 'b@example.com']
  );
});

test('오타가 섞이면 성한 주소만 남긴다', () => {
  assert.deepEqual(
    resolvePrintFeedbackTo('a@example.com, 이건주소가아님'),
    ['a@example.com']
  );
});

test('전부 오타면 기본 주소로 떨어진다 — 회신이 사라지지 않게', () => {
  assert.deepEqual(resolvePrintFeedbackTo('이건주소가아님'), [
    DEFAULT_PRINT_FEEDBACK_TO,
  ]);
});

test('같은 주소를 두 번 적어도 한 통만', () => {
  assert.deepEqual(
    resolvePrintFeedbackTo('a@example.com, a@example.com'),
    ['a@example.com']
  );
});

test('기본 주소는 학원 대표 메일이 아니다', () => {
  assert.notEqual(DEFAULT_PRINT_FEEDBACK_TO, 'choomnoori@gmail.com');
});
