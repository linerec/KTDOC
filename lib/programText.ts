/**
 * 수업 일정 문구 만들기 — 한/영 두 벌
 *
 * 구조화된 일정(요일 + 주차 + 시간)이 있으면 그걸로 "매주 화·목 16:00~17:30" 또는
 * "매월 둘째·넷째 주 일요일 15:45~16:30"을 짓고, 없으면 운영진이 자유 텍스트로 적어 둔
 * schedule_ko / schedule_en으로 물러선다. 캠프는 기간(시작~종료)이다.
 *
 * **캘린더와 같은 데이터를 읽어야 한다.** 여기가 뒤처지면 캘린더는 "9/12, 9/26"인데
 * 카드는 "매주 토"라고 말하는 화면이 된다 — 실제로 그 상태로 운영됐다.
 * 날짜 단위 예외(skip_dates/extra_dates)는 그 달에만 해당하므로 여기 문구에는 넣지
 * 않는다. 이 문구는 '규칙'이고, 예외는 캘린더가 날짜로 보여 준다.
 *
 * 서버에서 두 언어를 모두 지어 <LocaleText ko={} en={} />로 넘기는 쓰임을 전제한다.
 * 그래야 이 계산이 클라이언트 컴포넌트가 되지 않는다(순수 함수, React 의존 없음).
 * '내 수업' 카드와 수업 상세가 같은 함수를 쓴다 — 두 곳에 복사돼 있던 것을 모았다.
 */

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
const WEEKDAY_KO_FULL = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const WEEKDAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** 주차 1~5의 한국어 이름 — 학원이 쓰는 말("둘째·넷째 주")을 그대로 쓴다. */
const ORDINAL_KO: Record<string, string> = {
  '1': '첫째',
  '2': '둘째',
  '3': '셋째',
  '4': '넷째',
  '5': '다섯째',
};
const ORDINAL_EN: Record<string, string> = {
  '1': '1st',
  '2': '2nd',
  '3': '3rd',
  '4': '4th',
  '5': '5th',
};

/** 일정 문구를 지을 수 있는 최소 모양 — ProgramWithMeta·ProgramDetail 둘 다 만족한다 */
export interface SchedulableProgram {
  program_type: string;
  start_date?: string | null;
  end_date?: string | null;
  weekdays?: string | null;
  week_ordinals?: string | null;
  class_start_time?: string | null;
  class_end_time?: string | null;
  schedule_ko?: string | null;
  schedule_en?: string | null;
}

function csv(value: string | null | undefined): string[] {
  return (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatClassSchedule(p: SchedulableProgram, lang: 'ko' | 'en'): string {
  if (p.program_type === 'camp') {
    if (p.start_date && p.end_date) return `${p.start_date} ~ ${p.end_date}`;
    return p.start_date || '';
  }

  const days = csv(p.weekdays);
  if (days.length > 0) {
    const time = p.class_start_time
      ? ` ${p.class_start_time}${p.class_end_time ? `~${p.class_end_time}` : ''}`
      : '';
    // 주차가 지정된 격주·월2회 수업. 요일 이름을 풀어 쓴다 — "둘째·넷째 주 토"는 잘려 읽힌다.
    const ordinals = csv(p.week_ordinals)
      .filter((o) => (lang === 'en' ? ORDINAL_EN : ORDINAL_KO)[o])
      .sort();
    if (ordinals.length > 0) {
      if (lang === 'en') {
        const nth = ordinals.map((o) => ORDINAL_EN[o]).join(' & ');
        const label = days.map((d) => WEEKDAY_EN[Number(d)] ?? '').join(', ');
        return `${nth} ${label}${time}`;
      }
      const nth = ordinals.map((o) => ORDINAL_KO[o]).join('·');
      const label = days.map((d) => WEEKDAY_KO_FULL[Number(d)] ?? '').join('·');
      return `매월 ${nth} 주 ${label}${time}`;
    }

    const names = lang === 'en' ? WEEKDAY_EN : WEEKDAY_KO;
    const label = days.map((d) => names[Number(d)] ?? '').join(lang === 'en' ? ', ' : '·');
    return lang === 'en' ? `Every ${label}${time}` : `매주 ${label}${time}`;
  }

  return (lang === 'en' ? p.schedule_en || p.schedule_ko : p.schedule_ko) || '';
}
