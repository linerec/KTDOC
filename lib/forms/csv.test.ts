/**
 * lib/forms/csv.test.ts — 내보내기가 새면 안 되는 것과 깨지면 안 되는 것
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCsv, csvCell, type CsvResponseRow } from './csv.ts';
import type { FormSchema } from '../../types/forms.ts';

const SCHEMA: FormSchema = {
  version: 1,
  sections: [
    {
      key: 's',
      questions: [
        { key: 'name', type: 'short', required: true, bind: 'student_name', label: { ko: '학생 이름' } },
        {
          key: 'classes', type: 'multi', required: true, selectionOf: 'class', label: { ko: '과목' },
          options: [
            { key: 'a', label: { ko: '유년부 무용' } },
            { key: 'b', label: { ko: '오고무' } },
          ],
        },
        { key: 'media', type: 'consent', required: true, consentKey: 'media_release', label: { ko: '미디어 동의' } },
        { key: 'medical', type: 'long', required: false, sensitive: true, label: { ko: '건강 및 특이사항' } },
        { key: 'info', type: 'info', required: false, label: { ko: '안내' } },
      ],
    },
  ],
};

const ROW: CsvResponseRow = {
  id: 12,
  submitted_at: '2026-08-14 10:00:00',
  status: 'new',
  student_name: '김하늘',
  student_grade: '3학년',
  email: 'a@b.com',
  phone: '917-555-0100',
  guardian_name: null,
  has_medical: 1,
  source: 'public',
  answers_json: JSON.stringify({
    name: '김하늘',
    classes: ['a', 'b'],
    media: true,
    medical: '땅콩 알레르기',
  }),
  internal_note: '전화 연결됨',
};

test('민감 열은 기본으로 빠진다 — 실수로 의료정보가 스프레드시트로 나가면 안 된다', () => {
  const csv = buildCsv({ schema: SCHEMA, rows: [ROW], includeSensitive: false });
  assert.ok(!csv.includes('땅콩'), '의료정보 내용이 실렸다');
  assert.ok(!csv.includes('건강 및 특이사항'), '민감 문항 열이 남았다');
  // 확인할 사람이 있는지는 알아야 하므로 "있음"만 남긴다
  assert.ok(csv.includes('건강 특이사항'));
  assert.ok(csv.includes('있음'));
});

test('명시적으로 요청하면 민감 열이 들어간다', () => {
  const csv = buildCsv({ schema: SCHEMA, rows: [ROW], includeSensitive: true });
  assert.ok(csv.includes('땅콩 알레르기'));
  assert.ok(csv.includes('건강 및 특이사항'));
});

test('선택지는 키가 아니라 사람이 읽는 라벨로 나간다', () => {
  const csv = buildCsv({ schema: SCHEMA, rows: [ROW], includeSensitive: false });
  assert.ok(csv.includes('유년부 무용 · 오고무'), csv);
  assert.ok(!csv.includes('"a"'), '선택지 키가 그대로 실렸다');
});

test('동의는 예/아니오가 아니라 뜻으로 나간다', () => {
  assert.ok(buildCsv({ schema: SCHEMA, rows: [ROW], includeSensitive: false }).includes('동의'));
  const declined = { ...ROW, answers_json: JSON.stringify({ media: false }) };
  assert.ok(buildCsv({ schema: SCHEMA, rows: [declined], includeSensitive: false }).includes('동의 안 함'));
});

test('안내 블록은 열이 되지 않는다 — 답이 없는 항목이다', () => {
  const header = buildCsv({ schema: SCHEMA, rows: [], includeSensitive: false }).split('\r\n')[0];
  assert.ok(!header.includes('안내'), header);
});

test('쉼표·따옴표·줄바꿈이 든 값을 안전하게 감싼다', () => {
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('그는 "네"라고 했다'), '"그는 ""네""라고 했다"');
  assert.equal(csvCell('첫 줄\n둘째 줄'), '"첫 줄\n둘째 줄"');
  assert.equal(csvCell('보통값'), '보통값');
  assert.equal(csvCell(null), '');
});

test('BOM 을 붙인다 — 없으면 엑셀이 한글을 깨뜨린다', () => {
  assert.ok(buildCsv({ schema: SCHEMA, rows: [], includeSensitive: false }).startsWith('﻿'));
});

test('깨진 answers_json 이 있어도 내보내기 전체가 죽지 않는다', () => {
  const broken = { ...ROW, answers_json: '{not json' };
  const csv = buildCsv({ schema: SCHEMA, rows: [broken], includeSensitive: false });
  assert.ok(csv.includes('김하늘'), '코어 컬럼은 살아 있어야 한다');
});

test('대리 입력과 직접 제출을 구분해 적는다', () => {
  const staff = { ...ROW, source: 'staff' };
  assert.ok(buildCsv({ schema: SCHEMA, rows: [staff], includeSensitive: false }).includes('대리 입력'));
  assert.ok(buildCsv({ schema: SCHEMA, rows: [ROW], includeSensitive: false }).includes('직접 제출'));
});
