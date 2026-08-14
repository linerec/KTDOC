/**
 * lib/forms/schema.ts — 신청서 스키마 엔진 (순수 함수만)
 *
 * 이 파일은 DB도 React도 모른다. 그래서 시험할 수 있고, 그래서 게이트를 믿을 수 있다.
 * 부수효과가 붙은 쪽은 lib/d1/forms.ts · lib/d1/formResponses.ts 다.
 * (lib/admin/menuAccess.ts ↔ permissions.ts 의 나눔과 같은 이유다: 판정을 시험할 수 있어야 한다)
 *
 * 설계의 핵심: **문항이 스스로 "이 답이 어디로 가는가"를 말한다.**
 *   bind        → form_responses 코어 컬럼
 *   selectionOf → form_response_selections (과목별 명단의 축)
 *   consentKey  → form_response_consents (법적 증빙의 축)
 * 지시자가 없으면 답은 answers_json 에만 남는다. applyBindings 가 그 지시를 실행한다.
 *
 * ※ node --test 가 @/ 별칭을 풀지 못하므로 상대 경로 + .ts 로 import 한다 — 이 파일은 시험 대상이다.
 */

import {
  CORE_BIND_KEYS,
  type Answers,
  type CoreBindKey,
  type FormQuestion,
  type FormSchema,
} from '../../types/forms.ts';

/** 문항·선택지 키에 허용하는 문자. 키는 URL·CSV 헤더·SQL 파라미터를 오간다. */
const KEY_RE = /^[a-z0-9_]+$/;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 스키마의 모든 문항을 순서대로 (섹션 경계 없이) */
export function allQuestions(schema: FormSchema): FormQuestion[] {
  return schema.sections.flatMap((s) => s.questions);
}

/**
 * 저장을 **차단**하는 사유. 빈 배열이면 통과.
 * 여기서 막는 것은 전부 "고치지 않으면 조용히 망가지는" 것들이다.
 */
export function validateSchema(schema: FormSchema): string[] {
  const errors: string[] = [];
  const questions = allQuestions(schema);

  const seenKeys = new Set<string>();
  const seenBinds = new Set<string>();
  const seenConsents = new Set<string>();

  for (const q of questions) {
    if (!q.key || !KEY_RE.test(q.key)) {
      errors.push(`문항 키가 올바르지 않습니다: "${q.key}" (소문자·숫자·밑줄만 가능)`);
      continue;
    }
    if (seenKeys.has(q.key)) errors.push(`문항 키가 중복됩니다: "${q.key}"`);
    seenKeys.add(q.key);

    if (q.bind) {
      if (!(CORE_BIND_KEYS as readonly string[]).includes(q.bind)) {
        errors.push(`알 수 없는 bind 값입니다: "${q.bind}" (문항 ${q.key})`);
      } else if (seenBinds.has(q.bind)) {
        errors.push(`bind "${q.bind}" 를 두 문항이 씁니다 (문항 ${q.key})`);
      }
      seenBinds.add(q.bind);
    }

    if (q.consentKey) {
      if (seenConsents.has(q.consentKey)) {
        errors.push(`동의 키가 중복됩니다: "${q.consentKey}" (문항 ${q.key})`);
      }
      seenConsents.add(q.consentKey);
    }

    if (q.format === 'email' && q.type !== 'short') {
      errors.push(`format:"email" 은 단답 문항에만 쓸 수 있습니다 (문항 ${q.key})`);
    }

    const optionKeys = new Set<string>();
    for (const o of q.options ?? []) {
      if (!o.key || !KEY_RE.test(o.key)) {
        errors.push(`선택지 키가 올바르지 않습니다: "${o.key}" (문항 ${q.key})`);
        continue;
      }
      if (optionKeys.has(o.key)) errors.push(`선택지 키가 중복됩니다: "${o.key}" (문항 ${q.key})`);
      optionKeys.add(o.key);
    }

    if (q.type === 'multi' && q.minSelect != null && q.minSelect > (q.options?.length ?? 0)) {
      errors.push(`최소 선택 수(${q.minSelect})가 선택지 수보다 많습니다 (문항 ${q.key})`);
    }
  }

  // showIf 참조 검증 — 앞선 문항만 가리켜야 한다고 강제하지는 않는다(섹션 순서를 바꿔도
  // 폼이 깨지지 않게). 존재만 확인한다.
  const byKey = new Map(questions.map((q) => [q.key, q]));
  for (const q of questions) {
    if (!q.showIf) continue;
    const target = byKey.get(q.showIf.question);
    if (!target) {
      errors.push(`조건부 노출이 없는 문항을 가리킵니다: "${q.showIf.question}" (문항 ${q.key})`);
      continue;
    }
    const valid = new Set((target.options ?? []).map((o) => o.key));
    for (const v of [...(q.showIf.equals ?? []), ...(q.showIf.includes ?? [])]) {
      if (!valid.has(v)) {
        errors.push(`조건부 노출이 없는 선택지를 가리킵니다: "${v}" (문항 ${q.key})`);
      }
    }
  }

  return errors;
}

