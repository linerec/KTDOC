/**
 * lib/forms/edit.test.ts — 편집 조작이 다른 것을 잃지 않는지 잠근다
 *
 * 이 조작들은 조용히 깨진다. 섹션 하나를 갈아끼우다 다른 섹션을 통째로 잃거나,
 * 순서를 바꾸다 문항이 사라지는 종류라 화면에서는 한참 뒤에야 드러난다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addOption,
  addQuestion,
  allKeys,
  makeKey,
  moveOption,
  patchOption,
  patchQuestion,
  removeQuestion,
} from './edit.ts';
import { validateSchema } from './schema.ts';
import type { FormSchema } from '../../types/forms.ts';

function base(): FormSchema {
  return {
    version: 1,
    sections: [
      {
        key: 's1',
        questions: [
          { key: 'name', type: 'short', required: true, label: { ko: '이름' } },
          {
            key: 'classes',
            type: 'multi',
            required: true,
            selectionOf: 'class',
            label: { ko: '과목' },
            options: [
              { key: 'a', label: { ko: '가' }, programId: 1 },
              { key: 'b', label: { ko: '나' } },
              { key: 'c', label: { ko: '다' } },
            ],
          },
        ],
      },
      { key: 's2', questions: [{ key: 'note', type: 'long', required: false, label: { ko: '메모' } }] },
    ],
  };
}

test('문항을 고쳐도 다른 섹션이 사라지지 않는다', () => {
  const out = patchQuestion(base(), 'name', { required: false });
  assert.equal(out.sections.length, 2);
  assert.equal(out.sections[1].questions[0].key, 'note');
  assert.equal(out.sections[0].questions[0].required, false);
});

test('편집은 원본을 건드리지 않는다', () => {
  const before = base();
  patchQuestion(before, 'name', { required: false });
  assert.equal(before.sections[0].questions[0].required, true);
});

test('선택지를 고쳐도 형제 선택지가 남는다', () => {
  const out = patchOption(base(), 'classes', 'b', { programId: 7, capacity: 10 });
  const opts = out.sections[0].questions[1].options!;
  assert.equal(opts.length, 3);
  assert.equal(opts[1].programId, 7);
  assert.equal(opts[1].capacity, 10);
  assert.equal(opts[0].programId, 1, '다른 선택지의 값이 지워졌다');
});

test('선택지 순서를 위아래로 옮긴다 — 끝에서는 넘어가지 않는다', () => {
  const down = moveOption(base(), 'classes', 'a', 1);
  assert.deepEqual(down.sections[0].questions[1].options!.map((o) => o.key), ['b', 'a', 'c']);

  const up = moveOption(base(), 'classes', 'c', -1);
  assert.deepEqual(up.sections[0].questions[1].options!.map((o) => o.key), ['a', 'c', 'b']);

  // 맨 위에서 위로 — 아무 일도 없어야 한다
  const stay = moveOption(base(), 'classes', 'a', -1);
  assert.deepEqual(stay.sections[0].questions[1].options!.map((o) => o.key), ['a', 'b', 'c']);
});

test('같은 키의 선택지를 두 번 넣지 않는다 — 게이트가 거부할 스키마를 만들지 않는다', () => {
  const out = addOption(base(), 'classes', { key: 'a', label: { ko: '중복' } });
  assert.equal(out.sections[0].questions[1].options!.length, 3);
  assert.deepEqual(validateSchema(out), []);
});

test('새 선택지는 끝에 붙는다', () => {
  const out = addOption(base(), 'classes', { key: 'd', label: { ko: '라' } });
  assert.deepEqual(out.sections[0].questions[1].options!.map((o) => o.key), ['a', 'b', 'c', 'd']);
});

test('추가 질문 섹션이 없으면 만들어서 붙인다', () => {
  const out = addQuestion(base(), 'extras', {
    key: 'q_new',
    type: 'short',
    required: false,
    label: { ko: '새 질문' },
  });
  const extras = out.sections.find((s) => s.key === 'extras');
  assert.ok(extras, '섹션이 만들어지지 않았다');
  assert.equal(extras!.questions[0].key, 'q_new');
  assert.deepEqual(validateSchema(out), []);
});

test('문항 삭제는 그 문항만 지운다', () => {
  const out = removeQuestion(base(), 'name');
  assert.equal(out.sections[0].questions.length, 1);
  assert.equal(out.sections[0].questions[0].key, 'classes');
  assert.equal(out.sections[1].questions.length, 1);
});

test('라벨에서 만든 키는 게이트를 통과하는 모양이다', () => {
  assert.equal(makeKey('유년부 무용', []), 'item'); // 한글은 남지 않는다 → 기본값
  assert.equal(makeKey('Kids Dance', []), 'kids_dance');
  assert.equal(makeKey('  Mega  Drum! ', []), 'mega_drum');
});

test('키가 겹치면 숫자를 붙인다', () => {
  assert.equal(makeKey('Kids Dance', ['kids_dance']), 'kids_dance_2');
  assert.equal(makeKey('Kids Dance', ['kids_dance', 'kids_dance_2']), 'kids_dance_3');
  // 한글 라벨이 연달아 들어와도 서로 부딪히지 않아야 한다
  assert.equal(makeKey('유년부 무용', ['item']), 'item_2');
});

test('allKeys 는 문항과 선택지 키를 모두 모은다 — 새 키가 어느 쪽과도 겹치면 안 된다', () => {
  assert.deepEqual(allKeys(base()).sort(), ['a', 'b', 'c', 'classes', 'name', 'note']);
});
