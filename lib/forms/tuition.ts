/**
 * lib/forms/tuition.ts — 학비표 조회 보조 (운영자 화면 전용)
 *
 * **계산하지 않는다. 표에서 찾아 줄 뿐이다.**
 *
 * 패키지가는 산식이 아니라 조합마다 다른 확정 금액이다 — 1 Dance($400) +
 * Kids Drum 1($400)은 $800이 아니라 $650이고, 1 Dance 1년은 400×4×0.8=$1,280이
 * 아니라 $1,140이다. 행마다 규칙이 다르므로 **룩업 테이블만이 표를 재현한다.**
 *
 * 표에 없는 조합은 null 이고, 그것은 **오류가 아니라 정상 상태**다.
 * 화면은 "표에 없는 조합 — 개별 확인"으로 정직하게 빠진다.
 *
 * 신청자에게는 절대 보이지 않는다. 학비는 지금처럼 확인 후 개별 안내한다.
 * 출처: docs/superpowers/specs/2026-08-13-registration-forms-source.md §C
 *
 * ※ node --test 가 @/ 별칭을 풀지 못하므로 import 는 상대 경로 + .ts 로.
 */

import type { Answers, FormQuestion } from '../../types/forms.ts';

export type TuitionPeriod = 'm3' | 'm6' | 'y1';

export interface TuitionRow {
  /** 정렬된 코스 코드 조합 */
  courses: string[];
  /** 학비표에 적힌 이름 그대로 */
  label: string;
  m3: number;
  m6: number;
  y1: number;
}

/** 조합을 키로 만든다 — 고른 순서와 무관하게 같은 행을 찾기 위해 정렬한다. */
function key(courses: string[]): string {
  return [...courses].sort().join('+');
}

const ROWS: TuitionRow[] = [
  // ── SINGLE COURSE
  { courses: ['dance_1'], label: '1 Dance Course', m3: 400, m6: 720, y1: 1140 },
  { courses: ['kids_drum_1'], label: 'Kids Drum 1 (1-Drum Nanta)', m3: 400, m6: 720, y1: 1140 },
  { courses: ['kids_drum_3'], label: 'Kids Drum 3 (3-Drum Nanta)', m3: 450, m6: 810, y1: 1260 },
  { courses: ['drums_3'], label: '3 Standing Drums (삼고무/동고)', m3: 600, m6: 1080, y1: 1680 },
  { courses: ['drums_5'], label: '5 Standing Drums (오고무)', m3: 700, m6: 1260, y1: 1960 },
  { courses: ['mega_drum'], label: 'Mega Drum (모듬북)', m3: 650, m6: 1170, y1: 1830 },

  // ── TAKE 2 COURSES
  { courses: ['dance_1', 'kids_drum_1'], label: '1 Dance + Kids Drum 1', m3: 650, m6: 1180, y1: 1830 },
  { courses: ['dance_1', 'kids_drum_3'], label: '1 Dance + Kids Drum 3', m3: 680, m6: 1225, y1: 2175 },
  { courses: ['dance_1', 'dance_1'], label: '2 Dance Courses', m3: 650, m6: 1180, y1: 1830 },
  { courses: ['dance_1', 'drums_3'], label: '1 Dance + 3 Standing Drums', m3: 750, m6: 1350, y1: 2100 },
  { courses: ['dance_1', 'drums_5'], label: '1 Dance + 5 Standing Drums', m3: 850, m6: 1550, y1: 2380 },
  { courses: ['dance_1', 'mega_drum'], label: '1 Dance + Mega Drum', m3: 800, m6: 1450, y1: 2250 },
  { courses: ['drums_3', 'mega_drum'], label: 'Mega Drum + 3 Standing Drums', m3: 900, m6: 1620, y1: 2530 },
  { courses: ['drums_5', 'mega_drum'], label: 'Mega Drum + 5 Standing Drums', m3: 1000, m6: 1800, y1: 2800 },

  // ── TAKE 3 COURSES
  { courses: ['dance_1', 'kids_drum_1', 'drums_3'], label: '1 Dance + Kids Drum 1 + 3 Standing Drums', m3: 1000, m6: 1800, y1: 2800 },
  { courses: ['dance_1', 'kids_drum_3', 'drums_3'], label: '1 Dance + Kids Drum 3 + 3 Standing Drums', m3: 1100, m6: 1980, y1: 3080 },
  { courses: ['dance_1', 'dance_1', 'drums_3'], label: '2 Dance Courses + 3 Standing Drums', m3: 1000, m6: 1800, y1: 2800 },
  { courses: ['dance_1', 'dance_1', 'drums_5'], label: '2 Dance Courses + 5 Standing Drums', m3: 1150, m6: 2070, y1: 3220 },
  { courses: ['dance_1', 'dance_1', 'mega_drum'], label: '2 Dance Courses + Mega Drum', m3: 1100, m6: 1980, y1: 3080 },
  { courses: ['dance_1', 'drums_3', 'mega_drum'], label: '1 Dance + 3 Standing Drums + Mega Drum', m3: 1200, m6: 2160, y1: 3360 },
  { courses: ['dance_1', 'drums_5', 'mega_drum'], label: '1 Dance + 5 Standing Drums + Mega Drum', m3: 1300, m6: 2340, y1: 3640 },

  // ── TAKE 4 COURSES
  { courses: ['dance_1', 'dance_1', 'drums_3', 'mega_drum'], label: '2 Dance Courses + Mega Drum + 3 Standing Drums', m3: 1400, m6: 2520, y1: 3920 },
  { courses: ['dance_1', 'dance_1', 'drums_5', 'mega_drum'], label: '2 Dance Courses + Mega Drum + 5 Standing Drums', m3: 1500, m6: 2700, y1: 4200 },
];

