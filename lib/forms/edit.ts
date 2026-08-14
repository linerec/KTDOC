/**
 * lib/forms/edit.ts — 편집기가 스키마를 고치는 조작 (순수 함수)
 *
 * 편집 UI 안에 스프레드 연산을 흩어 두면 조용히 깨진다 — 섹션 하나만 갈아끼우다
 * 다른 섹션을 통째로 잃거나, 순서를 바꾸다 문항이 사라지는 종류다.
 * 여기 모아 두고 edit.test.ts 가 잠근다.
 *
 * **모든 함수는 새 스키마를 반환하고 입력을 건드리지 않는다.**
 *
 * ※ node --test 가 @/ 별칭을 풀지 못하므로 상대 경로 + .ts 로 import 한다.
 */

import type { FormOption, FormQuestion, FormSchema } from '../../types/forms.ts';

/** 문항 하나를 고친다. 없는 키면 그대로 돌려준다. */
export function patchQuestion(
  schema: FormSchema,
  key: string,
  patch: Partial<FormQuestion>
): FormSchema {
  return {
    ...schema,
    sections: schema.sections.map((s) => ({
      ...s,
      questions: s.questions.map((q) => (q.key === key ? { ...q, ...patch } : q)),
    })),
  };
}

/** 선택지 하나를 고친다. */
export function patchOption(
  schema: FormSchema,
  questionKey: string,
  optionKey: string,
  patch: Partial<FormOption>
): FormSchema {
  return {
    ...schema,
    sections: schema.sections.map((s) => ({
      ...s,
      questions: s.questions.map((q) =>
        q.key === questionKey
          ? {
              ...q,
              options: (q.options ?? []).map((o) =>
                o.key === optionKey ? { ...o, ...patch } : o
              ),
            }
          : q
      ),
    })),
  };
}

/**
 * 선택지 순서를 한 칸 옮긴다.
 * 드래그앤드롭을 만들지 않는 이유: dnd 라이브러리가 없고, ↑↓ 버튼이 접근성도 낫다.
 */
export function moveOption(
  schema: FormSchema,
  questionKey: string,
  optionKey: string,
  direction: -1 | 1
): FormSchema {
  return {
    ...schema,
    sections: schema.sections.map((s) => ({
      ...s,
      questions: s.questions.map((q) => {
        if (q.key !== questionKey) return q;
        const options = [...(q.options ?? [])];
        const from = options.findIndex((o) => o.key === optionKey);
        const to = from + direction;
        if (from < 0 || to < 0 || to >= options.length) return q;
        [options[from], options[to]] = [options[to], options[from]];
        return { ...q, options };
      }),
    })),
  };
}

/** 새 선택지를 끝에 붙인다. 키가 이미 있으면 그대로 돌려준다. */
export function addOption(
  schema: FormSchema,
  questionKey: string,
  option: FormOption
): FormSchema {
  return {
    ...schema,
    sections: schema.sections.map((s) => ({
      ...s,
      questions: s.questions.map((q) => {
        if (q.key !== questionKey) return q;
        const options = q.options ?? [];
        if (options.some((o) => o.key === option.key)) return q;
        return { ...q, options: [...options, option] };
      }),
    })),
  };
}

/** 섹션에 문항을 붙인다(추가 질문 탭). 섹션이 없으면 만든다. */
export function addQuestion(
  schema: FormSchema,
  sectionKey: string,
  question: FormQuestion
): FormSchema {
  const exists = schema.sections.some((s) => s.key === sectionKey);
  const sections = exists
    ? schema.sections.map((s) =>
        s.key === sectionKey ? { ...s, questions: [...s.questions, question] } : s
      )
    : [...schema.sections, { key: sectionKey, questions: [question] }];
  return { ...schema, sections };
}

/**
 * 문항을 지운다 — **잠기지 않은 신청서에서만 쓴다.**
 * 잠긴 뒤에는 retired 툼스톤(patchQuestion(…, { retired: true }))을 쓴다.
 */
export function removeQuestion(schema: FormSchema, key: string): FormSchema {
  return {
    ...schema,
    sections: schema.sections.map((s) => ({
      ...s,
      questions: s.questions.filter((q) => q.key !== key),
    })),
  };
}

/** 라벨에서 안정 키를 만든다. 겹치면 뒤에 숫자를 붙인다. */
export function makeKey(label: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24) || 'item';
  if (!used.has(base)) return base;
  for (let i = 2; i < 500; i += 1) {
    const candidate = `${base}_${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${base}_${used.size + 1}`;
}

/** 스키마 안의 모든 문항·선택지 키 — 새 키를 지을 때 겹침을 피하려고 쓴다. */
export function allKeys(schema: FormSchema): string[] {
  const keys: string[] = [];
  for (const s of schema.sections) {
    for (const q of s.questions) {
      keys.push(q.key);
      for (const o of q.options ?? []) keys.push(o.key);
    }
  }
  return keys;
}
