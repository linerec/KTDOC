/**
 * 포스터 추출 결과의 필드 정규화 — LLM 출력 방어층
 *
 * `app/api/admin/ai/extract-event/route.ts`가 쓰던 인라인 헬퍼를 여기로 옮겼다.
 * 옮긴 이유는 **시험 가능하게 만들기 위해서다**: 시간 해석은 규칙이 많고(오전/오후,
 * 자정/정오, 마침표 있는 a.m., 콜론 없는 "7 PM"), 눈으로 읽어서는 맞는지 알 수 없다.
 * `eventFields.test.ts`가 실제 포스터 표기 사례로 이 함수들을 고정한다.
 *
 * 의존성이 없다 — `node --test lib/ai/eventFields.test.ts`로 바로 돈다.
 *
 * ── 왜 이 층이 필요한가 ───────────────────────────────────────────────────
 * LLM 출력은 신뢰할 수 없다. 특히 **오전/오후 변환을 모델에게 맡기면 조용히 12시간
 * 틀린 값이 들어온다** — 저녁 7시 공연이 07:00으로 저장되어도 형식은 멀쩡하므로
 * 아무 데서도 걸리지 않는다. 그래서 모델에게는 "자료에 인쇄된 표기 그대로"를 함께
 * 요구하고(`*_time_raw`), 12→24시간 변환은 이 파일이 결정론적으로 한다.
 */

/* ── 시간 ──────────────────────────────────────────────────────────────── */

export interface ParsedTime {
  /** 24시간 `HH:MM` */
  time: string;
  /**
   * 오전/오후가 자료에 **명시**돼 있었는가.
   *
   * `false`면 12시간 해석이 통째로 뒤집힐 수 있다는 뜻이다("7:30"만 있는 경우).
   * 이 표시가 있어야 아래 `reconcileEventTimes`가 "어느 값을 뒤집어도 되는지"를 안다.
   */
  explicit: boolean;
}

/**
 * 오전 표지. `a.m.` `A.M.` `am` 과 한국어 오전·아침·새벽.
 *
 * 앞뒤 글자 경계를 요구하는 이유: 경계가 없으면 `am`이 영어 단어 속(`program`,
 * `chamber`)에서 걸린다. 장소명이 시간 필드에 섞여 들어오는 일이 실제로 있어
 * 방어가 필요하다.
 */
const AM_RE = /(?<![a-z])a\.?\s?m\.?(?![a-z])|오전|아침|새벽/i;

/**
 * 오후 표지. `낮`을 여기 두는 것이 맞다 — "낮 2시"는 14시이고, "낮 12시"는 정오라
 * 12시간 규칙(12 → 12)이 그대로 들어맞는다.
 *
 * `밤`은 예외가 하나 있다: "밤 12시"는 자정(00:00)이다. 아래에서 따로 처리한다.
 */
const PM_RE = /(?<![a-z])p\.?\s?m\.?(?![a-z])|오후|저녁|밤|야간|낮/i;

/** "밤 12시"만을 위한 표지. 관용적으로 자정을 가리킨다. */
const NIGHT_RE = /밤|심야/;

/**
 * 시각 표기를 24시간 `HH:MM`으로 정규화한다.
 *
 * 받는 형태: `19:30` · `7:30 PM` · `7:30 p.m.` · `7 PM` · `오후 7시` ·
 * `오후 7시 30분` · `저녁 7시` · `14시` · `자정` · `정오`
 *
 * 콜론이 없어도 받는다. 예전 정규식은 `[:시]`를 **요구**해서 포스터에 흔한
 * "7 PM"이 통째로 버려졌다(시간이 null이 되어 관리자가 다시 입력해야 했다).
 */
export function parseTime(value: unknown): ParsedTime | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (!t) return null;

  // 숫자 없이 단어만 있는 표기. 아래 숫자 추출이 걸리지 않으므로 먼저 처리한다.
  if (/자정/.test(t) && !/\d/.test(t)) return { time: '00:00', explicit: true };
  if (/정오/.test(t) && !/\d/.test(t)) return { time: '12:00', explicit: true };

  const isAm = AM_RE.test(t);
  const isPm = PM_RE.test(t);
  // 둘 다 걸리는 입력은 신뢰할 수 없다("오전 7시~오후 9시" 같은 구간 문자열).
  // 한쪽을 임의로 고르면 조용히 틀리므로 거부하고 관리자에게 넘긴다.
  if (isAm && isPm) return null;

  const m = t.match(/(\d{1,2})\s*(?:[:시]\s*(\d{1,2}))?/);
  if (!m) return null;

  let hour = Number(m[1]);
  const minute = m[2] !== undefined ? Number(m[2]) : 0;
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (minute > 59) return null;

  let explicit = isAm || isPm;

  if (isPm) {
    if (hour === 12) {
      // "밤 12시" = 자정. "낮/오후 12시" = 정오.
      if (NIGHT_RE.test(t)) hour = 0;
    } else if (hour < 12) {
      hour += 12;
    }
    // hour > 12 인데 오후 표지가 붙은 경우("오후 19시")는 이미 24시간 표기다 → 그대로.
  } else if (isAm) {
    if (hour === 12) hour = 0; // "오전 12시" = 자정
  } else {
    // 표지가 없다. 13~23시와 0시는 24시간 표기로만 나올 수 있으므로 확정이다.
    // 1~12시는 12시간 표기일 수 있어 **뒤집힐 여지**를 남긴다.
    explicit = hour === 0 || hour >= 13;
  }

  if (hour > 23) return null;
  return {
    time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    explicit,
  };
}