/**
 * 게시는 가능하되 운영자에게 알려야 하는 것.
 * 여기 있는 항목이 편집 화면 "운영 준비 상태" 패널의 ✗ 줄이 된다.
 *
 * 강제하지 않는 이유: 강제하면 "어떤 신청서든 만들 수 있다"는 전제가 무너진다.
 * 설문에는 수업 연결이 없어도 된다.
 */
export function warnSchema(schema: FormSchema): string[] {
  const warnings: string[] = [];

  for (const q of allQuestions(schema)) {
    if (!q.selectionOf || q.retired) continue;
    const live = (q.options ?? []).filter((o) => !o.retired);

    const unlinked = live.filter((o) => o.programId == null);
    if (unlinked.length > 0) {
      warnings.push(
        `수강 배정 — 과목 ${unlinked.length}개에 수업이 연결되지 않았습니다: ` +
          unlinked.map((o) => o.label.ko).join(', ')
      );
    }

    const noCapacity = live.filter((o) => o.capacity == null);
    if (noCapacity.length > 0) {
      warnings.push(`정원이 지정되지 않은 과목 ${noCapacity.length}개 — 명단에 잔여 수가 표시되지 않습니다`);
    }

    const noCourse = live.filter((o) => !o.courseCode);
    if (noCourse.length > 0) {
      warnings.push(`학비표 코스가 연결되지 않은 과목 ${noCourse.length}개 — 학비 조회 보조가 동작하지 않습니다`);
    }
  }

  return warnings;
}

/**
 * 답변 오류 코드. 화면이 forms.err.<code> 키로 번역한다.
 * 문장을 여기서 만들지 않는 이유는 validateAnswers 주석 참고.
 */
export type AnswerErrorCode =
  | 'required'          // 입력해 주세요
  | 'selectRequired'    // 선택해 주세요
  | 'consentRequired'   // 동의가 필요합니다
  | 'pickOne'           // 하나 이상 선택해 주세요
  | 'pickAtLeast'       // {min}개 이상 선택해 주세요
  | 'badOption'         // 선택할 수 없는 항목입니다
  | 'badOptions'        // 선택할 수 없는 항목이 포함되어 있습니다
  | 'badEmail'          // 이메일 형식이 올바르지 않습니다
  | 'badTel';           // 전화번호를 확인해 주세요

export interface AnswerError {
  code: AnswerErrorCode;
  /** pickAtLeast 전용 */
  min?: number;
}

export type AnswerErrors = Record<string, AnswerError>;

/** 이 문항이 지금 답변 상태에서 보이는가. 조건이 없으면 항상 보인다. */
export function evaluateShowIf(q: FormQuestion, answers: Answers): boolean {
  if (q.retired) return false;
  if (!q.showIf) return true;
  const v = answers[q.showIf.question];

  if (q.showIf.equals) {
    if (typeof v !== 'string') return false;
    return q.showIf.equals.includes(v);
  }
  if (q.showIf.includes) {
    if (!Array.isArray(v)) return false;
    return q.showIf.includes.some((k) => v.includes(k));
  }
  return true;
}

/** 지금 화면에 떠야 할 문항 (info 블록 포함, retired 제외) */
export function visibleQuestions(schema: FormSchema, answers: Answers): FormQuestion[] {
  return allQuestions(schema).filter((q) => evaluateShowIf(q, answers));
}

