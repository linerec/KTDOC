/**
 * 한국어 → 영어 초벌 번역 — 한 번의 질의로 여러 칸을 함께 옮긴다
 *
 * 관리 콘솔의 콘텐츠 필드는 대부분 `_ko`/`_en` 두 벌이다. 운영진은 한국어로 쓰고
 * 영문 칸은 비워 두는데, 그 칸이 비면 영어가 편한 가족에게는 안내가 닿지 않는다.
 * 손으로 옮겨 적게 하는 대신 **초벌을 채워 주고 사람이 확정**한다.
 *
 * ── 왜 한 요청에 여러 칸을 함께 보내는가 ─────────────────────────────────
 * 제목·준비물·설명은 같은 공연을 말한다. 따로 부르면 같은 작품 이름이 칸마다
 * 다르게 번역된다("삼고무" → Samgomu / Three-Drum Dance / Samgo-mu). 한 번에
 * 보내면 모델이 문맥을 보고 이름을 통일하고, 질의도 한 번으로 끝난다.
 *
 * ── 왜 이 파일은 D1·네트워크를 모르는가 ──────────────────────────────────
 * 프롬프트를 짜고 응답을 해석하는 판단만 둔다(시험 가능). 실제 질의는
 * `app/api/admin/ai/translate/route.ts`가 askAI('text.polish', …)로 한다.
 * 모델 지정은 관리 콘솔 > AI 설정의 '문구 다듬기 · 번역 보조'가 주인이다.
 */

/** 번역할 칸 하나 — key는 호출부가 결과를 되돌려 꽂을 이름이다 */
export interface TranslateField {
  /** 결과를 받을 이름. 보통 영문 칸의 필드명(예: 'prep_notes_en') */
  key: string;
  /** 모델에게 "이게 무슨 칸인지" 알려 주는 한국어 라벨(예: '준비물 · 복장 · 안내') */
  label: string;
  /** 옮길 한국어 원문 */
  ko: string;
}

/** 번역 결과 — 값을 얻지 못한 key는 아예 담기지 않는다(부분 성공 허용) */
export type TranslateResult = Record<string, string>;

/** 한 칸당 받아들이는 최대 길이 — 넘치면 자른다(프롬프트 폭주·비용 방지) */
export const MAX_FIELD_CHARS = 4000;
/** 한 번에 옮기는 칸 수 상한 */
export const MAX_FIELDS = 12;

/**
 * 시스템 지시 — 번역기의 성격을 고정한다.
 *
 * '자연스럽게 다듬어라'가 아니라 '옮겨라'인 이유: 이 값은 공연 전날 안내로 나가는
 * 실무 문구다. 모델이 문장을 늘리거나 없는 약속을 보태면(“Snacks will be provided”)
 * 사람이 하지 않은 말이 학부모에게 나간다. 원문에 있는 것만 옮긴다.
 */
export const TRANSLATE_SYSTEM = [
  '당신은 한국 전통무용 학원의 안내문을 영어로 옮기는 번역가입니다.',
  '수신자는 미국에 사는 학부모와 학생이며, 대부분 한국 무용 용어에 익숙하지 않습니다.',
  '',
  '지켜야 할 것:',
  '- 원문에 있는 사실만 옮깁니다. 문장을 보태거나 없는 약속을 만들지 않습니다.',
  '- 줄바꿈·목록·번호 매김 등 원문의 구조를 그대로 유지합니다.',
  '- 시간·날짜·숫자는 원문 그대로 둡니다(형식을 바꾸지 않습니다).',
  '- 작품명·전통 용어는 로마자 표기 뒤에 괄호로 짧은 설명을 답니다',
  '  (예: 삼고무 → Samgomu (three-drum dance)). 같은 이름은 칸이 달라도 같게 씁니다.',
  '- 존댓말 안내는 정중하지만 간결한 영어로 옮깁니다(과장·마케팅 어투 금지).',
  '- 칸 이름은 문맥을 알려 주는 표지일 뿐입니다. 번역문에 제목으로 붙이지 마세요.',
  '- 원문에 없는 제목·머리말·맺음말을 만들지 않습니다. 원문이 한 줄이면 번역도 한 줄입니다.',
].join('\n');