/** `HH:MM` → 자정 기준 분. 정렬·비교용. */
export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** 자정 기준 분 → `HH:MM`. */
function fromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/* ── 시간 3종 교차 검증 ────────────────────────────────────────────────── */

export type TimeKey = 'call_time' | 'start_time' | 'end_time';

/** 순서 제약의 근거가 되는 배열. 집합 → 시작 → 종료 순으로 흐른다. */
const TIME_ORDER: readonly TimeKey[] = ['call_time', 'start_time', 'end_time'];

export interface ReconcileInput {
  call_time: ParsedTime | null;
  start_time: ParsedTime | null;
  end_time: ParsedTime | null;
}

export interface ReconcileResult {
  call_time: string | null;
  start_time: string | null;
  end_time: string | null;
  /** 12시간 뒤집기가 적용된 필드. 관리자에게 "확인하라"고 알리는 근거다. */
  adjusted: TimeKey[];
  /** 순서를 만족시키지 못했다 — 사람이 봐야 한다. */
  inconsistent: boolean;
}

/**
 * 공연 시각이 만족해야 하는 상식(집합 ≤ 시작 ≤ 종료)으로 오전/오후를 되짚는다.
 *
 * 이것이 이 파일의 핵심이다. 포스터에 "7:30"처럼 표지 없이 적힌 시각은 07:30일 수도
 * 19:30일 수도 있고, 모델은 그 자리에서 자주 틀린다. 그런데 **세 값을 함께 보면
 * 대개 답이 하나로 좁혀진다** — 집합 18:00 / 시작 07:30 / 종료 21:00 이 들어오면
 * 시작만 07:30 → 19:30으로 뒤집어야 순서가 성립한다.
 *
 * 규칙:
 *   1. `explicit`(자료에 오전/오후가 적힌) 값은 **건드리지 않는다**. 자료가 이긴다.
 *   2. 나머지 값은 +12시간 뒤집기 후보를 갖는다(24시를 넘지 않는 한).
 *   3. 순서를 만족하는 조합 중, 시작 시각이 공연다운 시간대(정오~22시)에 오는 것을
 *      고른다. 학원 공연·행사는 압도적으로 오후·저녁이다.
 *   4. 그다음 **행사 전체 길이가 짧은** 쪽을 고른다. 순서만 보면 집합 06:00 / 시작
 *      19:00도 성립하지만(집합이 13시간 전이다) 그런 행사는 없다. 이 기준이 없으면
 *      "덜 바뀐 쪽"을 고르다가 집합 시각만 새벽에 남는다 — 실제로 시험이 잡았다.
 *   5. 그래도 동점이면 원본에서 덜 바뀐 쪽 — 근거 없이 값을 흔들지 않는다.
 *   6. 어떤 조합도 순서를 만족하지 못하면 원본을 그대로 두고 `inconsistent`를 세운다.
 *      임의로 고친 값보다 "확인이 필요하다"는 신호가 낫다.
 */
