/**
 * lib/forms/summary.ts — 제출 직전에 보여줄 "내가 고른 것"
 *
 * 신청서가 길다. 과목을 고른 것이 화면 위쪽이고, 제출 버튼은 한참 아래다.
 * 내려오는 동안 무엇을 골랐는지 잊고, 확인하려면 위로 되짚어 올라가야 했다.
 * 그래서 제출 버튼 바로 위에 고른 것을 모아 다시 보여준다.
 *
 * **문항 키를 박아 넣지 않는다.** 신청서마다 문항이 다르고 특강·설문에는 과목도
 * 기간도 없다. 스키마가 스스로 말하는 지시자(bind·selectionOf·consentKey)로만 고른다 —
 * 새 신청서를 만들어도 요약이 저절로 따라온다.
 *
 * **화면에 보이는 문항만 요약한다.** 조건부로 사라진 문항의 답이 요약에 남으면,
 * 신청자는 자기가 고르지도 않은 것을 골랐다고 읽게 된다.
 *
 * **금액은 넣지 않는다.** 학비는 지금도 "신청 내용을 확인한 후 개별 안내"이고,
 * 그것을 바꾸는 것은 이 요약의 몫이 아니다(lib/forms/tuition.ts 머리말 참고).
 *
 * ※ node --test 가 @/ 별칭을 풀지 못하므로 상대 경로 + .ts 로 import 한다.
 */

import { pickText, visibleQuestions } from './schema.ts';
import { findRegTypeQuestion } from './responseLabels.ts';
import { findPeriodQuestion } from './tuition.ts';
import type { Answers, FormQuestion, FormSchema } from '../../types/forms.ts';

/**
 * 요약에 실리는 줄의 종류. 화면이 이 값으로 강조를 정한다 —
 * 과목·기간이 가장 확인하고 싶은 것이라 굵게 간다.
 */
export type SummaryKind = 'identity' | 'class' | 'period';

export interface SummaryLine {
  /** 문항 키 — 렌더 키이자, 눌러서 그 문항으로 되돌아가는 앵커다. */
  key: string;
  kind: SummaryKind;
  label: string;
  /** 사람이 읽는 답. 아직 고르지 않았으면 빈 배열이다. */
  values: string[];
}

/**
 * 동의는 한 줄로 접는다 — 동의 문구는 한 문장이 통째로 라벨이라
 * ("위 내용을 확인하였으며, KTDOC 정규 교육과정에 포함된…") 낱낱이 실으면
 * 요약이 신청서만큼 길어져 아무도 읽지 않는다.
 *
 * 여기서 알아야 할 것은 딱 하나다 — **남은 동의가 있는가.**
 */
export interface ConsentProgress {
  total: number;
  done: number;
  /** 아직 안 한 첫 동의 문항 — 눌러서 그리로 간다. 다 했으면 null. */
  firstMissingKey: string | null;
}

export interface FormSummary {
  lines: SummaryLine[];
  /** 동의 문항이 없는 신청서(설문 등)에서는 null */
  consents: ConsentProgress | null;
}

/** 답 하나를 사람이 읽는 값들로. 선택형은 라벨로 옮긴다. */
function readAnswer(q: FormQuestion, answers: Answers, locale: string): string[] {
  const v = answers[q.key];
  if (v == null || v === '') return [];

  const labelOf = (k: string): string => {
    const o = q.options?.find((x) => x.key === k);
    // 지금 문안에 없는 옛 선택지는 키를 그대로 — 사라지는 것보다 낫다.
    return o ? pickText(o.label, locale) : k;
  };

  if (typeof v === 'boolean') return v ? ['✓'] : [];
  if (Array.isArray(v)) return v.map(labelOf);
  return q.options?.length ? [labelOf(v)] : [String(v)];
}

/**
 * 요약에 실을 문항을 고른다.
 *
 * 이름·등록 유형은 "누구의 신청인가", 과목·기간은 "무엇을 얼마 동안", 동의는
 * "무엇에 동의했는가". 그 밖의 문항(연락처·건강·자유 서술)은 넣지 않는다 —
 * 요약이 신청서를 통째로 되풀이하면 아무도 읽지 않고, 건강 특이사항 같은 것이
 * 남의 화면에 다시 뜨는 자리를 만들 이유도 없다.
 */
export function summarizeAnswers(
  schema: FormSchema,
  answers: Answers,
  locale: string
): FormSummary {
  const visible = visibleQuestions(schema, answers);
  const regTypeKey = findRegTypeQuestion(visible)?.key;
  const periodKey = findPeriodQuestion(visible)?.key;

  const listed = visible.filter((q) => !q.retired && q.type !== 'info' && !q.sensitive);

  const kindOf = (q: FormQuestion): SummaryKind | null => {
    if (q.bind === 'student_name' || q.key === regTypeKey) return 'identity';
    if (q.selectionOf) return 'class';
    if (q.key === periodKey) return 'period';
    return null;
  };

  const lines: SummaryLine[] = [];
  for (const q of listed) {
    const kind = kindOf(q);
    if (!kind) continue;
    lines.push({
      key: q.key,
      kind,
      label: pickText(q.label, locale),
      values: readAnswer(q, answers, locale),
    });
  }

  // 신청서의 문항 순서가 아니라 읽는 순서로 — 누가 / 무엇을 / 얼마 동안.
  const ORDER: SummaryKind[] = ['identity', 'class', 'period'];
  lines.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));

  // 동의는 세지기만 한다. 동의 축으로 승격되는 문항(consentKey)이 그 대상이다.
  const consentQs = listed.filter((q) => q.consentKey);
  const missing = consentQs.filter((q) => readAnswer(q, answers, locale).length === 0);
  const consents: ConsentProgress | null =
    consentQs.length > 0
      ? {
          total: consentQs.length,
          done: consentQs.length - missing.length,
          firstMissingKey: missing[0]?.key ?? null,
        }
      : null;

  return { lines, consents };
}

/**
 * 요약을 보여줄 만한가. 고를 것이 없는 신청서(설문 등)에서는 빈 상자만 뜬다.
 * 과목이든 기간이든 **고르는 문항이 하나라도** 있어야 요약이 뜻을 가진다.
 */
export function hasSummary(summary: FormSummary): boolean {
  return summary.lines.some((l) => l.kind === 'class' || l.kind === 'period');
}