/**
 * 번역 요청 프롬프트 — 칸마다 이름을 붙여 문맥을 주고, JSON 한 덩이로 받는다.
 *
 * 칸 이름과 원문을 확실히 갈라 놓는다(이름은 따로 줄에, 원문은 울타리 안에).
 * 예전에는 `[key] 라벨` 다음 줄에 본문을 이어 붙였는데, 모델이 그 라벨을 **제목으로
 * 읽고** 번역문 맨 앞에 "What to Bring · Attire · Information"을 붙여 돌려줬다 —
 * 운영진이 적지 않은 제목이 학부모 안내에 생겨난다.
 */
export function buildTranslatePrompt(fields: TranslateField[]): string {
  return [
    '아래 칸들은 같은 항목(공연·수업 등)의 서로 다른 부분입니다. 문맥을 함께 보고 영어로 옮기세요.',
    '',
    '각 칸은 이렇게 적혀 있습니다:',
    '  key      — 응답 JSON에서 쓸 이름',
    '  칸 이름   — 이 글이 무엇인지 알려 주는 표지. **번역 대상이 아닙니다.**',
    '  원문      — <<<원문>>> 과 <<<끝>>> 사이의 글. 이 부분만 옮깁니다.',
    '',
    '응답은 JSON 객체 하나뿐이며, 키는 아래 칸의 key를 그대로 씁니다:',
    `{ ${fields.map((f) => `"${f.key}": string`).join(', ')} }`,
    '',
    ...fields.flatMap((f) => [
      `--- key: ${f.key} ---`,
      `칸 이름: ${f.label}`,
      '<<<원문>>>',
      f.ko,
      '<<<끝>>>',
      '',
    ]),
    'JSON 객체 하나만 출력하고, JSON 밖에 어떤 텍스트도 쓰지 마세요.',
  ].join('\n');
}

/**
 * 요청으로 들어온 칸 목록을 다듬는다 — 빈 원문은 버리고, 길이·개수를 잘라 낸다.
 * (LLM에 보내기 전 단계라 여기서 걸러야 프롬프트가 폭주하지 않는다.)
 */
export function normalizeFields(raw: unknown): TranslateField[] {
  if (!Array.isArray(raw)) return [];
  const out: TranslateField[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { key, label, ko } = item as Record<string, unknown>;
    if (typeof key !== 'string' || !key.trim()) continue;
    if (typeof ko !== 'string' || !ko.trim()) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      label: typeof label === 'string' && label.trim() ? label.trim() : key,
      ko: ko.trim().slice(0, MAX_FIELD_CHARS),
    });
    if (out.length >= MAX_FIELDS) break;
  }
  return out;
}

/**
 * 모델 응답(JSON으로 해석된 값)에서 요청한 칸만 골라 낸다.
 *
 * LLM 출력은 신뢰할 수 없다 — 요청하지 않은 키, 문자열이 아닌 값, 빈 문자열,
 * 원문을 그대로 돌려준 경우(번역이 일어나지 않은 것)를 모두 버린다. 버린 칸은
 * 결과에 담기지 않으므로 호출부는 "채워진 칸"만 보게 된다.
 */
export function pickTranslations(parsed: unknown, fields: TranslateField[]): TranslateResult {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const source = parsed as Record<string, unknown>;
  const out: TranslateResult = {};
  for (const field of fields) {
    const value = source[field.key];
    if (typeof value !== 'string') continue;
    const text = value.trim();
    if (!text) continue;
    // 원문을 그대로 돌려준 것은 번역이 아니다(모델이 지시를 놓친 경우).
    if (text === field.ko.trim()) continue;
    out[field.key] = text.slice(0, MAX_FIELD_CHARS);
  }
  return out;
}
