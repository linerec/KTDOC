/**
 * 정규 수업·캠프를 달력 날짜로 전개 — 캘린더('내 수업' 통합)·아카이브 표시용.
 *
 * 정규 수업(class/program): weekdays(0=일 ~ 6=토) + 학기 기간(term_start~term_end)으로
 *   해당 월의 각 요일 날짜에 매주 반복 표시. 학기 기간이 비면 상시(그 달 전체에 매주).
 * 캠프(camp): start_date~end_date 기간 내 매일 표시.
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
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function timeLabel(start: string | null, end: string | null): string | null {
  if (start && end) return `${start}~${end}`;
  return start || null;
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

  const push = (date: string, occ: ClassOccurrence) => {
    const list = byDate.get(date) ?? [];
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
          });
        }
      }
      continue;
    }

    // 정규 수업(class/program): 요일이 있어야 캘린더에 전개된다.
    const days = (p.weekdays || '').split(',').filter(Boolean);
    if (days.length === 0) continue;
    const daySet = new Set(days);
    const termStart = p.term_start_date ? p.term_start_date.slice(0, 10) : null;
    const termEnd = p.term_end_date ? p.term_end_date.slice(0, 10) : null;
    const time = timeLabel(p.class_start_time, p.class_end_time);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${monthPrefix}-${pad(d)}`;
      if (termStart && date < termStart) continue;
      if (termEnd && date > termEnd) continue;
      const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay(); // 0=일
      if (!daySet.has(String(dow))) continue;
      push(date, {
        date,
        programId: p.id,
        slug: p.slug,
        title_ko: p.title_ko,
        title_en: p.title_en,
        time,
        isCamp: false,
      });
    }
  }

  return byDate;
}
