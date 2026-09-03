/**
 * 정규 수업·캠프를 달력 날짜로 전개 — 캘린더('내 수업' 통합)·아카이브 표시용.
 *
 * 정규 수업(class/program): weekdays(0=일 ~ 6=토) + 학기 기간(term_start~term_end)으로
 *   해당 월의 각 요일 날짜에 반복 표시. 학기 기간이 비면 상시(그 달 전체).
 *   week_ordinals가 있으면 그 주차에만 — "매월 둘째·넷째 주 일요일"이 이걸로 표현된다.
 *   skip_dates/extra_dates는 규칙이 흔들리는 달의 예외(휴강·보강·주차 이동)다.
 * 캠프(camp): start_date~end_date 기간 내 매일 표시.
 *
 * **"이 날 수업이 있나"는 classMeetsOn 하나만 답한다.** 캘린더·카드·미리보기가 전부
 * 같은 함수를 지난다. 판정을 화면마다 다시 짜면 어긋나고, 어긋난 쪽은 늘 "있다"는
 * 쪽이다 — 없는 수업을 보고 학원에 오는 일이 실제로 이 시스템에서 벌어졌다.
 *
 * 순수 함수(저장소 접근 없음). enrollment는 lib/d1/enrollments로 조회해 넘긴다.
 */

import type { MyEnrollment } from '@/types/programs';

export interface ClassOccurrence {
  date: string; // YYYY-MM-DD
  programId: number;
  slug: string;
  title_ko: string;
  /** 영문 제목(비어 있으면 null) — 캘린더가 언어에 맞춰 고른다 */
  title_en: string | null;
  time: string | null; // "HH:MM" 또는 "HH:MM~HH:MM" (캠프는 null=종일)
  isCamp: boolean;
  /**
   * 이 수업이 누구의 배정인지(user_id 목록). 학부모 캘린더는 자녀 여러 명을
   * 한꺼번에 전개하므로, 형제가 같은 수업이면 항목 하나에 둘 다 담긴다 —
   * 두 줄로 중복 표시되는 대신 "누구의 수업인지"를 붙일 근거가 된다.
   */
  owners: string[];
}

/** 반복 규칙을 판정하는 데 필요한 최소 모양 — Program·ProgramWithMeta가 모두 만족한다. */
export interface ClassRecurrence {
  weekdays?: string | null;
  /** 쉼표구분 주차(1~5). 비우면 매주. */
  week_ordinals?: string | null;
  /** 쉼표구분 'YYYY-MM-DD' — 이 날은 쉰다. */
  skip_dates?: string | null;
  /** 쉼표구분 'YYYY-MM-DD' — 규칙과 무관하게 이 날은 한다. */
  extra_dates?: string | null;
  term_start_date?: string | null;
  term_end_date?: string | null;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function timeLabel(start: string | null, end: string | null): string | null {
  if (start && end) return `${start}~${end}`;
  return start || null;
}

/** 쉼표구분 문자열 → 다듬은 값 집합(빈 값 제거). */
export function parseCsvSet(value: string | null | undefined): Set<string> {
  return new Set(
    (value || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

/**
 * 그 달에서 이 날이 같은 요일 중 몇 번째인가(1~5).
 * 1~7일=1주, 8~14일=2주 … — "둘째 주 토요일"의 통상적인 뜻과 같다.
 */
export function weekOrdinalOfMonth(day: number): number {
  return Math.floor((day - 1) / 7) + 1;
}

/**
 * 이 수업이 그 날 열리는가.
 *
 * 판정 순서(앞이 이긴다):
 *   1. skip_dates      — 쉰다고 적었으면 무조건 쉰다
 *   2. extra_dates     — 하겠다고 적었으면 학기·요일·주차와 무관하게 한다
 *                        (사람이 날짜를 직접 적은 것이다. 조용히 삼키지 않는다)
 *   3. 학기 기간(term) — 시작 전/종료 후면 없다
 *   4. 요일            — 내 요일이 아니면 없다
 *   5. 주차(ordinal)   — 지정돼 있으면 그 주차에만
 */
export function classMeetsOn(p: ClassRecurrence, date: string): boolean {
  if (parseCsvSet(p.skip_dates).has(date)) return false;
  if (parseCsvSet(p.extra_dates).has(date)) return true;

  const termStart = p.term_start_date ? p.term_start_date.slice(0, 10) : null;
  const termEnd = p.term_end_date ? p.term_end_date.slice(0, 10) : null;
  if (termStart && date < termStart) return false;
  if (termEnd && date > termEnd) return false;

  const days = parseCsvSet(p.weekdays);
  if (days.size === 0) return false;
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0=일
  if (!days.has(String(dow))) return false;

  const ordinals = parseCsvSet(p.week_ordinals);
  if (ordinals.size === 0) return true; // 주차 미지정 = 매주
  const day = Number(date.slice(8, 10));
  return ordinals.has(String(weekOrdinalOfMonth(day)));
}

/**
 * 특정 월(year, month=1~12)에서 이 수업이 열리는 날짜들 — 'YYYY-MM-DD' 오름차순.
 * 편집 화면 미리보기가 캘린더와 같은 답을 보도록 함께 내보낸다.
 */
export function classDatesInMonth(
  p: ClassRecurrence,
  year: number,
  month: number
): string[] {
  const monthPrefix = `${year}-${pad(month)}`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dates: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${monthPrefix}-${pad(d)}`;
    if (classMeetsOn(p, date)) dates.push(date);
  }
  return dates;
}

/**
 * 특정 월(year, month=1~12)에서 내 수업들을 날짜별로 전개한다.
 * 반환: 'YYYY-MM-DD' → 그 날의 수업 항목 배열.
 */
export function expandClassesForMonth(
  enrollments: MyEnrollment[],
  year: number,
  month: number
): Map<string, ClassOccurrence[]> {
  const monthPrefix = `${year}-${pad(month)}`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const byDate = new Map<string, ClassOccurrence[]>();

  // 같은 날짜의 같은 프로그램은 한 항목으로 접고 소유자만 보탠다.
  const push = (date: string, occ: ClassOccurrence) => {
    const list = byDate.get(date) ?? [];
    const existing = list.find((o) => o.programId === occ.programId);
    if (existing) {
      for (const owner of occ.owners) {
        if (!existing.owners.includes(owner)) existing.owners.push(owner);
      }
      return;
    }
    list.push(occ);
    byDate.set(date, list);
  };

  for (const e of enrollments) {
    if (e.status === 'cancelled') continue;
    const p = e.program;

    if (p.program_type === 'camp') {
      if (!p.start_date) continue;
      const start = p.start_date.slice(0, 10);
      const end = (p.end_date || p.start_date).slice(0, 10);
      for (let d = 1; d <= daysInMonth; d++) {
        const date = `${monthPrefix}-${pad(d)}`;
        if (date >= start && date <= end) {
          push(date, {
            date,
            programId: p.id,
            slug: p.slug,
            title_ko: p.title_ko,
            title_en: p.title_en,
            time: null,
            isCamp: true,
            owners: [e.user_id],
          });
        }
      }
      continue;
    }

    // 정규 수업(class/program): 요일이나 추가 날짜가 있어야 캘린더에 전개된다.
    if (!p.weekdays && !p.extra_dates) continue;
    const time = timeLabel(p.class_start_time, p.class_end_time);

    for (const date of classDatesInMonth(p, year, month)) {
      push(date, {
        date,
        programId: p.id,
        slug: p.slug,
        title_ko: p.title_ko,
        title_en: p.title_en,
        time,
        isCamp: false,
        owners: [e.user_id],
      });
    }
  }

  return byDate;
}
