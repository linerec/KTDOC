import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ENTRY_CHANNELS,
  ENTRY_CHANNEL_LABEL,
  isEntryChannel,
  isOptionalInStaffEntry,
  relaxSchemaForStaffEntry,
  staffEntryNote,
} from './staffEntry.ts';
import { seasonPreset2026 } from './presets.ts';
import { allQuestions, validateAnswers } from './schema.ts';
import type { Answers } from '../../types/forms.ts';

const schema = seasonPreset2026();

test('모든 접수 경로에 라벨이 있다', () => {
  for (const c of ENTRY_CHANNELS) {
    assert.ok(ENTRY_CHANNEL_LABEL[c], `${c} 라벨 없음`);
  }
  assert.equal(isEntryChannel('phone'), true);
  assert.equal(isEntryChannel('carrier-pigeon'), false);
  assert.equal(isEntryChannel(null), false);
});

test('화면이 별표를 떼는 문항과 서버가 봐주는 문항이 같다', () => {
  // 둘이 어긋나면 "비워 두셔도 됩니다"라고 써 놓고 버튼이 막는다 — 실제로 그랬다.
  const relaxed = relaxSchemaForStaffEntry(schema);
  const before = allQuestions(schema);
  const after = allQuestions(relaxed);

  for (const q of before) {
    const mirror = after.find((x) => x.key === q.key);
    assert.ok(mirror, `${q.key} 가 사라졌다`);
    assert.equal(
      mirror.required,
      isOptionalInStaffEntry(q) ? false : q.required,
      `${q.key} 의 필수 여부가 규칙과 다르다`
    );
  }
});

test('대리 입력 스키마는 이메일만 풀어 준다 — 이름·연락처는 그대로 필수', () => {
  const relaxed = relaxSchemaForStaffEntry(schema);
  const qs = allQuestions(relaxed);

  const email = qs.find((q) => q.bind === 'email');
  const name = qs.find((q) => q.bind === 'student_name');
  const phone = qs.find((q) => q.bind === 'phone');

  assert.equal(email?.required, false, '전화로 받은 신청에는 이메일이 없다');
  assert.equal(name?.required, true, '이름 없이는 누구의 신청인지 알 수 없다');
  assert.equal(phone?.required, true, '이메일을 봐주는 대신 연락처는 반드시 받는다');
});

test('이메일을 비운 답변이 대리 입력 스키마를 통과한다', () => {
  const answers: Answers = {
    q1_reg_type: 'new',
    q2_student_name: '전화로온학생',
    q4b_phone: '917-555-0100',
    q6_period: 'y1',
    q7_classes: ['kids_dance'],
    q8_perform: 'yes',
    q10_parade: true,
    q12_refund: true,
    q13_media: 'yes',
    q14_final: true,
  };

  const relaxed = relaxSchemaForStaffEntry(schema);
  assert.deepEqual(validateAnswers(relaxed, answers), {});

  // 공개 제출에서는 여전히 막힌다 — 봐주는 것은 대리 입력 자리뿐이다.
  const strict = validateAnswers(schema, answers);
  const emailKey = allQuestions(schema).find((q) => q.bind === 'email')?.key ?? '';
  assert.ok(strict[emailKey], '공개 신청서는 이메일을 계속 받아야 한다');
});

test('원본 스키마를 건드리지 않는다', () => {
  // 저장·검증에 쓰는 원본이 화면 사정으로 바뀌면 안 된다.
  const emailKey = allQuestions(schema).find((q) => q.bind === 'email')?.key;
  relaxSchemaForStaffEntry(schema);
  const stillRequired = allQuestions(schema).find((q) => q.key === emailKey)?.required;
  assert.equal(stillRequired, true);
});

test('처리 이력 한 줄에 누가·어디로·무엇을이 담긴다', () => {
  assert.equal(
    staffEntryNote({ staffName: '김선생', channel: 'phone' }),
    '김선생 님이 대신 입력했습니다. (받은 경로: 전화)'
  );
  assert.equal(
    staffEntryNote({ staffName: '김선생', channel: 'paper', memo: ' 형제 함께 신청 ' }),
    '김선생 님이 대신 입력했습니다. (받은 경로: 종이 신청서)\n형제 함께 신청'
  );
  // 경로를 모르면 그 자리를 비워 둔다 — 없는 사실을 지어내지 않는다.
  assert.equal(
    staffEntryNote({ staffName: '김선생', channel: null, memo: '' }),
    '김선생 님이 대신 입력했습니다.'
  );
});