/**
 * 답변 검증. 문항키 → **오류 코드**.
 *
 * 문장이 아니라 코드를 돌려주는 이유: 이 함수는 서버와 클라이언트가 함께 쓰는데,
 * 여기서 한국어 문장을 만들면 영문 화면에도 한국어 경고가 뜬다.
 * 문장으로 바꾸는 일은 화면이 한다(lib/i18n 의 t + forms.err.* 키).
 *
 * **숨겨진 문항은 검증하지 않는다** — 이것이 조건부 노출의 핵심이고,
 * 구글폼이 못 해서 감수하던 것(공연에 참가해도 미참가 사유가 필수로 뜨던 것)을 고치는 자리다.
 */
export function validateAnswers(schema: FormSchema, answers: Answers): AnswerErrors {
  const errors: AnswerErrors = {};

  for (const q of visibleQuestions(schema, answers)) {
    if (q.type === 'info') continue;
    const v = answers[q.key];

    if (q.type === 'multi') {
      const arr = Array.isArray(v) ? v : [];
      const min = q.minSelect ?? (q.required ? 1 : 0);
      if (arr.length < min) {
        errors[q.key] = min === 1 ? { code: 'pickOne' } : { code: 'pickAtLeast', min };
        continue;
      }
      const valid = new Set((q.options ?? []).map((o) => o.key));
      if (arr.some((k) => !valid.has(k))) errors[q.key] = { code: 'badOptions' };
      continue;
    }

    if (q.type === 'consent') {
      if (q.required && v !== true) errors[q.key] = { code: 'consentRequired' };
      continue;
    }

    if (q.type === 'single') {
      if (v == null || v === '') {
        if (q.required) errors[q.key] = { code: 'selectRequired' };
        continue;
      }
      const valid = new Set((q.options ?? []).map((o) => o.key));
      if (typeof v !== 'string' || !valid.has(v)) errors[q.key] = { code: 'badOption' };
      continue;
    }

    // short | long
    const s = typeof v === 'string' ? v.trim() : '';
    if (!s) {
      if (q.required) errors[q.key] = { code: 'required' };
      continue;
    }
    if (q.format === 'email' && !EMAIL_RE.test(s)) {
      errors[q.key] = { code: 'badEmail' };
    }
    if (q.format === 'tel' && s.replace(/\D/g, '').length < 7) {
      errors[q.key] = { code: 'badTel' };
    }
  }

  return errors;
}

export function normalizeName(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase();
}

export function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

export interface CoreFields {
  student_name: string;
  student_name_norm: string;
  student_grade: string | null;
  email: string | null;
  email_norm: string | null;
  phone: string | null;
  guardian_name: string | null;
}

export interface DerivedSelection {
  question_key: string;
  option_key: string;
  option_label_ko: string | null;
  option_label_en: string | null;
  program_id: number | null;
}

export interface DerivedConsent {
  consent_key: string;
  question_key: string;
  agreed: number;
  policy_version: number;
}

export interface BindingResult {
  core: CoreFields;
  selections: DerivedSelection[];
  consents: DerivedConsent[];
  hasMedical: boolean;
}

/**
 * 답변에서 코어 컬럼·파생 행을 유도한다.
 *
 * **이 함수의 출력만으로 파생 테이블을 재구축할 수 있어야 한다.**
 * (schema_json + answers_json → 파생. 그 반대 방향은 없다.)
 * 그래서 파생에 담기는 값은 전부 여기서 유도 가능한 것뿐이다 — 라벨 스냅샷 포함.
 * 이 성질이 깨지면 rebuildDerived 가 데이터를 잃는다.
 */
