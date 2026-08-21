/**
 * lib/forms/csv.ts — 응답을 표로 내보낸다
 *
 * 통계 화면을 만들지 않는 대신 이걸 잘 만든다. 엑셀이 더 빠르고, 운영진이 이미
 * 그렇게 일하고 있다(구글폼 응답 스프레드시트).
 *
 * **민감 문항(의료정보)은 기본으로 빠진다.** 실수로 알레르기 정보가 스프레드시트에
 * 실려 돌아다니면 되돌릴 방법이 없다. 포함하려면 관리자가 명시적으로 요청해야 하고,
 * 그때는 열람 기록이 남는다.
 *
 * ※ node --test 가 @/ 별칭을 풀지 못하므로 상대 경로 + .ts 로 import 한다.
 */

import { allQuestions } from './schema.ts';
import { responseStatusLabel } from './responseLabels.ts';
import type { Answers, FormSchema } from '../../types/forms.ts';

/** 쉼표·따옴표·줄바꿈이 들어간 값을 안전하게 감싼다. */
export function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export interface CsvResponseRow {
  id: number;
  submitted_at: string;
  status: string;
  student_name: string;
  student_grade: string | null;
  email: string | null;
  phone: string | null;
  guardian_name: string | null;
  has_medical: number;
  source: string;
  answers_json: string;
  internal_note: string | null;
}

/** 답 하나를 사람이 읽는 문자열로. 선택지는 라벨로 편다. */
function renderAnswer(schema: FormSchema, key: string, answers: Answers): string {
  const q = allQuestions(schema).find((x) => x.key === key);
  const v = answers[key];
  if (v == null) return '';
  if (typeof v === 'boolean') return v ? '동의' : '동의 안 함';

  const labelOf = (optKey: string) =>
    q?.options?.find((o) => o.key === optKey)?.label.ko ?? optKey;

  if (Array.isArray(v)) return v.map(labelOf).join(' · ');
  if (q?.options?.length) return labelOf(v);
  return v;
}

export interface BuildCsvInput {
  schema: FormSchema;
  rows: CsvResponseRow[];
  includeSensitive: boolean;
}

/**
 * BOM 을 붙인다 — 없으면 엑셀이 한글을 깨뜨린다.
 * 이 한 바이트를 빼먹으면 운영진이 "글자가 깨져요"로 돌아온다.
 */
export function buildCsv({ schema, rows, includeSensitive }: BuildCsvInput): string {
  const questions = allQuestions(schema).filter(
    (q) => q.type !== 'info' && (includeSensitive || !q.sensitive)
  );

  const header = [
    '접수번호',
    '접수일시',
    '상태',
    '학생 이름',
    '학년',
    '이메일',
    '연락처',
    '보호자',
    '경로',
    ...questions.map((q) => q.label.ko),
  ];
  if (!includeSensitive) header.push('건강 특이사항');
  header.push('운영 메모');

  const lines = [header.map(csvCell).join(',')];

  for (const r of rows) {
    let answers: Answers = {};
    try {
      answers = JSON.parse(r.answers_json) as Answers;
    } catch {
      answers = {};
    }

    const cells: unknown[] = [
      r.id,
      r.submitted_at,
      // 옆 칸들이 이미 사람 말이다('대리 입력'/'직접 제출'). 여기만 코드로 두면
      // 원장님이 여는 시트에 'new'·'reviewing' 이 그대로 실린다.
      responseStatusLabel(r.status),
      r.student_name,
      r.student_grade,
      r.email,
      r.phone,
      r.guardian_name,
      r.source === 'staff' ? '대리 입력' : '직접 제출',
      ...questions.map((q) => renderAnswer(schema, q.key, answers)),
    ];
    // 민감 열을 뺄 때도 "있음/없음"은 남긴다 — 확인할 사람이 있는지 알아야 한다.
    if (!includeSensitive) cells.push(r.has_medical ? '있음' : '');
    cells.push(r.internal_note);

    lines.push(cells.map(csvCell).join(','));
  }

  return '﻿' + lines.join('\r\n');
}