const BY_KEY = new Map(ROWS.map((r) => [key(r.courses), r]));

export interface TuitionLookup {
  label: string;
  amount: number;
  period: TuitionPeriod;
}

/**
 * 고른 과목의 코스 코드 조합 + 기간 → 학비표의 해당 행.
 * 코드가 하나라도 비어 있으면 조회하지 않는다 — 틀린 금액을 보여주느니
 * 모른다고 하는 편이 낫다.
 */
export function lookupTuition(
  courseCodes: Array<string | undefined | null>,
  period: TuitionPeriod
): TuitionLookup | null {
  if (courseCodes.length === 0) return null;
  if (courseCodes.some((c) => !c)) return null;

  const row = BY_KEY.get(key(courseCodes as string[]));
  if (!row) return null;
  return { label: row.label, amount: row[period], period };
}

/* ── 응답 한 건 → 학비표 행 ──────────────────────────────────────────────
   목록과 상세가 각자 조립하면 두 화면이 다른 금액을 말하는 날이 온다.
   조립은 여기 한 곳에서만 한다. */

/** 기간 문항 찾기 — 신청서마다 키가 다를 수 있어 이름으로 찾는다(roster 도 같은 규칙). */
export function findPeriodQuestion(questions: FormQuestion[]): FormQuestion | undefined {
  return questions.find((q) => q.key.includes('period') && q.type === 'single');
}

/** 기간 라벨 — 운영 화면에서 금액 옆에 붙는다. */
export const PERIOD_LABEL_KO: Record<TuitionPeriod, string> = {
  m3: '3개월',
  m6: '6개월',
  y1: '1년',
};

/**
 * 고른 등록 기간. 금액을 못 찾는 응답에도 기간은 보여 줄 수 있어 따로 둔다.
 * 기간 문항이 없는 신청서(특강·설문)에서는 null 이다.
 */
export function periodOf(questions: FormQuestion[], answers: Answers): TuitionPeriod | null {
  const periodQuestion = findPeriodQuestion(questions);
  if (!periodQuestion) return null;
  const value = answers[periodQuestion.key];
  return value === 'm3' || value === 'm6' || value === 'y1' ? value : null;
}

/**
 * 응답 한 건(답 + 고른 과목 키)에서 학비표 행을 찾는다.
 *
 * 못 찾는 경우가 여럿이고 전부 정상이다 — 기간을 아직 안 골랐다, 기간 문항이
 * 없는 신청서다(특강·설문), 지금 문안에 없는 옛 선택지다, 학비표에 자리가 없는
 * 과목이 섞였다. 어느 쪽이든 null 이고, 화면은 "개별 확인"으로 정직하게 빠진다.
 */
export function tuitionForResponse(
  questions: FormQuestion[],
  answers: Answers,
  optionKeys: string[]
): TuitionLookup | null {
  const period = periodOf(questions, answers);
  if (!period) return null;

  // 지금 문안에서 못 찾은 선택지는 undefined 가 되고, lookupTuition 이 null 로 받는다.
  const options = questions.flatMap((q) => q.options ?? []);
  const courseCodes = optionKeys.map((k) => options.find((o) => o.key === k)?.courseCode);

  return lookupTuition(courseCodes, period);
}

/** '*2 Dance Courses (Sat + Sun Combination Package)' — 조건이 미확정이라 표에 넣지 않았다. */
export const SAT_SUN_COMBO_NOTE =
  '토요일 + 일요일 조합 패키지($580 / 3개월)가 학비표에 따로 있습니다. 해당 여부는 확인이 필요합니다.';