export function reconcileEventTimes(input: ReconcileInput): ReconcileResult {
  const present = TIME_ORDER.filter((k) => input[k] !== null);

  const base: Record<TimeKey, string | null> = {
    call_time: input.call_time?.time ?? null,
    start_time: input.start_time?.time ?? null,
    end_time: input.end_time?.time ?? null,
  };

  if (present.length === 0) {
    return { ...base, adjusted: [], inconsistent: false };
  }

  /** 각 필드가 가질 수 있는 값들. explicit이면 하나뿐이다. */
  const options: Record<string, number[]> = {};
  for (const key of present) {
    const parsed = input[key]!;
    const minutes = toMinutes(parsed.time);
    if (parsed.explicit) {
      options[key] = [minutes];
    } else {
      const flipped = minutes + 12 * 60;
      options[key] = flipped <= 23 * 60 + 59 ? [minutes, flipped] : [minutes];
    }
  }

  // 후보는 최대 2^3 = 8가지다. 전수 탐색이 가장 단순하고 확실하다.
  interface Candidate {
    values: Record<string, number>;
    /** 시작 시각이 공연다운 시간대인가 (클수록 좋다) */
    plausible: number;
    /** 행사 전체 길이(분). 작을수록 좋다 */
    span: number;
    /** 원본에서 바뀐 필드 수. 작을수록 좋다 */
    changes: number;
  }
  let best: Candidate | null = null;

  const better = (a: Candidate, b: Candidate | null): boolean => {
    if (b === null) return true;
    if (a.plausible !== b.plausible) return a.plausible > b.plausible;
    if (a.span !== b.span) return a.span < b.span;
    return a.changes < b.changes;
  };

  const walk = (index: number, chosen: Record<string, number>) => {
    if (index === present.length) {
      // 순서 검사 — 있는 값들만 비교한다.
      const seq = present.map((k) => chosen[k]);
      for (let i = 1; i < seq.length; i++) {
        if (seq[i] < seq[i - 1]) return;
      }
      // 시작(없으면 집합)이 공연다운 시간대에 있는가.
      const anchor = chosen.start_time ?? chosen.call_time ?? chosen.end_time;
      const candidate: Candidate = {
        values: { ...chosen },
        plausible: anchor >= 12 * 60 && anchor <= 22 * 60 ? 1 : 0,
        span: Math.max(...seq) - Math.min(...seq),
        changes: present.filter((k) => chosen[k] !== toMinutes(input[k]!.time)).length,
      };
      if (better(candidate, best)) best = candidate;
      return;
    }
    const key = present[index];
    for (const v of options[key]) {
      chosen[key] = v;
      walk(index + 1, chosen);
    }
    delete chosen[key];
  };
  walk(0, {});

  if (best === null) {
    // 순서를 만족하는 조합이 없다. 값을 지어내지 않고 그대로 넘긴다.
    return { ...base, adjusted: [], inconsistent: true };
  }

  const picked = (best as { values: Record<string, number> }).values;
  const out: Record<TimeKey, string | null> = { ...base };
  const adjusted: TimeKey[] = [];
  for (const key of present) {
    const chosen = picked[key];
    if (chosen !== toMinutes(input[key]!.time)) adjusted.push(key);
    out[key] = fromMinutes(chosen);
  }

  return { ...out, adjusted, inconsistent: false };
}

/* ── 장소 ──────────────────────────────────────────────────────────────── */

/**
 * 주소로 볼 만한 문자열인가.
 *
 * 장소명과 주소가 한 줄에 붙어 오는 일이 잦다("Bergen PAC, 30 N Van Brunt St,
 * Englewood, NJ 07631"). 모델이 그것을 통째로 `location`에 넣어 버리면 주소 칸이
 * 비고, 화면에는 "오시는 길"이 뜨지 않는다. 아래 `splitVenueAndAddress`가 그 경우를
 * 되살리는데, 그 판정 기준이 이 함수다.
 */
export function looksLikeAddress(value: string): boolean {
  const t = value.trim();
  if (t.length < 6) return false;
  return (
    // 미국식: 번지 + 도로 약어, 또는 주 약어 + ZIP
    /\d+\s+[\w.'-]+\s+(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|pl|place|pkwy|parkway|hwy|highway)\b/i.test(t) ||
    /\b[A-Z]{2}\s+\d{5}(-\d{4})?\b/.test(t) ||
    // 한국식: 도로명·지번
    /(로|길)\s*\d+/.test(t) ||
    /\d+\s*(번지|가)\b/.test(t) ||
    /(특별시|광역시|자치시|자치도|[가-힣]{2,}시|[가-힣]{2,}군|[가-힣]{2,}구)\s/.test(t)
  );
}

export interface VenueSplit {
  location: string | null;
  location_address: string | null;
  /** 붙어 있던 것을 갈랐는가 — 관리자에게 확인을 청하는 근거다. */
  split: boolean;
}

/**
 * 장소명과 주소가 한 필드에 뭉쳐 온 경우를 가른다.
 *
 * 이미 둘 다 채워져 있으면 손대지 않는다 — 모델이 제대로 나눈 것을 다시 섞을 이유가
 * 없다. 주소가 비어 있고 장소명 쪽이 주소처럼 보일 때만 개입한다.
 *
 * 가르는 지점은 **첫 쉼표 중 뒤쪽이 주소처럼 보이는 곳**이다. 쉼표가 없으면 가르지
 * 않는다 — 근거 없이 문자열을 자르면 장소명이 잘려 나간다.
 */
export function splitVenueAndAddress(
  location: string | null,
  address: string | null,
): VenueSplit {
  if (address || !location) return { location, location_address: address, split: false };
  if (!looksLikeAddress(location)) {
    return { location, location_address: null, split: false };
  }

  const parts = location.split(',');
  for (let i = 1; i < parts.length; i++) {
    const head = parts.slice(0, i).join(',').trim();
    const tail = parts.slice(i).join(',').trim();
    if (head && tail && looksLikeAddress(tail)) {
      return { location: head, location_address: tail, split: true };
    }
  }

  // 쉼표로 가를 수 없다. 통째로 주소 칸에 넣는 편이 낫다 — "오시는 길"이 살아난다.
  return { location: null, location_address: location.trim(), split: true };
}
