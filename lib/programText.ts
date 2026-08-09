/**
 * 수업 일정 문구 만들기 — 한/영 두 벌
 *
 * 구조화된 일정(요일 + 시간)이 있으면 그걸로 "매주 화·목 16:00~17:30"을 짓고,
 * 없으면 운영진이 자유 텍스트로 적어 둔 schedule_ko / schedule_en으로 물러선다.
 * 캠프는 기간(시작~종료)이다.
 *
 * 서버에서 두 언어를 모두 지어 <LocaleText ko={} en={} />로 넘기는 쓰임을 전제한다.
 * 그래야 이 계산이 클라이언트 컴포넌트가 되지 않는다(순수 함수, React 의존 없음).
 * '내 수업' 카드와 수업 상세가 같은 함수를 쓴다 — 두 곳에 복사돼 있던 것을 모았다.
 */

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
const WEEKDAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** 일정 문구를 지을 수 있는 최소 모양 — ProgramWithMeta·ProgramDetail 둘 다 만족한다 */
export interface SchedulableProgram {
  program_type: string;
  start_date?: string | null;
  end_date?: string | null;
  weekdays?: string | null;
  class_start_time?: string | null;
  class_end_time?: string | null;
  schedule_ko?: string | null;
  schedule_en?: string | null;
}

export function formatClassSchedule(p: SchedulableProgram, lang: 'ko' | 'en'): string {
  if (p.program_type === 'camp') {
    if (p.start_date && p.end_date) return `${p.start_date} ~ ${p.end_date}`;
    return p.start_date || '';
  }

  const days = (p.weekdays || '').split(',').filter(Boolean);
  if (days.length > 0) {
    const names = lang === 'en' ? WEEKDAY_EN : WEEKDAY_KO;
    const label = days.map((d) => names[Number(d)] ?? '').join(lang === 'en' ? ', ' : '·');
    const time = p.class_start_time
      ? ` ${p.class_start_time}${p.class_end_time ? `~${p.class_end_time}` : ''}`
      : '';
    return lang === 'en' ? `Every ${label}${time}` : `매주 ${label}${time}`;
  }

  return (lang === 'en' ? p.schedule_en || p.schedule_ko : p.schedule_ko) || '';
}
