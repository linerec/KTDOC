/**
 * 인쇄물 도안 회신 — 질문과 답의 단일 소스
 *
 * 확인 화면(app/confirm/banner)과 접수 라우트(app/api/confirm/banner)가 같은
 * 정의를 본다. 화면에만 선택지를 더하면 서버가 그 답을 거부하고, 서버에만 더하면
 * 아무도 그 답을 고를 수 없다 — 어느 쪽이든 회신이 조용히 사라진다.
 *
 * 이 회신은 어디에도 저장되지 않는다. 메일 한 통이 전부이므로, 보낼 것이
 * 있는지(빈 회신이 아닌지)를 여기서 판정한다.
 */

export const NOTE_MAX = 4000;
export const SHORT_MAX = 40;
export const SENDER_MAX = 60;

export interface BannerChoiceOption {
  value: string;
  label: string;
}

export interface BannerQuestion {
  key: string;
  /** 화면에 뜨는 질문 — 메일 본문에도 이 말이 그대로 실린다 */
  label: string;
  /** 왜 여쭙는지 한 줄. 없으면 질문만 나온다 */
  help?: string;
  options: readonly BannerChoiceOption[];
}

/** 치수 칸 — 숫자를 강제하지 않는다. 실제 회신에 '28 1/2' 같은 표기가 온다. */
export interface BannerSizeField {
  key: string;
  label: string;
  placeholder: string;
}

export const BANNER_QUESTIONS: readonly BannerQuestion[] = [
  {
    key: 'layout',
    label: '3폭 배분',
    help: '기존은 ①로고 ②양국기 ③보조 문구 순서였습니다.',
    options: [
      { value: 'keep', label: '기존 구성 유지' },
      { value: 'redesign', label: '도안대로 새로 배분' },
    ],
  },
  {
    key: 'khpaf',
    label: 'KHPAF 노출 비중',
    help: '이번에 새로 들어가는 재단 로고입니다.',
    options: [
      { value: 'equal', label: 'KTDOC와 동등하게' },
      { value: 'sub', label: '보조로 작게' },
    ],
  },
  {
    key: 'flag_crop',
    label: '태극기·성조기 모양',
    help: '원형으로 자른 처리는 문화 행사에서 흔하지만, 미국 국기법(4 U.S.C. §8)은 국기 변형을 권하지 않습니다.',
    options: [
      { value: 'circle', label: '원형 그대로' },
      { value: 'rect', label: '원래 사각형으로' },
    ],
  },
  {
    key: 'double_side',
    label: '양면 인쇄',
    help: '퍼레이드는 양쪽에서 봅니다. 기존 배너는 단면이었습니다.',
    options: [
      { value: 'yes', label: '양면으로' },
      { value: 'no', label: '단면으로' },
      { value: 'ask', label: '인쇄소에 문의 후 결정' },
    ],
  },
  {
    key: 'drum_style',
    label: '북 배너 구성',
    help: '기존 두 장은 서로 달랐습니다(하나는 명칭, 하나는 국기와 무용수 그림).',
    options: [
      { value: 'unify', label: '한 벌로 통일' },
      { value: 'vary', label: '장마다 다르게' },
    ],
  },
] as const;

export const BANNER_SIZE_FIELDS: readonly BannerSizeField[] = [
  { key: 'parade_w', label: '퍼레이드 1폭 가로', placeholder: '인치' },
  { key: 'parade_h', label: '퍼레이드 1폭 세로', placeholder: '인치' },
  { key: 'drum_w', label: '북 배너 가로', placeholder: '인치' },
  { key: 'drum_h', label: '북 배너 세로', placeholder: '인치' },
  { key: 'drum_count', label: '북 배너 필요 매수', placeholder: '장' },
] as const;

export interface BannerFeedback {
  choices: Record<string, string>;
  sizes: Record<string, string>;
  note: string;
  sender: string;
}

export type ParseResult =
  | { ok: true; value: BannerFeedback }
  | { ok: false; error: string };

function text(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function record(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

/**
 * 들어온 회신을 정의에 맞춰 다듬는다.
 *
 * 모르는 선택지는 **거부**한다(무시하지 않는다). 무시하면 단장님 화면에서는
 * 고른 답이 메일에는 빠진 채 도착하고, 아무도 그 사실을 모른다.
 */
export function parseBannerFeedback(raw: unknown): ParseResult {
  const input = record(raw);
  const rawChoices = record(input.choices);
  const rawSizes = record(input.sizes);

  const choices: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawChoices)) {
    const answer = text(value);
    if (!answer) continue;
    const question = BANNER_QUESTIONS.find((q) => q.key === key);
    if (!question) return { ok: false, error: '알 수 없는 질문입니다.' };
    if (!question.options.some((o) => o.value === answer)) {
      return { ok: false, error: '알 수 없는 답입니다.' };
    }
    choices[key] = answer;
  }

  const sizes: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawSizes)) {
    const answer = text(value);
    if (!answer) continue;
    if (!BANNER_SIZE_FIELDS.some((f) => f.key === key)) {
      return { ok: false, error: '알 수 없는 칸입니다.' };
    }
    if (answer.length > SHORT_MAX) {
      return { ok: false, error: '치수는 짧게 적어 주세요.' };
    }
    sizes[key] = answer;
  }

  const note = text(input.note);
  if (note.length > NOTE_MAX) {
    return { ok: false, error: '남기신 말씀이 너무 깁니다.' };
  }

  const sender = text(input.sender).slice(0, SENDER_MAX);

  // 성함만 있는 회신은 회신이 아니다 — 받는 쪽에 아무 정보가 없다.
  const hasAnswer =
    Object.keys(choices).length > 0 || Object.keys(sizes).length > 0 || note !== '';
  if (!hasAnswer) {
    return { ok: false, error: '답을 하나 이상 골라 주시거나 의견을 남겨 주세요.' };
  }

  return { ok: true, value: { choices, sizes, note, sender } };
}

/** 메일 본문 — 답한 것만, 화면에서 읽으신 그 말 그대로. */
export function formatBannerFeedback(value: BannerFeedback): string {
  const lines: string[] = [];

  for (const question of BANNER_QUESTIONS) {
    const answer = value.choices[question.key];
    if (!answer) continue;
    const option = question.options.find((o) => o.value === answer);
    lines.push(`${question.label}: ${option ? option.label : answer}`);
  }

  const sizeLines = BANNER_SIZE_FIELDS.filter((f) => value.sizes[f.key]).map(
    (f) => `${f.label}: ${value.sizes[f.key]}`
  );
  if (sizeLines.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push(...sizeLines);
  }

  if (value.note) {
    if (lines.length > 0) lines.push('');
    lines.push('남기신 말씀:', value.note);
  }

  return lines.join('\n');
}