export function applyBindings(
  schema: FormSchema,
  answers: Answers,
  schemaVersion: number
): BindingResult {
  const core: CoreFields = {
    student_name: '',
    student_name_norm: '',
    student_grade: null,
    email: null,
    email_norm: null,
    phone: null,
    guardian_name: null,
  };
  const selections: DerivedSelection[] = [];
  const consents: DerivedConsent[] = [];
  let hasMedical = false;

  // 숨겨진 문항은 파생을 만들지 않는다 — 응답자가 보지 않은 것에 동의시키지 않는다.
  for (const q of visibleQuestions(schema, answers)) {
    const v = answers[q.key];

    if (q.bind) {
      const s = typeof v === 'string' ? v.trim() : '';
      switch (q.bind as CoreBindKey) {
        case 'student_name':
          core.student_name = s;
          core.student_name_norm = normalizeName(s);
          break;
        case 'student_grade':
          core.student_grade = s || null;
          break;
        case 'email':
          core.email = s || null;
          core.email_norm = s ? normalizeEmail(s) : null;
          break;
        case 'phone':
          core.phone = s || null;
          break;
        case 'guardian_name':
          core.guardian_name = s || null;
          break;
      }
    }

    if (q.sensitive) {
      const s = typeof v === 'string' ? v.trim() : '';
      if (s) hasMedical = true;
    }

    if (q.selectionOf && Array.isArray(v)) {
      const byKey = new Map((q.options ?? []).map((o) => [o.key, o]));
      for (const key of v) {
        const o = byKey.get(key);
        if (!o) continue;
        selections.push({
          question_key: q.key,
          option_key: o.key,
          option_label_ko: o.label.ko ?? null,
          option_label_en: o.label.en ?? null,
          program_id: o.programId ?? null,
        });
      }
    }

    if (q.consentKey) {
      let agreed: boolean | null = null;
      if (q.type === 'consent') {
        agreed = v === true;
      } else if (typeof v === 'string') {
        const o = (q.options ?? []).find((x) => x.key === v);
        if (o) agreed = o.consentValue === true;
      }
      if (agreed !== null) {
        consents.push({
          consent_key: q.consentKey,
          question_key: q.key,
          agreed: agreed ? 1 : 0,
          policy_version: schemaVersion,
        });
      }
    }
  }

  return { core, selections, consents, hasMedical };
}

/**
 * 첫 제출(locked_at) 이후 파괴적 편집을 막는다.
 *
 * 관례가 아니라 **코드 강제**여야 한다. 에디터가 삭제 버튼을 진짜 삭제로 구현하면
 * 그날로 옛 응답이 가리킬 곳을 잃기 때문이다. 지우는 대신 retired 툼스톤을 쓴다.
 *
 * required 를 끄는 것은 허용한다 — "실수로 필수로 만들었는데 이미 3명이 냈다"에서
 * 운영자가 막히면 안 된다. 증빙은 form_schema_versions 스냅샷이 지킨다.
 */
export function assertEditAllowed(
  before: FormSchema,
  after: FormSchema,
  locked: boolean
): string[] {
  if (!locked) return [];
  const errors: string[] = [];
  const afterByKey = new Map(allQuestions(after).map((q) => [q.key, q]));

  for (const b of allQuestions(before)) {
    const a = afterByKey.get(b.key);
    if (!a) {
      errors.push(
        `이미 응답이 있는 신청서에서는 문항을 지울 수 없습니다: "${b.key}" (감추려면 '사용 안 함'을 쓰세요)`
      );
      continue;
    }
    if (a.type !== b.type) errors.push(`문항 유형을 바꿀 수 없습니다: "${b.key}"`);
    if (a.bind !== b.bind) errors.push(`문항의 연결(bind)을 바꿀 수 없습니다: "${b.key}"`);
    if (a.consentKey !== b.consentKey) errors.push(`동의 키를 바꿀 수 없습니다: "${b.key}"`);
    if (a.selectionOf !== b.selectionOf) errors.push(`선택 축을 바꿀 수 없습니다: "${b.key}"`);
    if (a.required && !b.required) {
      errors.push(
        `이미 응답이 있는 문항을 필수로 바꿀 수 없습니다: "${b.key}" (이미 낸 응답이 소급 무효가 됩니다)`
      );
    }

    const afterOptionKeys = new Set((a.options ?? []).map((o) => o.key));
    for (const o of b.options ?? []) {
      if (!afterOptionKeys.has(o.key)) {
        errors.push(
          `이미 응답이 있는 신청서에서는 선택지를 지울 수 없습니다: "${o.key}" (문항 ${b.key})`
        );
      }
    }
  }

  return errors;
}
