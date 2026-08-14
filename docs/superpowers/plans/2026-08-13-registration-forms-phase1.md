# 신청서(질문지) 시스템 1단계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 구글폼으로 하던 "질문지 제작 → QR·링크 공유 → 응답 수집 → 수강 배정"을 KTDOC 사이트 안에서 끝낼 수 있게 만든다.

**Architecture:** 코어·슬롯 하이브리드. 응답 1건의 진실은 `form_responses.answers_json` 한 곳에 있고(D1이 트랜잭션을 거부하므로 응답 본체는 반드시 **단일 INSERT**로 착지한다), 운영이 SQL로 실제 쓰는 두 축(과목 선택 / 동의)만 `answers_json`에서 **언제든 재계산되는 파생 테이블**로 승격한다. 폼 정의(`schema_json`)는 유연한 JSON이지만 편집 화면은 프리셋 + 도메인 표로 보인다 — 빈 캔버스에서 문항을 조립하는 화면은 만들지 않는다.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Cloudflare D1 (REST) · MySQL(회원, 이번 단계 변경 0건) · **Plain CSS**(Tailwind/shadcn 없음) · `node --test`

**설계 문서:** `docs/superpowers/specs/2026-08-13-registration-forms-design.md`
**원본 자료:** `docs/superpowers/specs/2026-08-13-registration-forms-source.md` (구글폼 14문항 전문 + 학비표)

---

## Global Constraints

이 절의 규칙은 **모든 태스크의 요구사항에 암묵적으로 포함된다.**

**저장소 제약 (원격 D1 실측, 2026-08-13):**
- D1은 `BEGIN`/`COMMIT`을 **거부한다.** 다중 행 쓰기의 원자성이 없다 → 응답 본체는 단일 INSERT, 파생은 재계산 가능해야 한다.
- 바인딩 파라미터 **상한 100개**(`IN` 리스트 포함). 90개 단위로 청크 분할한다.
- `lib/d1/client.ts`의 `queryD1`은 `data.result[0]`만 반환한다 — 다문장 SQL을 보내면 2번째 이후 결과가 **조용히 버려진다.**
- 표현식 인덱스·VIRTUAL 생성 컬럼은 동작한다. `json_extract` / `->>` / `json_each` 동작.
- FK 강제가 켜져 있다(고아 INSERT 거부).

**테스트:**
- 러너는 `npm test` = `node --test "lib/**/*.test.ts"`. **테스트는 `lib/` 아래에만 둔다.**
- `node --test`가 `@/` 별칭을 풀지 못한다. **시험 대상 파일과 그 테스트는 상대 경로 + `.ts` 확장자로 import한다** (`./schema.ts`, `../../types/forms.ts`). 선례: `lib/admin/menuAccess.ts`.
- `node:test` + `node:assert/strict`. 테스트 이름은 한국어 문장으로 **의도**를 쓴다. 선례: `lib/d1/eventViews.test.ts`.

**API 규약:**
- 응답은 항상 `{ success: true, data }` 또는 `{ success: false, error: '한국어 메시지' }`.
- 관리 API는 `const session = await auth()` → `if (!(await hasMenuAccess(session, 'forms')))` → 403. **`isAdmin()` 하드코딩 금지** (기존 `applications` API의 함정).
- 관리 페이지(서버 컴포넌트)는 `await requireMenuAccess(session, 'forms')`.
- 공개 API는 미들웨어를 타지 않으므로 **라우트가 스스로 `auth()`를 부른다.** 클라이언트가 보낸 `user_id`는 절대 신뢰하지 않는다.

**i18n:**
- 화면 크롬만 번역한다. **폼 콘텐츠(문항·선택지·동의문)는 `locale/*.json`이 아니라 `schema_json` 안의 `{ko, en}` 쌍이다.**
- 클라이언트: `const t = useT()` → `t('admin.forms.x', '한국어 기본값')`. **항상 fallback 인자를 넘긴다.**
- 키를 추가하면 `locale/ko.json`·`locale/en.json` **양쪽에.** 한국어 값은 코드 fallback과 동일하게.
- 완료 전 `npm run lint:i18n` 0건.

**테마:**
- 관리 콘솔: `:root`가 다크, `html[data-admin-theme='light']`가 뒤집는다. 흰 전경은 `rgba(var(--fg-rgb), α)`, 표면은 `var(--surface-2)`. 금색 텍스트는 `--soft-gold-text`/`--accent-text`, 배경·보더는 `--soft-gold`/`--accent-color`.
- 공개 폼: 한지(라이트)가 기본. 지면은 `var(--ground)`~`var(--ground-4)`, 전경은 `var(--text-color)`/`var(--text-muted)`.
- **공개 폼은 히어로가 없다** → `--page-offset-tight`를 쓰고 `scripts/lintTheme.mjs`의 히어로 등록은 불필요.
- 완료 전 `npm run lint:theme` 0건 + **두 테마 눈 확인**.

**마이그레이션:**
- 파일명 `migrations/0035_registration_forms.sql`. 적용은 `npm run d1:migrate migrations/0035_registration_forms.sql`.
- 헤더 주석에 Target DB / Description / Apply를 적는다(선례: `0018_program_enrollments.sql`).
- **`CHECK` 제약을 걸지 않는다**(0032 선례) — 값이 늘 때 마이그레이션 없이 추가하려고. 검증은 `lib/forms/schema.ts`가 한다.
- MySQL 교차 참조는 FK 없이 `user_id TEXT`(UUID).

**용어(관리 콘솔 문구):**
- 관리 대상은 **공연**으로 부른다(이벤트 아님). 신청서 시스템에서는 "신청서" · "응답" · "수업"을 쓴다.
- 문구 톤: 차분·진지한 합니다체. 어린이용 추임새·이모지 금지.

**막힌 것 (§7.12):**
- Q7 과목 선택지를 학비표 코스에 맞게 쪼갤지, 중고등부 작품반을 어떻게 신청할지가 **미확정**이다.
- **Task 4(프리셋·시드)와 Task 14(학비표 조회)는 이 답에 의존한다.** 두 태스크는 구조만 만들고 매핑 값은 비워 둔 채 진행하며, **폼을 실제로 게시하기 전에** 답을 채운다(게시 후에는 선택지를 못 쪼갠다).
- 나머지 태스크는 답 없이 전부 진행 가능하다.

---

## File Structure

**신규 — 순수 로직 (테스트 대상)**
| 파일 | 책임 |
|---|---|
| `types/forms.ts` | 폼·응답 타입. DB·React 의존 0 |
| `lib/forms/schema.ts` | 스키마 검증·조건부 평가·답변 검증·파생 유도. **부수효과 없음** |
| `lib/forms/schema.test.ts` | 위의 불변식을 잠근다 |
| `lib/forms/presets.ts` | `season`/`workshop`/`survey` 프리셋 `schema_json` |
| `lib/forms/tuition.ts` | 학비표 24행 룩업 (조회 보조 전용) |
| `lib/forms/csv.ts` | 응답 → CSV 문자열 |
| `lib/d1/chunk.ts` | 파라미터 90개 청크 분할 |
| `lib/d1/formViews.ts` + `.test.ts` | "어느 화면이 어떤 응답을 보는가" 관점 함수 |

**신규 — D1 접근층 (부수효과)**
| 파일 | 책임 |
|---|---|
| `lib/d1/forms.ts` | 폼 CRUD · 버전 스냅샷 · 복제 |
| `lib/d1/formResponses.ts` | 응답 저장·조회 · 파생 재구축 · 메모/이력 |

**신규 — 화면**
| 파일 | 책임 |
|---|---|
| `app/f/[slug]/page.tsx` · `done/page.tsx` | 공개 폼 · 완료 |
| `components/forms/FormRenderer.tsx` + `fields/*.tsx` | 문항 렌더 |
| `app/admin/forms/**` | 목록 · 새 폼 · 편집 · 응답 · 명단 |
| `components/admin/forms/*.tsx` | 편집 탭 · 응답 표 · 상세 패널 |

**신규 — API**: `app/api/forms/[slug]/submit/route.ts` (공개), `app/api/admin/forms/**` (관리)

**수정**
| 파일 | 수정 |
|---|---|
| `lib/d1/client.ts` | `batchD1()` 추가 |
| `lib/d1/index.ts` | 신규 모듈 re-export |
| `types/permissions.ts` | `MenuKey`에 `'forms'` 추가 |
| `lib/admin/menu-registry.ts` | `forms` 노드 추가 |
| `locale/ko.json` · `locale/en.json` | `admin.forms.*` · `forms.*` |
| `app/globals.css` | 폼 렌더러·편집기 CSS |
| `app/api/admin/programs/[id]/enrollments/route.ts:64` | `role !== 'student'` 400 완화 |
| `app/admin/page.tsx` (StaffDashboard 소스) | 신규 건수 소스 교체 |
| `app/classes/[slug]/page.tsx` | `active_form_id` 있으면 `/f/{slug}`로 |

---

## Task 1: 마이그레이션 + 타입

**Files:**
- Create: `migrations/0035_registration_forms.sql`
- Create: `types/forms.ts`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: 타입 `FormRow`, `FormResponseRow`, `FormSchema`, `FormSection`, `FormQuestion`, `FormOption`, `ShowIf`, `AnswerValue`, `FormStatus`, `ResponseStatus`, `CORE_BIND_KEYS`. 이후 모든 태스크가 이 타입을 쓴다.

- [ ] **Step 1: 마이그레이션 작성**

`migrations/0035_registration_forms.sql` — 설계서 §4.2의 SQL을 그대로 옮긴다. 헤더 주석 필수:

```sql
-- Migration: 신청서(질문지) 시스템 — forms / 버전 스냅샷 / 응답 / 파생 축 / 이력
-- Target DB: Cloudflare D1 (SQLite)
-- Description:
--   구글폼으로 하던 "질문지 만들기 → 링크·QR 공유 → 응답 수집 → 수강 배정"을 사이트로 들인다.
--   코어(폼이 없어도 존재하는 축)는 컬럼, 폼마다 다른 문항은 JSON,
--   운영이 SQL로 쓰는 두 축(과목 선택 / 동의)만 재계산 가능한 파생 테이블.
--   ※ D1은 명시적 트랜잭션을 거부한다(BEGIN 실측 거부). 따라서 응답 본체는 반드시
--     단일 INSERT로 착지하고, 파생 테이블은 answers_json에서 언제든 재구축 가능해야 한다.
--     진실의 원천은 항상 form_responses.answers_json 이다.
--   ※ CHECK 제약을 걸지 않는다(0032 선례). 검증은 lib/forms/schema.ts가 한다.
--   ※ MySQL users 와는 교차 저장소라 FK 없이 user_id TEXT(UUID)로만 잇는다(0018 선례).
--   ※ 증빙 테이블에는 상위 CASCADE 를 걸지 않는다 — 폼 삭제로 동의 증빙이 연쇄 소멸하면 안 된다.
-- Apply: npm run d1:migrate migrations/0035_registration_forms.sql
```

이어서 설계서 §4.2의 테이블 8블록(`forms`, `form_schema_versions`, `form_responses`, `form_response_selections`, `form_response_consents`, `form_response_notes`, `form_sensitive_views`, `ALTER TABLE programs`)을 그대로 복사한다. 인덱스도 전부.

- [ ] **Step 2: 마이그레이션 적용**

Run: `npm run d1:migrate migrations/0035_registration_forms.sql`
Expected: 각 문장이 OK로 통과. `ALTER TABLE programs ADD COLUMN`이 이미 있으면 "duplicate column name"을 러너가 흡수한다.

- [ ] **Step 3: 적용 확인**

Run:
```bash
node --env-file=.env.local -e "
const q=async(sql)=>{const r=await fetch(\`https://api.cloudflare.com/client/v4/accounts/\${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/\${process.env.D1_DATABASE_ID}/query\`,{method:'POST',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({sql})});const j=await r.json();console.log(JSON.stringify(j.success?j.result[0].results:j.errors));};
await q(\"SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'form%' ORDER BY name\");
"
```
Expected: `forms`, `form_response_consents`, `form_response_notes`, `form_response_selections`, `form_responses`, `form_schema_versions`, `form_sensitive_views` 7개가 나온다.

- [ ] **Step 4: 타입 정의**

`types/forms.ts`를 만든다. **DB·React를 import하지 않는다** (클라이언트 컴포넌트에서도 안전해야 한다 — `types/permissions.ts` 선례).

```ts
/**
 * 신청서(질문지) 시스템 공용 타입
 *
 * DB 의존성이 없어 서버·클라이언트 어디서나 import 가능하다.
 * schema_json 의 구조가 이 파일의 핵심이다 — 문항이 스스로 "이 답이 어디로 가는가"를
 * 말하고(bind / selectionOf / consentKey), lib/forms/schema.ts 가 그 지시를 실행한다.
 */

/** 한/영 병기 텍스트. en 이 비면 ko 로 폴백한다. */
export interface Bilingual {
  ko: string;
  en?: string;
}

export type FormStatus = 'draft' | 'open' | 'closed' | 'archived';
export type FormKind = 'season' | 'workshop' | 'survey';

export type ResponseStatus =
  | 'new' | 'reviewing' | 'needs_info' | 'accepted' | 'enrolled' | 'declined' | 'cancelled';

export type ResponseSource = 'public' | 'staff' | 'import';

/** 응답이 회원과 이어진 경로 — 동의 증빙의 신뢰 등급이다. */
export type LinkSource = 'session' | 'signup' | 'login_backfill' | 'manual';

export type QuestionType = 'short' | 'long' | 'single' | 'multi' | 'consent' | 'info';

/**
 * 코어 컬럼으로 복사되는 bind 값의 전체 목록.
 * 여기 없는 bind 는 validateSchema 가 저장을 거부한다 — 코어 컬럼을 늘리려면
 * 이 상수와 마이그레이션을 같은 커밋에서 함께 고쳐야 한다(설계서 §4.1.3).
 */
export const CORE_BIND_KEYS = [
  'student_name',
  'student_grade',
  'email',
  'phone',
  'guardian_name',
] as const;
export type CoreBindKey = (typeof CORE_BIND_KEYS)[number];

export interface FormOption {
  /** 불변 키. 첫 제출 이후 변경·삭제 불가(응답이 이 키를 가리킨다). */
  key: string;
  label: Bilingual;
  /** 수강 배정의 다리. 없으면 승격이 불가능하다(게시 게이트가 경고). */
  programId?: number;
  /** 명단 화면의 `7 / 10` 표시용. 자동 마감은 하지 않는다. */
  capacity?: number;
  /** 학비표 룩업 키(lib/forms/tuition.ts). 미정이면 생략. */
  courseCode?: string;
  /** 고르면 같은 문항의 나머지가 해제된다(Q11 "해당 없음"). */
  exclusive?: boolean;
  /** consent 축으로 승격될 때의 동의 값. */
  consentValue?: boolean;
  /** 툼스톤 — 렌더하지 않되 옛 응답 해석은 유지. */
  retired?: boolean;
}

/** 1단계 조건부 노출. 중첩·다중조건은 만들지 않는다(설계서 §3.5). */
export interface ShowIf {
  question: string;
  /** single/consent 대상: 값이 이 중 하나면 표시 */
  equals?: string[];
  /** multi 대상: 이 중 하나라도 선택돼 있으면 표시 */
  includes?: string[];
}

export interface FormQuestion {
  /** 불변 키. 삭제는 retired 툼스톤으로만. */
  key: string;
  type: QuestionType;
  required: boolean;
  label: Bilingual;
  help?: Bilingual;
  options?: FormOption[];
  /** 다중선택 최소 개수(multi 전용) */
  minSelect?: number;
  /** 코어 컬럼으로 복사하라는 지시 */
  bind?: CoreBindKey;
  /** 선택 파생 테이블로 승격하라는 지시(값은 분류 라벨, 예: 'class') */
  selectionOf?: string;
  /** 동의 파생 테이블로 승격하라는 지시 */
  consentKey?: string;
  /** 민감 문항 — 목록·기본 CSV 제외, 열람 시 기록 */
  sensitive?: boolean;
  format?: 'email' | 'tel';
  showIf?: ShowIf;
  retired?: boolean;
}

export interface FormSection {
  key: string;
  title?: Bilingual;
  body?: Bilingual;
  questions: FormQuestion[];
}

export interface FormSchema {
  version: number;
  presetKey?: string;
  sections: FormSection[];
}

/** answers_json 의 값 형태: short/long → string, single → option key, multi → key[], consent → boolean */
export type AnswerValue = string | string[] | boolean | null;
export type Answers = Record<string, AnswerValue>;

export interface FormRow {
  id: number;
  slug: string;
  season: string | null;
  kind: FormKind;
  preset_key: string | null;
  title_ko: string;
  title_en: string | null;
  description_ko: string | null;
  description_en: string | null;
  status: FormStatus;
  schema_json: string;
  schema_version: number;
  opens_at: string | null;
  closes_at: string | null;
  requires_login: number;
  allow_resubmit: number;
  locked_at: string | null;
  copied_from_form_id: number | null;
  created_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FormResponseRow {
  id: number;
  form_id: number;
  form_title_ko: string | null;
  form_schema_version: number;
  season: string | null;
  locale: string;
  submitted_by_user_id: string | null;
  student_user_id: string | null;
  link_source: LinkSource | null;
  student_name: string;
  student_name_norm: string;
  student_grade: string | null;
  email: string | null;
  email_norm: string | null;
  phone: string | null;
  guardian_name: string | null;
  status: ResponseStatus;
  source: ResponseSource;
  is_latest: number;
  supersedes_response_id: number | null;
  has_medical: number;
  derived_dirty: number;
  internal_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  enrolled_at: string | null;
  answers_json: string;
  meta_json: string | null;
  submit_ip_hash: string | null;
  submitted_at: string;
  updated_at: string;
}

/** 파생: 선택 축 */
export interface FormResponseSelection {
  id: number;
  response_id: number;
  question_key: string;
  option_key: string;
  option_label_ko: string | null;
  option_label_en: string | null;
  program_id: number | null;
}

/** 파생: 동의 축 */
export interface FormResponseConsent {
  id: number;
  response_id: number;
  consent_key: string;
  question_key: string;
  agreed: number;
  policy_version: number;
  policy_text_hash: string | null;
  agreed_at: string;
}

export interface FormResponseNote {
  id: number;
  response_id: number;
  kind: 'note' | 'status' | 'link' | 'enroll' | 'rebuild';
  from_status: string | null;
  to_status: string | null;
  body: string | null;
  author_id: string | null;
  author_name: string | null;
  created_at: string;
}
```

- [ ] **Step 5: 타입 컴파일 확인**

Run: `npx tsc --noEmit`
Expected: 에러 0건.

- [ ] **Step 6: 커밋**

```bash
git add migrations/0035_registration_forms.sql types/forms.ts
git commit -m "feat(forms): 신청서 시스템 스키마와 공용 타입

D1 7테이블 + programs.active_form_id. 응답의 진실은 answers_json 한 곳이고
선택·동의 두 축만 재계산 가능한 파생 테이블로 승격한다 — D1이 트랜잭션을
거부하므로 응답 본체가 단일 INSERT로 착지해야 하기 때문이다."
```

---

## Task 2: 스키마 엔진 (순수 함수 + 시험)

이 태스크가 시스템의 심장이다. **부수효과가 없으므로 전부 TDD로 만든다.**

**Files:**
- Create: `lib/forms/schema.ts`
- Test: `lib/forms/schema.test.ts`

**Interfaces:**
- Consumes: `types/forms.ts`의 전 타입 (상대 경로 `../../types/forms.ts`로 import)
- Produces:
  - `validateSchema(schema: FormSchema): string[]` — 차단 사유 배열(빈 배열 = 통과)
  - `warnSchema(schema: FormSchema): string[]` — 경고 사유 배열(게시는 가능)
  - `evaluateShowIf(q: FormQuestion, answers: Answers): boolean` — 이 문항이 지금 보이는가
  - `visibleQuestions(schema: FormSchema, answers: Answers): FormQuestion[]`
  - `validateAnswers(schema: FormSchema, answers: Answers): Record<string, string>` — 문항키 → 오류 메시지
  - `applyBindings(schema, answers, schemaVersion)` → `{ core, selections, consents, hasMedical }`
  - `assertEditAllowed(before: FormSchema, after: FormSchema, locked: boolean): string[]` — 잠금 이후 파괴적 편집 차단 사유
  - `normalizeName(s: string): string`, `normalizeEmail(s: string): string`

- [ ] **Step 1: 실패하는 시험을 쓴다 — validateSchema 차단 8종**

`lib/forms/schema.test.ts`:

```ts
/**
 * lib/forms/schema.test.ts — 신청서 스키마 엔진의 불변식을 잠근다
 *
 * 이 시험이 지키는 것은 함수가 아니라 **설계의 선**이다.
 * 이 도메인의 사고는 조용하다: bind 를 잘못 적으면 폼은 멀쩡히 돌아가는데
 * 명단이 안 나오고, 선택지를 지우면 이미 낸 응답이 가리킬 곳을 잃는다.
 * 그래서 게이트가 무엇을 막고 무엇을 통과시키는지를 여기서 못박는다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBindings,
  assertEditAllowed,
  evaluateShowIf,
  normalizeEmail,
  normalizeName,
  validateAnswers,
  validateSchema,
  visibleQuestions,
  warnSchema,
} from './schema.ts';
import type { Answers, FormSchema } from '../../types/forms.ts';

/** 최소 유효 스키마 — 각 시험이 필요한 것만 덧댄다. */
function baseSchema(questions: FormSchema['sections'][0]['questions']): FormSchema {
  return { version: 1, sections: [{ key: 's1', questions }] };
}

test('문항 key 가 중복되면 저장을 거부한다', () => {
  const s = baseSchema([
    { key: 'q1', type: 'short', required: true, label: { ko: 'A' } },
    { key: 'q1', type: 'short', required: false, label: { ko: 'B' } },
  ]);
  const errs = validateSchema(s);
  assert.ok(errs.some((e) => e.includes('q1')), `중복 키를 잡아야 한다: ${JSON.stringify(errs)}`);
});

test('문항 key 가 비ASCII 이거나 비어 있으면 거부한다', () => {
  // 키는 URL·CSV 헤더·SQL 파라미터를 오간다. 안전한 문자만 허용한다.
  assert.ok(validateSchema(baseSchema([{ key: '학생', type: 'short', required: true, label: { ko: 'A' } }])).length > 0);
  assert.ok(validateSchema(baseSchema([{ key: '', type: 'short', required: true, label: { ko: 'A' } }])).length > 0);
});

test('CORE_BIND_KEYS 에 없는 bind 는 거부한다 — 코어 컬럼은 코드로만 늘린다', () => {
  const s = baseSchema([
    // @ts-expect-error 의도적으로 잘못된 bind
    { key: 'q1', type: 'short', required: true, label: { ko: 'A' }, bind: 'nickname' },
  ]);
  assert.ok(validateSchema(s).some((e) => e.includes('bind')));
});

test('같은 bind 를 두 문항이 쓰면 거부한다 — 어느 답이 컬럼에 갈지 모호해진다', () => {
  const s = baseSchema([
    { key: 'q1', type: 'short', required: true, label: { ko: 'A' }, bind: 'email' },
    { key: 'q2', type: 'short', required: true, label: { ko: 'B' }, bind: 'email' },
  ]);
  assert.ok(validateSchema(s).some((e) => e.includes('email')));
});

test('consentKey 가 중복되면 거부한다 — 동의 증빙이 덮어써진다', () => {
  const s = baseSchema([
    { key: 'q1', type: 'consent', required: true, label: { ko: 'A' }, consentKey: 'final' },
    { key: 'q2', type: 'consent', required: true, label: { ko: 'B' }, consentKey: 'final' },
  ]);
  assert.ok(validateSchema(s).some((e) => e.includes('final')));
});

test('showIf 가 없는 문항·선택지를 가리키면 거부한다 — 영영 안 보이는 문항이 생긴다', () => {
  const s = baseSchema([
    { key: 'q1', type: 'single', required: true, label: { ko: 'A' }, options: [{ key: 'yes', label: { ko: '예' } }] },
    { key: 'q2', type: 'long', required: false, label: { ko: 'B' }, showIf: { question: 'qX', equals: ['no'] } },
  ]);
  assert.ok(validateSchema(s).some((e) => e.includes('qX')));

  const s2 = baseSchema([
    { key: 'q1', type: 'single', required: true, label: { ko: 'A' }, options: [{ key: 'yes', label: { ko: '예' } }] },
    { key: 'q2', type: 'long', required: false, label: { ko: 'B' }, showIf: { question: 'q1', equals: ['nope'] } },
  ]);
  assert.ok(validateSchema(s2).some((e) => e.includes('nope')));
});

test('같은 문항 안 선택지 key 가 중복되면 거부한다', () => {
  const s = baseSchema([
    { key: 'q1', type: 'multi', required: true, label: { ko: 'A' },
      options: [{ key: 'a', label: { ko: 'A' } }, { key: 'a', label: { ko: 'B' } }] },
  ]);
  assert.ok(validateSchema(s).length > 0);
});

test('minSelect 가 선택지 수보다 크면 거부한다 — 제출 불가능한 폼이 된다', () => {
  const s = baseSchema([
    { key: 'q1', type: 'multi', required: true, minSelect: 3, label: { ko: 'A' },
      options: [{ key: 'a', label: { ko: 'A' } }, { key: 'b', label: { ko: 'B' } }] },
  ]);
  assert.ok(validateSchema(s).length > 0);
});

test("format:'email' 은 short 문항에만 붙일 수 있다", () => {
  const s = baseSchema([
    { key: 'q1', type: 'long', required: true, label: { ko: 'A' }, format: 'email' },
  ]);
  assert.ok(validateSchema(s).length > 0);
});

test('정상 스키마는 통과한다', () => {
  const s = baseSchema([
    { key: 'q1', type: 'short', required: true, label: { ko: '이름' }, bind: 'student_name' },
    { key: 'q2', type: 'single', required: true, label: { ko: '기간' },
      options: [{ key: 'm3', label: { ko: '3개월' } }] },
  ]);
  assert.deepEqual(validateSchema(s), []);
});
```

- [ ] **Step 2: 시험을 돌려 실패를 확인한다**

Run: `npm test -- --test-name-pattern="스키마"` 또는 `node --test lib/forms/schema.test.ts`
Expected: FAIL — `Cannot find module './schema.ts'`

- [ ] **Step 3: validateSchema / warnSchema 를 구현한다**

`lib/forms/schema.ts` (파일 상단 주석 + 두 함수):

```ts
/**
 * lib/forms/schema.ts — 신청서 스키마 엔진 (순수 함수만)
 *
 * 이 파일은 DB도 React도 모른다. 그래서 시험할 수 있고, 그래서 게이트를
 * 믿을 수 있다. 부수효과가 붙은 쪽은 lib/d1/forms.ts · lib/d1/formResponses.ts 다.
 *
 * 설계의 핵심: 문항이 스스로 "이 답이 어디로 가는가"를 말한다.
 *   bind        → form_responses 코어 컬럼
 *   selectionOf → form_response_selections (과목별 명단의 축)
 *   consentKey  → form_response_consents (법적 증빙의 축)
 * 지시자가 없으면 답은 answers_json 에만 남는다. applyBindings 가 그 지시를 실행한다.
 *
 * ※ node --test 가 @/ 별칭을 풀지 못하므로 상대 경로 + .ts 로 import 한다.
 */

import { CORE_BIND_KEYS, type Answers, type CoreBindKey, type FormQuestion, type FormSchema } from '../../types/forms.ts';

const KEY_RE = /^[a-z0-9_]+$/;

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

  // showIf 참조 검증 — 자기 자신보다 앞선 문항만 가리킬 수 있는지는 강제하지 않는다
  // (섹션 순서를 바꿔도 폼이 깨지지 않게). 존재만 확인한다.
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
 * 여기 있는 항목이 "운영 준비 상태" 패널의 ✗ 줄이 된다.
 */
export function warnSchema(schema: FormSchema): string[] {
  const warnings: string[] = [];
  for (const q of allQuestions(schema)) {
    if (!q.selectionOf) continue;
    const unlinked = (q.options ?? []).filter((o) => !o.retired && o.programId == null);
    if (unlinked.length > 0) {
      warnings.push(
        `수강 배정 — 과목 ${unlinked.length}개에 수업이 연결되지 않았습니다: ` +
          unlinked.map((o) => o.label.ko).join(', ')
      );
    }
    const noCapacity = (q.options ?? []).filter((o) => !o.retired && o.capacity == null);
    if (noCapacity.length > 0) {
      warnings.push(`정원이 지정되지 않은 과목 ${noCapacity.length}개 — 명단에 잔여 수가 표시되지 않습니다`);
    }
    const noCourse = (q.options ?? []).filter((o) => !o.retired && !o.courseCode);
    if (noCourse.length > 0) {
      warnings.push(`학비표 코스가 연결되지 않은 과목 ${noCourse.length}개 — 학비 조회 보조가 동작하지 않습니다`);
    }
  }
  return warnings;
}
```

- [ ] **Step 4: 시험을 돌려 통과를 확인한다**

Run: `node --test lib/forms/schema.test.ts`
Expected: validateSchema 관련 10개 PASS. 나머지 import(`evaluateShowIf` 등)는 아직 없어 모듈 로드가 실패한다 → 다음 스텝에서 채운다.

- [ ] **Step 5: 조건부 노출·답변 검증 시험을 추가한다**

`lib/forms/schema.test.ts`에 이어 붙인다:

```ts
const CONDITIONAL: FormSchema = {
  version: 1,
  sections: [
    { key: 's', questions: [
      { key: 'q8_perform', type: 'single', required: true, label: { ko: '공연 참가' },
        options: [{ key: 'yes', label: { ko: '예' } }, { key: 'no', label: { ko: '아니오' } }] },
      { key: 'q9_reason', type: 'long', required: true, label: { ko: '사유' },
        showIf: { question: 'q8_perform', equals: ['no'] } },
      { key: 'q7_classes', type: 'multi', required: true, minSelect: 1, selectionOf: 'class', label: { ko: '과목' },
        options: [
          { key: 'kids_dance', label: { ko: '유년부 무용' }, programId: 13 },
          { key: 'youth_repertoire', label: { ko: '중고등부 작품반' }, programId: 15 },
        ] },
      { key: 'q11_prop', type: 'single', required: true, consentKey: 'prop_fee', label: { ko: '소품비' },
        showIf: { question: 'q7_classes', includes: ['youth_repertoire'] },
        options: [
          { key: 'agree', label: { ko: '동의' }, consentValue: true },
          { key: 'na', label: { ko: '해당 없음' }, consentValue: false, exclusive: true },
        ] },
    ] },
  ],
};

test("equals 조건은 값이 일치할 때만 문항을 보여준다", () => {
  const q9 = CONDITIONAL.sections[0].questions[1];
  assert.equal(evaluateShowIf(q9, { q8_perform: 'no' }), true);
  assert.equal(evaluateShowIf(q9, { q8_perform: 'yes' }), false);
  // 아직 답하지 않았으면 보여주지 않는다 — 빈 화면에 사유부터 묻지 않는다
  assert.equal(evaluateShowIf(q9, {}), false);
});

test('includes 조건은 다중선택 안에 그 선택지가 있을 때만 보여준다', () => {
  const q11 = CONDITIONAL.sections[0].questions[3];
  assert.equal(evaluateShowIf(q11, { q7_classes: ['youth_repertoire'] }), true);
  assert.equal(evaluateShowIf(q11, { q7_classes: ['kids_dance'] }), false);
  assert.equal(evaluateShowIf(q11, { q7_classes: ['kids_dance', 'youth_repertoire'] }), true);
});

test('숨겨진 문항은 필수 검증에서 제외된다 — 이것이 구글폼이 못 하던 것이다', () => {
  // 공연에 참가하면 사유(q9)는 필수가 아니다. 구글폼에서는 전원 필수였다.
  const errs = validateAnswers(CONDITIONAL, { q8_perform: 'yes', q7_classes: ['kids_dance'], q11_prop: 'na' });
  assert.ok(!('q9_reason' in errs), `숨겨진 문항이 필수로 잡혔다: ${JSON.stringify(errs)}`);
});

test('보이는 필수 문항이 비면 오류를 낸다', () => {
  const errs = validateAnswers(CONDITIONAL, { q8_perform: 'no', q7_classes: ['kids_dance'], q11_prop: 'na' });
  assert.ok('q9_reason' in errs);
});

test('multi 의 minSelect 미달은 오류다', () => {
  const errs = validateAnswers(CONDITIONAL, { q8_perform: 'yes', q7_classes: [], q11_prop: 'na' });
  assert.ok('q7_classes' in errs);
});

test('선택지에 없는 값을 보내면 오류다 — 조작된 제출을 막는다', () => {
  const errs = validateAnswers(CONDITIONAL, { q8_perform: 'maybe', q7_classes: ['kids_dance'], q11_prop: 'na' });
  assert.ok('q8_perform' in errs);
});

test('visibleQuestions 는 지금 화면에 떠야 할 문항만 준다', () => {
  const keys = visibleQuestions(CONDITIONAL, { q8_perform: 'yes', q7_classes: ['kids_dance'] }).map((q) => q.key);
  assert.deepEqual(keys, ['q8_perform', 'q7_classes']);
});
```

- [ ] **Step 6: evaluateShowIf / visibleQuestions / validateAnswers 를 구현한다**

`lib/forms/schema.ts`에 이어 붙인다:

```ts
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
 * 답변 검증. 문항키 → 한국어 오류 메시지.
 * **숨겨진 문항은 검증하지 않는다** — 이것이 조건부 노출의 핵심이다.
 */
export function validateAnswers(schema: FormSchema, answers: Answers): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const q of visibleQuestions(schema, answers)) {
    if (q.type === 'info') continue;
    const v = answers[q.key];

    if (q.type === 'multi') {
      const arr = Array.isArray(v) ? v : [];
      const min = q.minSelect ?? (q.required ? 1 : 0);
      if (arr.length < min) {
        errors[q.key] = min === 1 ? '하나 이상 선택해 주세요.' : `${min}개 이상 선택해 주세요.`;
        continue;
      }
      const valid = new Set((q.options ?? []).map((o) => o.key));
      if (arr.some((k) => !valid.has(k))) errors[q.key] = '선택할 수 없는 항목이 포함되어 있습니다.';
      continue;
    }

    if (q.type === 'consent') {
      if (q.required && v !== true) errors[q.key] = '동의가 필요합니다.';
      continue;
    }

    if (q.type === 'single') {
      if (v == null || v === '') {
        if (q.required) errors[q.key] = '선택해 주세요.';
        continue;
      }
      const valid = new Set((q.options ?? []).map((o) => o.key));
      if (typeof v !== 'string' || !valid.has(v)) errors[q.key] = '선택할 수 없는 항목입니다.';
      continue;
    }

    // short | long
    const s = typeof v === 'string' ? v.trim() : '';
    if (!s) {
      if (q.required) errors[q.key] = '입력해 주세요.';
      continue;
    }
    if (q.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
      errors[q.key] = '이메일 형식이 올바르지 않습니다.';
    }
    if (q.format === 'tel' && s.replace(/\D/g, '').length < 7) {
      errors[q.key] = '전화번호를 확인해 주세요.';
    }
  }

  return errors;
}
```

- [ ] **Step 7: 시험을 돌려 통과를 확인한다**

Run: `node --test lib/forms/schema.test.ts`
Expected: 조건부·검증 시험 7개 추가 PASS.

- [ ] **Step 8: applyBindings 시험을 추가한다**

```ts
test('applyBindings 는 코어 컬럼·선택 파생·동의 파생을 정확히 만든다', () => {
  const answers: Answers = {
    q8_perform: 'yes',
    q7_classes: ['kids_dance', 'youth_repertoire'],
    q11_prop: 'agree',
  };
  const out = applyBindings(CONDITIONAL, answers, 3);

  // 선택 축: 라벨과 programId 를 스냅샷한다 — CSV·명단이 스키마를 안 읽고도 성립해야 한다
  assert.equal(out.selections.length, 2);
  const yr = out.selections.find((s) => s.option_key === 'youth_repertoire');
  assert.equal(yr?.program_id, 15);
  assert.equal(yr?.option_label_ko, '중고등부 작품반');
  assert.equal(yr?.question_key, 'q7_classes');

  // 동의 축: consentValue 가 boolean 으로 접힌다
  assert.equal(out.consents.length, 1);
  assert.equal(out.consents[0].consent_key, 'prop_fee');
  assert.equal(out.consents[0].agreed, 1);
  assert.equal(out.consents[0].policy_version, 3);
});

test('숨겨진 동의 문항은 파생을 만들지 않는다 — 안 본 것에 동의시키지 않는다', () => {
  // 중고등부 작품반을 안 골랐으면 q11(칼 소품비)은 화면에 없었다.
  const out = applyBindings(CONDITIONAL, { q8_perform: 'yes', q7_classes: ['kids_dance'] }, 1);
  assert.equal(out.consents.length, 0);
});

test('bind 가 붙은 문항의 답이 코어 컬럼으로 복사된다', () => {
  const s: FormSchema = { version: 1, sections: [{ key: 's', questions: [
    { key: 'name', type: 'short', required: true, bind: 'student_name', label: { ko: '이름' } },
    { key: 'mail', type: 'short', required: true, bind: 'email', format: 'email', label: { ko: '메일' } },
    { key: 'tel', type: 'short', required: true, bind: 'phone', format: 'tel', label: { ko: '전화' } },
  ] }] };
  const out = applyBindings(s, { name: '  김하늘 ', mail: 'A@B.com', tel: '917-555-0100' }, 1);
  assert.equal(out.core.student_name, '김하늘');
  assert.equal(out.core.email, 'A@B.com');
  assert.equal(out.core.email_norm, 'a@b.com');
  assert.equal(out.core.student_name_norm, '김하늘');
  assert.equal(out.core.phone, '917-555-0100');
});

test('민감 문항에 값이 있으면 has_medical 이 선다 — 내용은 여기서 다루지 않는다', () => {
  const s: FormSchema = { version: 1, sections: [{ key: 's', questions: [
    { key: 'med', type: 'long', required: false, sensitive: true, label: { ko: '건강' } },
  ] }] };
  assert.equal(applyBindings(s, { med: '땅콩 알레르기' }, 1).hasMedical, true);
  assert.equal(applyBindings(s, { med: '   ' }, 1).hasMedical, false);
  assert.equal(applyBindings(s, {}, 1).hasMedical, false);
});

test('이름 정규화는 공백을 지우고 소문자로 — 중복 판정의 키다', () => {
  assert.equal(normalizeName(' 김 하늘 '), '김하늘');
  assert.equal(normalizeName('Kim  Haneul'), 'kimhaneul');
  assert.equal(normalizeEmail('  A@B.COM '), 'a@b.com');
});
```

- [ ] **Step 9: applyBindings 와 정규화를 구현한다**

```ts
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
        case 'student_grade': core.student_grade = s || null; break;
        case 'email':
          core.email = s || null;
          core.email_norm = s ? normalizeEmail(s) : null;
          break;
        case 'phone': core.phone = s || null; break;
        case 'guardian_name': core.guardian_name = s || null; break;
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
      if (q.type === 'consent') agreed = v === true;
      else if (typeof v === 'string') {
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
```

- [ ] **Step 10: 시험 통과 확인**

Run: `node --test lib/forms/schema.test.ts`
Expected: 전부 PASS.

- [ ] **Step 11: 잠금(assertEditAllowed) 시험을 추가한다**

```ts
const LOCKED_BEFORE: FormSchema = { version: 1, sections: [{ key: 's', questions: [
  { key: 'q1', type: 'single', required: false, label: { ko: 'A' },
    options: [{ key: 'a', label: { ko: 'A' } }, { key: 'b', label: { ko: 'B' } }] },
  { key: 'q2', type: 'short', required: false, label: { ko: 'B' }, bind: 'email' },
] }] };

function withQuestions(qs: FormSchema['sections'][0]['questions']): FormSchema {
  return { version: 1, sections: [{ key: 's', questions: qs }] };
}

test('첫 제출 이후에는 문항을 지울 수 없다 — 이미 낸 응답이 가리킬 곳을 잃는다', () => {
  const after = withQuestions([LOCKED_BEFORE.sections[0].questions[0]]);
  assert.ok(assertEditAllowed(LOCKED_BEFORE, after, true).some((e) => e.includes('q2')));
  // 잠기기 전이면 자유롭다
  assert.deepEqual(assertEditAllowed(LOCKED_BEFORE, after, false), []);
});

test('첫 제출 이후에는 선택지를 지울 수 없다', () => {
  const after = withQuestions([
    { key: 'q1', type: 'single', required: false, label: { ko: 'A' }, options: [{ key: 'a', label: { ko: 'A' } }] },
    LOCKED_BEFORE.sections[0].questions[1],
  ]);
  assert.ok(assertEditAllowed(LOCKED_BEFORE, after, true).some((e) => e.includes('b')));
});

test('첫 제출 이후에는 문항 유형·bind·consentKey 를 바꿀 수 없다', () => {
  const typeChanged = withQuestions([
    { ...LOCKED_BEFORE.sections[0].questions[0], type: 'multi' },
    LOCKED_BEFORE.sections[0].questions[1],
  ]);
  assert.ok(assertEditAllowed(LOCKED_BEFORE, typeChanged, true).length > 0);

  const bindChanged = withQuestions([
    LOCKED_BEFORE.sections[0].questions[0],
    { ...LOCKED_BEFORE.sections[0].questions[1], bind: 'phone' as const },
  ]);
  assert.ok(assertEditAllowed(LOCKED_BEFORE, bindChanged, true).length > 0);
});

test('required 를 켜는 것은 막고, 끄는 것은 허용한다 — 소급 무효를 막되 운영자를 가두지 않는다', () => {
  const turnedOn = withQuestions([
    { ...LOCKED_BEFORE.sections[0].questions[0], required: true },
    LOCKED_BEFORE.sections[0].questions[1],
  ]);
  assert.ok(assertEditAllowed(LOCKED_BEFORE, turnedOn, true).length > 0);

  const alreadyRequired = withQuestions([
    { ...LOCKED_BEFORE.sections[0].questions[0], required: true },
    LOCKED_BEFORE.sections[0].questions[1],
  ]);
  const turnedOff = withQuestions([
    { ...LOCKED_BEFORE.sections[0].questions[0], required: false },
    LOCKED_BEFORE.sections[0].questions[1],
  ]);
  assert.deepEqual(assertEditAllowed(alreadyRequired, turnedOff, true), []);
});

test('문항 추가·선택지 추가·문구 수정은 잠긴 뒤에도 허용한다', () => {
  const added = withQuestions([
    { ...LOCKED_BEFORE.sections[0].questions[0], label: { ko: '고친 문구' },
      options: [{ key: 'a', label: { ko: 'A' } }, { key: 'b', label: { ko: 'B' } }, { key: 'c', label: { ko: 'C' } }] },
    LOCKED_BEFORE.sections[0].questions[1],
    { key: 'q3', type: 'long', required: false, label: { ko: '새 문항' } },
  ]);
  assert.deepEqual(assertEditAllowed(LOCKED_BEFORE, added, true), []);
});

test('retired 툼스톤은 삭제로 치지 않는다 — 지우는 대신 감추는 길', () => {
  const tombstoned = withQuestions([
    LOCKED_BEFORE.sections[0].questions[0],
    { ...LOCKED_BEFORE.sections[0].questions[1], retired: true },
  ]);
  assert.deepEqual(assertEditAllowed(LOCKED_BEFORE, tombstoned, true), []);
});
```

- [ ] **Step 12: assertEditAllowed 를 구현한다**

```ts
/**
 * 첫 제출(locked_at) 이후 파괴적 편집을 막는다.
 *
 * 관례가 아니라 **코드 강제**여야 한다. 에디터가 삭제 버튼을 진짜 삭제로 구현하면
 * 그날로 옛 응답이 가리킬 곳을 잃기 때문이다. 지우는 대신 retired 툼스톤을 쓴다.
 *
 * required 를 끄는 것은 허용한다 — "실수로 필수로 만들었는데 이미 3명이 냈다"에서
 * 운영자가 막히면 안 된다. 증빙은 form_schema_versions 스냅샷이 지킨다.
 */
export function assertEditAllowed(before: FormSchema, after: FormSchema, locked: boolean): string[] {
  if (!locked) return [];
  const errors: string[] = [];
  const afterByKey = new Map(allQuestions(after).map((q) => [q.key, q]));

  for (const b of allQuestions(before)) {
    const a = afterByKey.get(b.key);
    if (!a) {
      errors.push(`이미 응답이 있는 신청서에서는 문항을 지울 수 없습니다: "${b.key}" (감추려면 '사용 안 함'을 쓰세요)`);
      continue;
    }
    if (a.type !== b.type) errors.push(`문항 유형을 바꿀 수 없습니다: "${b.key}"`);
    if (a.bind !== b.bind) errors.push(`문항의 연결(bind)을 바꿀 수 없습니다: "${b.key}"`);
    if (a.consentKey !== b.consentKey) errors.push(`동의 키를 바꿀 수 없습니다: "${b.key}"`);
    if (a.selectionOf !== b.selectionOf) errors.push(`선택 축을 바꿀 수 없습니다: "${b.key}"`);
    if (a.required && !b.required) {
      errors.push(`이미 응답이 있는 문항을 필수로 바꿀 수 없습니다: "${b.key}" (이미 낸 응답이 소급 무효가 됩니다)`);
    }

    const afterOptionKeys = new Set((a.options ?? []).map((o) => o.key));
    for (const o of b.options ?? []) {
      if (!afterOptionKeys.has(o.key)) {
        errors.push(`이미 응답이 있는 신청서에서는 선택지를 지울 수 없습니다: "${o.key}" (문항 ${b.key})`);
      }
    }
  }

  return errors;
}
```

- [ ] **Step 13: 전체 시험 통과 확인**

Run: `npm test`
Expected: 신규 시험 전부 PASS + 기존 시험 회귀 없음.

- [ ] **Step 14: 커밋**

```bash
git add lib/forms/schema.ts lib/forms/schema.test.ts
git commit -m "feat(forms): 스키마 엔진 — 게이트·조건부 노출·파생 유도

문항이 스스로 '이 답이 어디로 가는가'를 말하고(bind/selectionOf/consentKey)
applyBindings 가 그 지시를 실행한다. 숨겨진 문항은 검증도 파생도 하지 않는다 —
응답자가 보지 않은 것에 동의시키지 않기 위해서다.
잠금 이후 파괴적 편집은 관례가 아니라 코드로 막는다."
```

---

## Task 3: D1 접근층

**Files:**
- Create: `lib/d1/chunk.ts`, `lib/d1/formViews.ts`, `lib/d1/formViews.test.ts`, `lib/d1/forms.ts`, `lib/d1/formResponses.ts`
- Modify: `lib/d1/client.ts` (`batchD1` 추가), `lib/d1/index.ts` (re-export)

**Interfaces:**
- Consumes: Task 1의 타입, Task 2의 `applyBindings`/`validateSchema`/`assertEditAllowed`
- Produces:
  - `chunkParams<T>(values: T[], size?: number): T[][]`
  - `batchD1(statements: {sql: string, params: unknown[]}[]): Promise<void>`
  - `lib/d1/forms.ts`: `getForms`, `getFormById`, `getFormBySlug`, `createForm`, `updateFormSchema`, `updateFormMeta`, `publishForm`, `closeForm`, `duplicateForm`, `snapshotSchemaVersion`, `deleteForm`
  - `lib/d1/formResponses.ts`: `insertResponse`, `getResponses`, `getResponseById`, `rebuildDerived`, `rebuildDirtyForForm`, `updateResponseStatus`, `addResponseNote`, `getResponseNotes`, `recordSensitiveView`, `getRoster`, `getPendingResponseCounts`, `linkResponseToMember`, `markPromoted`
  - `lib/d1/formViews.ts`: `adminResponseList`, `publicFormBySlug`, `rosterView`

- [ ] **Step 1: chunkParams 시험 (formViews.test.ts 와 함께)**

`lib/d1/formViews.test.ts`:

```ts
/**
 * lib/d1/formViews.test.ts — '어느 화면이 어떤 응답을 보는가'와 파라미터 한계를 잠근다
 *
 * D1의 바인딩 파라미터 상한은 100개다(실측). IN 리스트에도 같은 상한이 걸린다.
 * 응답이 100건을 넘는 순간 조용히 터지는 종류의 사고라 시험으로 못박는다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkParams } from './chunk.ts';
import { adminResponseList, publicFormBySlug, rosterView } from './formViews.ts';

test('파라미터는 90개 단위로 쪼갠다 — D1 상한 100 아래로 여유를 둔다', () => {
  const ids = Array.from({ length: 200 }, (_, i) => i);
  const chunks = chunkParams(ids);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].length, 90);
  assert.equal(chunks[2].length, 20);
  assert.deepEqual(chunks.flat(), ids);
});

test('빈 배열은 빈 청크 목록이 된다 — IN () 를 만들지 않는다', () => {
  assert.deepEqual(chunkParams([]), []);
});

test('공개 폼 조회는 게시된 것만 본다 — 초안이 URL 로 새면 안 된다', () => {
  const f = publicFormBySlug('2026-2027-regular');
  assert.equal(f.slug, '2026-2027-regular');
  assert.deepEqual(f.statuses, ['open']);
});

test('운영 응답 목록은 기본으로 최신본만, 취소는 빼고 본다', () => {
  const f = adminResponseList({ formId: 1 });
  assert.equal(f.latestOnly, true);
  assert.equal(f.formId, 1);
  assert.ok(!f.statuses?.includes('cancelled'));
});

test('운영 응답 목록은 상태를 지정하면 그것만 본다 — 취소 열람 경로가 있어야 한다', () => {
  assert.deepEqual(adminResponseList({ formId: 1, status: 'cancelled' }).statuses, ['cancelled']);
});

test('명단은 1년 등록 우선, 그다음 선착순 — 이 정렬이 배정 규칙 자체다', () => {
  const v = rosterView({ formId: 1, periodQuestionKey: 'q6_period', fullYearOptionKey: 'y1' });
  assert.equal(v.orderBy, 'full_year_first');
  assert.equal(v.fullYearOptionKey, 'y1');
});
```

- [ ] **Step 2: 시험 실패 확인**

Run: `node --test lib/d1/formViews.test.ts`
Expected: FAIL — `Cannot find module './chunk.ts'`

- [ ] **Step 3: chunk.ts 와 formViews.ts 를 구현한다**

`lib/d1/chunk.ts`:

```ts
/**
 * D1 바인딩 파라미터 청크 분할
 *
 * D1의 파라미터 상한은 100개다(실측: 100 OK, 101+ 거부). IN 리스트에도 같은
 * 상한이 걸린다. 응답이 늘면 조용히 터지는 자리라, 90개로 여유를 두고 쪼갠다.
 */
export function chunkParams<T>(values: T[], size = 90): T[][] {
  if (values.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}
```

`lib/d1/formViews.ts` — `lib/d1/eventViews.ts`의 "필터가 아니라 관점" 규칙을 따른다:

```ts
/**
 * lib/d1/formViews.ts — 신청서 응답을 "누가 어디서 보는가"로 조회한다
 *
 * eventViews.ts 와 같은 규칙이다: 화면마다 필터를 조립하지 않는다.
 * 조건이 조용히 빠져도 아무도 모르는 것이 이 도메인의 사고이기 때문이다.
 * 여기 없는 관점이 필요하면 새 관점이므로 이 파일에 추가하고 근거를 적을 것.
 */

import type { ResponseStatus } from '../../types/forms.ts';

export interface PublicFormView {
  slug: string;
  /** 공개 조회는 게시된 폼만 본다. 초안이 URL 로 새면 안 된다. */
  statuses: ['open'];
}

/** 공개 폼 페이지 — 방문자가 링크·QR로 들어오는 자리 */
export function publicFormBySlug(slug: string): PublicFormView {
  return { slug, statuses: ['open'] };
}

export interface AdminResponseListView {
  formId: number;
  /** 재제출이 있으면 최신본만 본다. 상태를 콕 집으면 그때만 전부 본다. */
  latestOnly: boolean;
  statuses?: ResponseStatus[];
  search?: string;
  limit: number;
  offset: number;
}

/**
 * 운영 응답 목록 — 신청자를 확인·응대하는 자리.
 * 기본값이 '취소 제외'인 이유: 취소는 되돌린 기록이지 처리 대기 목록이 아니다.
 */
export function adminResponseList(opts: {
  formId: number;
  status?: ResponseStatus;
  search?: string;
  limit?: number;
  offset?: number;
}): AdminResponseListView {
  return {
    formId: opts.formId,
    latestOnly: true,
    statuses: opts.status
      ? [opts.status]
      : ['new', 'reviewing', 'needs_info', 'accepted', 'enrolled', 'declined'],
    search: opts.search,
    limit: Math.min(opts.limit ?? 100, 500),
    offset: opts.offset ?? 0,
  };
}

export interface RosterView {
  formId: number;
  periodQuestionKey: string;
  fullYearOptionKey: string;
  /** 1년 등록 우선 → 그다음 선착순. 이 정렬이 배정 규칙 자체다(삼고무·오고무 북 수량 제한). */
  orderBy: 'full_year_first';
}

/** 과목별 명단 — 반편성을 하는 자리 */
export function rosterView(opts: {
  formId: number;
  periodQuestionKey: string;
  fullYearOptionKey: string;
}): RosterView {
  return { ...opts, orderBy: 'full_year_first' };
}
```

- [ ] **Step 4: 시험 통과 확인**

Run: `node --test lib/d1/formViews.test.ts`
Expected: 6개 PASS.

- [ ] **Step 5: batchD1 을 추가한다**

`lib/d1/client.ts` 끝에 붙인다:

```ts
/**
 * 여러 문장을 순차 실행한다.
 *
 * ⚠️ **롤백이 없다.** D1은 BEGIN/COMMIT을 거부하므로(실측) 중간에 실패하면
 * 앞의 문장은 이미 반영된 상태로 남는다. 그래서 이 함수의 호출부는
 * "실패해도 재계산으로 복구되는 쓰기"로 제한한다 — 지금은 파생 테이블 INSERT 한 곳뿐이다.
 * 응답 본체처럼 원자성이 필요한 쓰기에는 절대 쓰지 말 것(단일 INSERT로 착지시킨다).
 */
export async function batchD1(
  statements: Array<{ sql: string; params?: unknown[] }>
): Promise<void> {
  for (const s of statements) {
    await executeD1(s.sql, s.params ?? []);
  }
}
```

- [ ] **Step 6: lib/d1/forms.ts 를 구현한다**

`lib/d1/forms.ts` — 폼 CRUD. 핵심은 **버전 스냅샷이 게시·편집마다 반드시 남는 것**:

```ts
/**
 * lib/d1/forms.ts — 신청서(질문지) 저장소 접근
 *
 * 게시·편집 때마다 form_schema_versions 에 전문을 박는다. schema_json 은 최신본
 * 하나뿐이라, 문안을 고치면 "그때 무엇을 읽고 동의했는가"의 원문이 사라지기 때문이다.
 * 미성년 대상 미디어·환불 동의를 다루는 이상 해시로 '달라졌음'만 아는 것은 증빙이 아니다.
 */

import { executeD1, queryD1 } from './client';
import { assertEditAllowed, validateSchema } from '@/lib/forms/schema';
import type { FormKind, FormRow, FormSchema, FormStatus } from '@/types/forms';

export async function getForms(opts: { status?: FormStatus } = {}): Promise<FormRow[]> {
  const where = opts.status ? 'WHERE status = ?' : '';
  const params = opts.status ? [opts.status] : [];
  return queryD1<FormRow>(
    `SELECT * FROM forms ${where} ORDER BY COALESCE(season, '') DESC, id DESC`,
    params
  );
}

export async function getFormById(id: number): Promise<FormRow | null> {
  const rows = await queryD1<FormRow>('SELECT * FROM forms WHERE id = ?', [id]);
  return rows[0] ?? null;
}

/** 공개 조회 — formViews.publicFormBySlug 의 관점을 그대로 실행한다. */
export async function getOpenFormBySlug(slug: string): Promise<FormRow | null> {
  const rows = await queryD1<FormRow>(
    "SELECT * FROM forms WHERE slug = ? AND status = 'open'",
    [slug]
  );
  return rows[0] ?? null;
}

export interface CreateFormInput {
  slug: string;
  season: string | null;
  kind: FormKind;
  preset_key: string | null;
  title_ko: string;
  title_en: string | null;
  description_ko: string | null;
  description_en: string | null;
  schema: FormSchema;
  requires_login: boolean;
  created_by: string | null;
}

export async function createForm(input: CreateFormInput): Promise<number> {
  const errors = validateSchema(input.schema);
  if (errors.length > 0) throw new Error(`스키마 검증 실패: ${errors.join(' / ')}`);

  const { lastRowId } = await executeD1(
    `INSERT INTO forms
       (slug, season, kind, preset_key, title_ko, title_en, description_ko, description_en,
        schema_json, schema_version, status, requires_login, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'draft', ?, ?)`,
    [
      input.slug, input.season, input.kind, input.preset_key,
      input.title_ko, input.title_en, input.description_ko, input.description_en,
      JSON.stringify(input.schema), input.requires_login ? 1 : 0, input.created_by,
    ]
  );
  await snapshotSchemaVersion(lastRowId, 1, input.schema, '생성', input.created_by);
  return lastRowId;
}

/** 버전 스냅샷 1행. 편집 1회당 1행이므로 연 수십 행 수준이다. */
export async function snapshotSchemaVersion(
  formId: number,
  version: number,
  schema: FormSchema,
  note: string | null,
  createdBy: string | null
): Promise<void> {
  await executeD1(
    `INSERT INTO form_schema_versions (form_id, version, schema_json, note, created_by)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(form_id, version) DO NOTHING`,
    [formId, version, JSON.stringify(schema), note, createdBy]
  );
}

export async function getSchemaVersion(formId: number, version: number): Promise<FormSchema | null> {
  const rows = await queryD1<{ schema_json: string }>(
    'SELECT schema_json FROM form_schema_versions WHERE form_id = ? AND version = ?',
    [formId, version]
  );
  if (!rows[0]) return null;
  return JSON.parse(rows[0].schema_json) as FormSchema;
}

/**
 * 스키마 저장. 게이트를 통과하지 못하면 저장하지 않는다.
 * 잠긴 폼(locked_at)에서 파괴적 편집이면 LOCKED 접두어로 던져 API가 409를 내게 한다.
 */
export async function updateFormSchema(
  formId: number,
  schema: FormSchema,
  note: string | null,
  editorId: string | null
): Promise<number> {
  const form = await getFormById(formId);
  if (!form) throw new Error('신청서를 찾을 수 없습니다.');

  const errors = validateSchema(schema);
  if (errors.length > 0) throw new Error(`스키마 검증 실패: ${errors.join(' / ')}`);

  const before = JSON.parse(form.schema_json) as FormSchema;
  const lockErrors = assertEditAllowed(before, schema, form.locked_at != null);
  if (lockErrors.length > 0) throw new Error(`LOCKED:${lockErrors.join(' / ')}`);

  const nextVersion = form.schema_version + 1;
  await executeD1(
    `UPDATE forms SET schema_json = ?, schema_version = ?, updated_at = datetime('now') WHERE id = ?`,
    [JSON.stringify(schema), nextVersion, formId]
  );
  await snapshotSchemaVersion(formId, nextVersion, schema, note, editorId);
  return nextVersion;
}

export async function updateFormMeta(
  formId: number,
  input: Partial<Pick<FormRow,
    'slug' | 'season' | 'title_ko' | 'title_en' | 'description_ko' | 'description_en' |
    'opens_at' | 'closes_at' | 'requires_login' | 'allow_resubmit'>>
): Promise<void> {
  const fields = Object.keys(input);
  if (fields.length === 0) return;
  const sets = fields.map((f) => `${f} = ?`).join(', ');
  await executeD1(
    `UPDATE forms SET ${sets}, updated_at = datetime('now') WHERE id = ?`,
    [...fields.map((f) => (input as Record<string, unknown>)[f]), formId]
  );
}

export async function publishForm(formId: number): Promise<void> {
  await executeD1(
    `UPDATE forms SET status = 'open', published_at = COALESCE(published_at, datetime('now')),
                      updated_at = datetime('now')
     WHERE id = ?`,
    [formId]
  );
}

export async function closeForm(formId: number): Promise<void> {
  await executeD1(
    `UPDATE forms SET status = 'closed', updated_at = datetime('now') WHERE id = ?`,
    [formId]
  );
}

/**
 * 연차 복제 — 요구 R2.1. schema_json 컬럼 하나를 복사하면 끝난다.
 * (문항을 정규화 테이블로 쪼갰다면 여기가 행 N+M개 복사가 된다. 그게 이 모델을 고른 이유다.)
 */
export async function duplicateForm(
  sourceId: number,
  input: { slug: string; season: string | null; title_ko: string; createdBy: string | null }
): Promise<number> {
  const src = await getFormById(sourceId);
  if (!src) throw new Error('복제할 신청서를 찾을 수 없습니다.');

  const { lastRowId } = await executeD1(
    `INSERT INTO forms
       (slug, season, kind, preset_key, title_ko, title_en, description_ko, description_en,
        schema_json, schema_version, status, requires_login, allow_resubmit,
        copied_from_form_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'draft', ?, ?, ?, ?)`,
    [
      input.slug, input.season, src.kind, src.preset_key,
      input.title_ko, src.title_en, src.description_ko, src.description_en,
      src.schema_json, src.requires_login, src.allow_resubmit, sourceId, input.createdBy,
    ]
  );
  await snapshotSchemaVersion(
    lastRowId, 1, JSON.parse(src.schema_json) as FormSchema,
    `${src.title_ko} 복제`, input.createdBy
  );
  return lastRowId;
}

/** 응답이 하나라도 있으면 지울 수 없다. */
export async function deleteForm(formId: number): Promise<void> {
  const rows = await queryD1<{ n: number }>(
    'SELECT COUNT(*) AS n FROM form_responses WHERE form_id = ?',
    [formId]
  );
  if ((rows[0]?.n ?? 0) > 0) throw new Error('응답이 있는 신청서는 삭제할 수 없습니다.');
  await executeD1('DELETE FROM form_schema_versions WHERE form_id = ?', [formId]);
  await executeD1('DELETE FROM forms WHERE id = ?', [formId]);
}

export async function slugExists(slug: string, exceptId?: number): Promise<boolean> {
  const rows = await queryD1<{ n: number }>(
    `SELECT COUNT(*) AS n FROM forms WHERE slug = ?${exceptId ? ' AND id != ?' : ''}`,
    exceptId ? [slug, exceptId] : [slug]
  );
  return (rows[0]?.n ?? 0) > 0;
}
```

- [ ] **Step 7: lib/d1/formResponses.ts 를 구현한다**

핵심 규칙 두 가지를 파일 주석에 못박는다: **응답 본체는 단일 INSERT**, **파생은 재계산 가능**.

```ts
/**
 * lib/d1/formResponses.ts — 신청 응답 저장소 접근
 *
 * 두 가지 규칙이 이 파일 전체를 지배한다:
 *
 * 1. **응답 본체는 단일 INSERT 로 착지한다.** D1은 트랜잭션을 거부하므로(실측)
 *    "응답 1행 + 선택 N행 + 동의 M행"을 원자적으로 쓸 방법이 없다. 응답만은
 *    반드시 한 문장으로 들어가야 한다 — 그래야 반쯤 저장된 신청이 생기지 않는다.
 *
 * 2. **answers_json 이 유일한 진실의 원천이고, 파생 두 테이블은 언제든 재계산된다.**
 *    파생 INSERT 가 실패하면 derived_dirty=1 을 세우고 응답은 정상 저장한다.
 *    조회 경로가 그 표시를 보고 조용히 재구축한다 — 운영자에게 "재구축 버튼"을
 *    보여주지 않기 위해서다(파생 인덱스라는 개념을 원장에게 설명해야 하는 UI는 실패다).
 */

import { batchD1, executeD1, queryD1 } from './client';
import { chunkParams } from './chunk';
import { applyBindings } from '@/lib/forms/schema';
import type {
  Answers, FormResponseConsent, FormResponseNote, FormResponseRow,
  FormResponseSelection, FormSchema, LinkSource, ResponseSource, ResponseStatus,
} from '@/types/forms';

export interface InsertResponseInput {
  formId: number;
  formTitleKo: string | null;
  schemaVersion: number;
  season: string | null;
  locale: string;
  schema: FormSchema;
  answers: Answers;
  submittedByUserId: string | null;
  studentUserId: string | null;
  linkSource: LinkSource | null;
  source: ResponseSource;
  metaJson: string | null;
  submitIpHash: string | null;
}

/**
 * 응답을 저장하고 파생을 만든다. 반환은 응답 id.
 * 파생이 실패해도 응답은 남는다(derived_dirty=1).
 */
export async function insertResponse(input: InsertResponseInput): Promise<number> {
  const { core, selections, consents, hasMedical } =
    applyBindings(input.schema, input.answers, input.schemaVersion);

  // ── 1) 응답 본체: 단일 INSERT. 여기서 실패하면 아무것도 남지 않는다.
  const { lastRowId } = await executeD1(
    `INSERT INTO form_responses
       (form_id, form_title_ko, form_schema_version, season, locale,
        submitted_by_user_id, student_user_id, link_source,
        student_name, student_name_norm, student_grade, email, email_norm, phone, guardian_name,
        status, source, is_latest, has_medical, derived_dirty,
        answers_json, meta_json, submit_ip_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, 1, ?, 0, ?, ?, ?)`,
    [
      input.formId, input.formTitleKo, input.schemaVersion, input.season, input.locale,
      input.submittedByUserId, input.studentUserId, input.linkSource,
      core.student_name, core.student_name_norm, core.student_grade,
      core.email, core.email_norm, core.phone, core.guardian_name,
      input.source, hasMedical ? 1 : 0,
      JSON.stringify(input.answers), input.metaJson, input.submitIpHash,
    ]
  );

  // ── 2) 파생: 실패해도 응답을 되돌리지 않는다. 표시만 남기고 나중에 재구축한다.
  try {
    await writeDerived(lastRowId, selections, consents);
  } catch (error) {
    console.error('form derived write failed, marking dirty:', error);
    await executeD1('UPDATE form_responses SET derived_dirty = 1 WHERE id = ?', [lastRowId]);
  }

  // ── 3) 재제출 정리: 같은 (폼, 이메일, 학생이름) 그룹의 옛 응답을 내린다.
  if (core.email_norm && core.student_name_norm) {
    await executeD1(
      `UPDATE form_responses SET is_latest = 0
        WHERE form_id = ? AND email_norm = ? AND student_name_norm = ? AND id != ?`,
      [input.formId, core.email_norm, core.student_name_norm, lastRowId]
    );
  }

  return lastRowId;
}

async function writeDerived(
  responseId: number,
  selections: ReturnType<typeof applyBindings>['selections'],
  consents: ReturnType<typeof applyBindings>['consents']
): Promise<void> {
  const statements: Array<{ sql: string; params: unknown[] }> = [];

  for (const chunk of chunkParams(selections, 18)) {
    // 행당 파라미터 5개 → 18행 = 90개
    const values = chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
    statements.push({
      sql: `INSERT INTO form_response_selections
              (response_id, question_key, option_key, option_label_ko, option_label_en, program_id)
            VALUES ${values}
            ON CONFLICT(response_id, question_key, option_key) DO NOTHING`,
      params: chunk.flatMap((s) => [
        responseId, s.question_key, s.option_key, s.option_label_ko, s.option_label_en, s.program_id,
      ]),
    });
  }

  for (const chunk of chunkParams(consents, 18)) {
    const values = chunk.map(() => '(?, ?, ?, ?, ?)').join(', ');
    statements.push({
      sql: `INSERT INTO form_response_consents
              (response_id, consent_key, question_key, agreed, policy_version)
            VALUES ${values}
            ON CONFLICT(response_id, consent_key) DO UPDATE SET
              agreed = excluded.agreed, policy_version = excluded.policy_version`,
      params: chunk.flatMap((c) => [responseId, c.consent_key, c.question_key, c.agreed, c.policy_version]),
    });
  }

  if (statements.length > 0) await batchD1(statements);
}

/**
 * 파생 재구축 — answers_json + 그 응답이 본 스키마 버전으로 처음부터 다시 만든다.
 * 옛 문안 버전을 쓰는 것이 중요하다. 지금 스키마로 재계산하면 그때 없던 선택지가 사라진다.
 */
export async function rebuildDerived(responseId: number): Promise<void> {
  const rows = await queryD1<{
    answers_json: string; form_id: number; form_schema_version: number;
  }>(
    'SELECT answers_json, form_id, form_schema_version FROM form_responses WHERE id = ?',
    [responseId]
  );
  const r = rows[0];
  if (!r) return;

  const schemaRows = await queryD1<{ schema_json: string }>(
    'SELECT schema_json FROM form_schema_versions WHERE form_id = ? AND version = ?',
    [r.form_id, r.form_schema_version]
  );
  // 스냅샷이 없으면(옛 데이터) 최신 스키마로 폴백한다 — 없는 것보다 낫다.
  const fallback = await queryD1<{ schema_json: string }>(
    'SELECT schema_json FROM forms WHERE id = ?', [r.form_id]
  );
  const raw = schemaRows[0]?.schema_json ?? fallback[0]?.schema_json;
  if (!raw) return;

  const schema = JSON.parse(raw) as FormSchema;
  const answers = JSON.parse(r.answers_json) as Answers;
  const { selections, consents } = applyBindings(schema, answers, r.form_schema_version);

  await executeD1('DELETE FROM form_response_selections WHERE response_id = ?', [responseId]);
  await executeD1('DELETE FROM form_response_consents WHERE response_id = ?', [responseId]);
  await writeDerived(responseId, selections, consents);
  await executeD1('UPDATE form_responses SET derived_dirty = 0 WHERE id = ?', [responseId]);
}

/**
 * 조회 경로에서 부르는 조용한 자동 재구축. 최대 20건.
 * 운영자는 이 함수가 있는지도 모른다 — 그게 의도다.
 */
export async function rebuildDirtyForForm(formId: number, limit = 20): Promise<number> {
  const rows = await queryD1<{ id: number }>(
    'SELECT id FROM form_responses WHERE form_id = ? AND derived_dirty = 1 LIMIT ?',
    [formId, limit]
  );
  for (const row of rows) {
    try {
      await rebuildDerived(row.id);
    } catch (error) {
      console.error('rebuildDerived failed for response', row.id, error);
    }
  }
  return rows.length;
}

export async function countDirty(formId: number): Promise<number> {
  const rows = await queryD1<{ n: number }>(
    'SELECT COUNT(*) AS n FROM form_responses WHERE form_id = ? AND derived_dirty = 1',
    [formId]
  );
  return rows[0]?.n ?? 0;
}

export async function getResponseById(id: number): Promise<FormResponseRow | null> {
  const rows = await queryD1<FormResponseRow>('SELECT * FROM form_responses WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export async function getSelections(responseId: number): Promise<FormResponseSelection[]> {
  return queryD1<FormResponseSelection>(
    'SELECT * FROM form_response_selections WHERE response_id = ? ORDER BY id',
    [responseId]
  );
}

export async function getConsents(responseId: number): Promise<FormResponseConsent[]> {
  return queryD1<FormResponseConsent>(
    'SELECT * FROM form_response_consents WHERE response_id = ? ORDER BY id',
    [responseId]
  );
}

/** 운영 응답 목록 — formViews.adminResponseList 의 관점을 실행한다. */
export async function getResponses(view: {
  formId: number; latestOnly: boolean; statuses?: ResponseStatus[];
  search?: string; limit: number; offset: number;
}): Promise<{ rows: FormResponseRow[]; total: number }> {
  const where: string[] = ['form_id = ?'];
  const params: unknown[] = [view.formId];

  if (view.latestOnly) where.push('is_latest = 1');
  if (view.statuses?.length) {
    where.push(`status IN (${view.statuses.map(() => '?').join(', ')})`);
    params.push(...view.statuses);
  }
  if (view.search?.trim()) {
    where.push('(student_name LIKE ? OR email LIKE ? OR phone LIKE ? OR guardian_name LIKE ?)');
    const like = `%${view.search.trim()}%`;
    params.push(like, like, like, like);
  }

  const clause = `WHERE ${where.join(' AND ')}`;
  const [rows, counts] = await Promise.all([
    queryD1<FormResponseRow>(
      `SELECT * FROM form_responses ${clause} ORDER BY submitted_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, view.limit, view.offset]
    ),
    queryD1<{ n: number }>(`SELECT COUNT(*) AS n FROM form_responses ${clause}`, params),
  ]);
  return { rows, total: counts[0]?.n ?? 0 };
}

/** 대시보드 콜아웃 — 처리 대기(new) 건수. getApplicationCounts 를 대체한다. */
export async function getPendingResponseCounts(): Promise<{ total: number }> {
  const rows = await queryD1<{ n: number }>(
    `SELECT COUNT(*) AS n FROM form_responses
      WHERE status = 'new' AND is_latest = 1`
  );
  return { total: rows[0]?.n ?? 0 };
}

export async function updateResponseStatus(
  id: number, status: ResponseStatus, reviewerId: string | null
): Promise<void> {
  await executeD1(
    `UPDATE form_responses
        SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?`,
    [status, reviewerId, id]
  );
}

export async function addResponseNote(input: {
  responseId: number;
  kind: FormResponseNote['kind'];
  fromStatus?: string | null;
  toStatus?: string | null;
  body?: string | null;
  authorId: string | null;
  authorName: string | null;
}): Promise<void> {
  await executeD1(
    `INSERT INTO form_response_notes
       (response_id, kind, from_status, to_status, body, author_id, author_name)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [input.responseId, input.kind, input.fromStatus ?? null, input.toStatus ?? null,
     input.body ?? null, input.authorId, input.authorName]
  );
  if (input.body?.trim()) {
    await executeD1(
      `UPDATE form_responses SET internal_note = ?, updated_at = datetime('now') WHERE id = ?`,
      [input.body.trim(), input.responseId]
    );
  }
}

export async function getResponseNotes(responseId: number): Promise<FormResponseNote[]> {
  return queryD1<FormResponseNote>(
    'SELECT * FROM form_response_notes WHERE response_id = ? ORDER BY created_at DESC, id DESC',
    [responseId]
  );
}

export async function recordSensitiveView(input: {
  responseId: number; viewerId: string; viewerName: string | null; context: 'detail' | 'csv';
}): Promise<void> {
  await executeD1(
    `INSERT INTO form_sensitive_views (response_id, viewer_id, viewer_name, context)
     VALUES (?, ?, ?, ?)`,
    [input.responseId, input.viewerId, input.viewerName, input.context]
  );
}

export async function linkResponseToMember(input: {
  responseId: number; studentUserId: string; linkSource: LinkSource;
}): Promise<void> {
  await executeD1(
    `UPDATE form_responses
        SET student_user_id = ?, link_source = ?, updated_at = datetime('now')
      WHERE id = ?`,
    [input.studentUserId, input.linkSource, input.responseId]
  );
}

export async function markPromoted(responseId: number): Promise<void> {
  await executeD1(
    `UPDATE form_responses
        SET status = 'enrolled', enrolled_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?`,
    [responseId]
  );
}

export interface RosterRow {
  option_key: string;
  option_label_ko: string | null;
  program_id: number | null;
  response_id: number;
  student_name: string;
  student_grade: string | null;
  email: string | null;
  phone: string | null;
  status: ResponseStatus;
  period_key: string | null;
  submitted_at: string;
}

/**
 * 과목별 명단 — 1년 등록 우선 → 선착순.
 * 이 정렬이 배정 규칙 자체다(삼고무·오고무는 북 수량이 제한돼 1년 등록자 우선 배정).
 */
export async function getRoster(view: {
  formId: number; periodQuestionKey: string; fullYearOptionKey: string;
}): Promise<RosterRow[]> {
  return queryD1<RosterRow>(
    `SELECT s.option_key, s.option_label_ko, s.program_id,
            r.id AS response_id, r.student_name, r.student_grade, r.email, r.phone, r.status,
            r.answers_json ->> ? AS period_key,
            r.submitted_at
       FROM form_response_selections s
       JOIN form_responses r ON r.id = s.response_id
      WHERE r.form_id = ? AND r.is_latest = 1 AND r.status != 'cancelled'
      ORDER BY s.option_key,
               CASE WHEN r.answers_json ->> ? = ? THEN 0 ELSE 1 END,
               r.submitted_at, r.id`,
    [
      `$.${view.periodQuestionKey}`, view.formId,
      `$.${view.periodQuestionKey}`, view.fullYearOptionKey,
    ]
  );
}
```

- [ ] **Step 8: index.ts 에 re-export 를 추가한다**

`lib/d1/index.ts` 끝에:

```ts
export * from './forms';
export * from './formResponses';
export * from './formViews';
export * from './chunk';
```

- [ ] **Step 9: 타입·시험 통과 확인**

Run: `npx tsc --noEmit && npm test`
Expected: 에러 0건, 시험 전부 PASS.

- [ ] **Step 10: 커밋**

```bash
git add lib/d1/chunk.ts lib/d1/formViews.ts lib/d1/formViews.test.ts \
        lib/d1/forms.ts lib/d1/formResponses.ts lib/d1/client.ts lib/d1/index.ts
git commit -m "feat(forms): D1 접근층 — 응답은 단일 INSERT, 파생은 재계산 가능

D1이 트랜잭션을 거부하므로 응답 본체만은 한 문장으로 착지시키고, 파생 두
테이블은 실패 시 derived_dirty 로 표시만 남긴다. 조회 경로가 그것을 보고 조용히
재구축한다 — 운영자에게 '재구축 버튼'을 보이지 않기 위해서다.
파라미터 상한 100개는 chunkParams(90)로 넘지 않는다."
```

---

## Task 4: 프리셋 + 2026–2027 시드

> ⚠️ 이 태스크의 **선택지 key·programId 는 §7.12 원장 확인 전까지 확정이 아니다.**
> 구조를 먼저 만들고, 확인이 끝나면 값만 고쳐 다시 시드한다. **폼을 게시하기 전에** 확정할 것.

**Files:**
- Create: `lib/forms/presets.ts`, `scripts/seedRegistrationForm.mjs`
- Test: `lib/forms/presets.test.ts`

**Interfaces:**
- Consumes: Task 1 타입, Task 2 `validateSchema`
- Produces: `PRESETS: Record<FormKind, () => FormSchema>`, `seasonPreset2026()`

- [ ] **Step 1: 프리셋이 게이트를 통과함을 시험한다**

`lib/forms/presets.test.ts`:

```ts
/**
 * lib/forms/presets.test.ts — 프리셋이 스스로 게이트를 통과하는지 잠근다
 *
 * 프리셋은 운영자가 "새 신청서"를 누를 때 나오는 시작점이다. 시작점이 게이트를
 * 통과하지 못하면 아무것도 만들 수 없다 — 그래서 여기서 못박는다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, seasonPreset2026 } from './presets.ts';
import { allQuestions, validateSchema } from './schema.ts';

test('모든 프리셋은 스키마 게이트를 통과한다', () => {
  for (const [kind, build] of Object.entries(PRESETS)) {
    assert.deepEqual(validateSchema(build()), [], `${kind} 프리셋이 게이트에 걸렸다`);
  }
});

test('정규 학기 프리셋은 원본 구글폼 14문항을 모두 담는다', () => {
  const qs = allQuestions(seasonPreset2026()).filter((q) => q.type !== 'info');
  const keys = qs.map((q) => q.key);
  for (const k of [
    'q1_reg_type', 'q2_student_name', 'q3_grade', 'q4_email',
    'q4b_phone', 'q4c_guardian', 'q5_medical',
    'q6_period', 'q7_classes', 'q8_perform', 'q9_reason',
    'q10_parade', 'q11_prop', 'q12_refund', 'q13_media', 'q14_final',
  ]) {
    assert.ok(keys.includes(k), `누락된 문항: ${k}`);
  }
});

test('전화는 필수, 보호자명은 선택 — 구글폼에 없던 두 문항을 새로 세운다', () => {
  const qs = allQuestions(seasonPreset2026());
  assert.equal(qs.find((q) => q.key === 'q4b_phone')?.required, true);
  assert.equal(qs.find((q) => q.key === 'q4c_guardian')?.required, false);
});

test('건강 문항은 민감으로 표시된다 — 목록·CSV에서 감춰지는 근거다', () => {
  assert.equal(allQuestions(seasonPreset2026()).find((q) => q.key === 'q5_medical')?.sensitive, true);
});

test('공연 미참가 사유는 조건부다 — 구글폼에서는 전원에게 떴다', () => {
  const q9 = allQuestions(seasonPreset2026()).find((q) => q.key === 'q9_reason');
  assert.deepEqual(q9?.showIf, { question: 'q8_perform', equals: ['no'] });
});

test('동의 5종이 모두 consentKey 를 갖는다 — 증빙 테이블로 승격되는 축이다', () => {
  const consents = allQuestions(seasonPreset2026()).map((q) => q.consentKey).filter(Boolean);
  assert.deepEqual(
    [...consents].sort(),
    ['final', 'media_release', 'parade', 'prop_fee', 'refund_policy']
  );
});

test('특강 프리셋은 5필드로 끝난다 — 30초에 만들 수 있어야 한다', () => {
  const qs = allQuestions(PRESETS.workshop()).filter((q) => q.type !== 'info');
  assert.equal(qs.length, 5);
});

test('모든 문항과 선택지가 영문 라벨을 갖는다 — 이 폼은 한/영 병기가 기본이다', () => {
  for (const q of allQuestions(seasonPreset2026())) {
    assert.ok(q.label.en, `영문 라벨 없음: ${q.key}`);
    for (const o of q.options ?? []) {
      assert.ok(o.label.en, `영문 선택지 라벨 없음: ${q.key}.${o.key}`);
    }
  }
});
```

- [ ] **Step 2: 시험 실패 확인**

Run: `node --test lib/forms/presets.test.ts`
Expected: FAIL — `Cannot find module './presets.ts'`

- [ ] **Step 3: 프리셋을 구현한다**

`lib/forms/presets.ts`. 문항 문구는 `docs/superpowers/specs/2026-08-13-registration-forms-source.md`의 §B에서 그대로 옮긴다. 파일 상단에 매핑 미확정 경고를 남긴다:

```ts
/**
 * lib/forms/presets.ts — "새 신청서"의 시작점
 *
 * 원장은 빈 캔버스를 만나지 않는다. 프리셋을 고르면 문항이 이미 다 들어 있고,
 * 편집은 표에서 행을 고치는 일이 된다. 이것이 이 시스템이 '폼 빌더'가 아닌 이유다.
 *
 * ⚠️ q7_classes 의 선택지 key · programId · courseCode 는 §7.12(원장 확인 5문항)가
 *    끝나기 전까지 **확정이 아니다.** 특히:
 *      - 기초 난타반을 1 Drum / 3 Drum 으로 쪼갤지 (학비 $400 / $450)
 *      - "오고무, 동고"를 삼고무·동고 / 오고무로 쪼갤지 ($600 / $700)
 *      - 중고등부 작품반(programs.id=15)을 어떻게 신청할지 — 현행 구글폼에는 선택지가 없는데
 *        Q11(칼 소품비)이 그 반을 가리킨다
 *    선택지 key 는 첫 제출 이후 바꿀 수 없다. **게시 전에 확정할 것.**
 *    programId 는 원격 D1 실측(2026-08-13) 기준이다.
 */

import type { FormKind, FormSchema } from '../../types/forms.ts';
```

정규 학기 프리셋의 골격(전문은 원본 자료 §B를 옮긴다):

```ts
export function seasonPreset2026(): FormSchema {
  return {
    version: 1,
    presetKey: 'season-2026',
    sections: [
      {
        key: 'student',
        title: { ko: '학생 정보', en: 'Student Information' },
        questions: [
          { key: 'q1_reg_type', type: 'single', required: true,
            label: { ko: '등록 유형', en: 'Registration Type' },
            options: [
              { key: 'new', label: { ko: '신규 등록', en: 'New Student' } },
              { key: 'returning', label: { ko: '재등록', en: 'Returning Student' } },
            ] },
          { key: 'q2_student_name', type: 'short', required: true, bind: 'student_name',
            label: { ko: '학생 이름', en: 'Student Name' } },
          { key: 'q3_grade', type: 'short', required: true, bind: 'student_grade',
            label: { ko: '학년', en: 'Grade' } },
          { key: 'q4_email', type: 'short', required: true, bind: 'email', format: 'email',
            label: { ko: '이메일', en: 'Email Address' } },
          // D4: 구글폼에 없던 문항. 학기 초 급한 연락은 전화로 돈다.
          { key: 'q4b_phone', type: 'short', required: true, bind: 'phone', format: 'tel',
            label: { ko: '연락처', en: 'Phone Number' } },
          { key: 'q4c_guardian', type: 'short', required: false, bind: 'guardian_name',
            label: { ko: '보호자 이름', en: 'Parent/Guardian Name' } },
          { key: 'q5_medical', type: 'long', required: false, sensitive: true,
            label: { ko: '건강 및 특이사항', en: 'Medical Information' },
            help: { ko: '알레르기, 건강상 유의사항 또는 지도자가 미리 알아야 할 사항이 있는 경우 작성해 주세요.',
                    en: 'Please list any allergies, medical conditions, or other important information the instructor should be aware of.' } },
        ],
      },
      // ── classes / policy / extras 섹션은 원본 자료 §B의 Q6~Q14 + 안내 블록을 그대로 옮긴다.
      //    q7_classes 의 options 는 위 ⚠️ 경고 참조.
    ],
  };
}

export function workshopPreset(): FormSchema { /* 이름·이메일·전화·과목 1개·최종 동의 5필드 */ }
export function surveyPreset(): FormSchema { /* 안내 블록 + 빈 extras 섹션 */ }

export const PRESETS: Record<FormKind, () => FormSchema> = {
  season: seasonPreset2026,
  workshop: workshopPreset,
  survey: surveyPreset,
};
```

**구현자 주의**: 위 골격의 `// ──` 주석 자리에 원본 자료 §B의 Q6~Q14를 **문구까지 그대로** 채운다. 긴 안내문(Q7·Q8·Q10·Q11·Q12·Q13의 설명)은 `help` 필드에 줄바꿈을 보존해 넣는다. 학비 안내는 `{ key: 'info_tuition', type: 'info', ... }` 블록이다.

- [ ] **Step 4: 시험 통과 확인**

Run: `node --test lib/forms/presets.test.ts`
Expected: 8개 PASS.

- [ ] **Step 5: 시드 스크립트를 만든다**

`scripts/seedRegistrationForm.mjs` — `scripts/d1Migrate.mjs`의 `loadEnv` 관례를 그대로 쓴다. 이미 같은 slug가 있으면 **덮지 않고 중단한다**(응답 유실 방지).

- [ ] **Step 6: 시드 실행 후 확인**

Run: `node scripts/seedRegistrationForm.mjs`
Expected: `forms` 1행 생성(`status='draft'`), `form_schema_versions` 1행. **draft 로 두는 것이 중요하다** — 매핑 확정 전에 게시되면 안 된다.

- [ ] **Step 7: 커밋**

```bash
git add lib/forms/presets.ts lib/forms/presets.test.ts scripts/seedRegistrationForm.mjs
git commit -m "feat(forms): 프리셋 3종 + 2026-2027 신청서 시드

원장은 빈 캔버스를 만나지 않는다 — 프리셋을 고르면 14문항이 이미 들어 있다.
q7 과목 선택지의 key/programId/courseCode 는 원장 확인 전까지 미확정이며
초안(draft) 상태로만 시드한다. 선택지 key 는 첫 제출 후 못 바꾼다."
```

---

## Task 5: 메뉴 등록 + 폼 관리 API

**Files:**
- Modify: `types/permissions.ts`, `lib/admin/menu-registry.ts`, `locale/ko.json`, `locale/en.json`
- Create: `app/api/admin/forms/route.ts`, `app/api/admin/forms/[id]/route.ts`, `app/api/admin/forms/[id]/publish/route.ts`, `app/api/admin/forms/[id]/close/route.ts`, `app/api/admin/forms/[id]/duplicate/route.ts`

**Interfaces:**
- Consumes: Task 3의 `lib/d1/forms.ts` 전 함수, Task 4의 `PRESETS`
- Produces: 관리 API 5개. 이후 화면 태스크가 이것만 호출한다.

- [ ] **Step 1: MenuKey 유니온에 'forms' 를 추가한다**

`types/permissions.ts`의 `MenuKey`에 `| 'forms'`를 `'programs'` 다음 줄에 추가.

- [ ] **Step 2: 레지스트리에 노드를 추가한다**

`lib/admin/menu-registry.ts`의 `MENU_REGISTRY`에서 `programs` 노드 **다음**(같은 `lesson` 그룹, 연속 배치 규칙):

```ts
  // 신청서: 질문지를 만들어 QR·링크로 공유하고 응답을 받아 수강 배정까지 잇는다.
  // 구글폼을 대체하는 자리다. 의료정보·연락처가 있는 화면이라 fail-closed 로 admin 부터 연다.
  { key: 'forms', href: '/admin/forms', label: '신청서 관리', iconKey: 'inbox', group: 'lesson', defaultRoles: ['admin'] },
```

**하위 경로(`/admin/forms/[id]/responses` 등)는 `resolveMenuKey`의 세그먼트 longest-match로 자동으로 `forms` 키를 상속한다.** hidden 메뉴·`parentKey`를 추가하지 않는다.

- [ ] **Step 3: locale 키를 양쪽에 추가한다**

`locale/ko.json`·`locale/en.json`에 `admin.nav.forms`("신청서 관리" / "Registration Forms")를 추가.

- [ ] **Step 4: 메뉴 회귀 시험을 돌린다**

Run: `npm test`
Expected: `lib/admin/menuNav.test.ts` 포함 전부 PASS. 실패하면 그 시험이 요구하는 계약(그룹 연속성 등)을 확인해 고친다.

- [ ] **Step 5: 목록·생성 API 를 만든다**

`app/api/admin/forms/route.ts` — `app/api/admin/faq/route.ts`를 형태의 본으로 삼는다:

```ts
/**
 * Admin 신청서 API
 * GET  /api/admin/forms - 신청서 목록
 * POST /api/admin/forms - 프리셋으로 신청서 생성
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasMenuAccess } from '@/lib/admin/permissions';
import { createForm, getForms, slugExists } from '@/lib/d1';
import { PRESETS } from '@/lib/forms/presets';
import type { FormKind } from '@/types/forms';

const KINDS: FormKind[] = ['season', 'workshop', 'survey'];

export async function GET() {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'forms'))) {
      return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
    }
    return NextResponse.json({ success: true, data: await getForms() });
  } catch (error) {
    console.error('Admin forms fetch error:', error);
    return NextResponse.json({ success: false, error: '신청서 목록을 불러오는데 실패했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!(await hasMenuAccess(session, 'forms'))) {
      return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { kind, slug, season, title_ko, title_en, requires_login } = body;

    if (!KINDS.includes(kind)) {
      return NextResponse.json({ success: false, error: '알 수 없는 신청서 종류입니다.' }, { status: 400 });
    }
    if (!slug?.trim() || !/^[a-z0-9-]+$/.test(slug.trim())) {
      return NextResponse.json({ success: false, error: '주소는 소문자·숫자·하이픈만 쓸 수 있습니다.' }, { status: 400 });
    }
    if (!title_ko?.trim()) {
      return NextResponse.json({ success: false, error: '제목은 필수입니다.' }, { status: 400 });
    }
    if (await slugExists(slug.trim())) {
      return NextResponse.json({ success: false, error: '이미 쓰이는 주소입니다.' }, { status: 400 });
    }

    const id = await createForm({
      slug: slug.trim(),
      season: season?.trim() || null,
      kind,
      preset_key: `${kind}-preset`,
      title_ko: title_ko.trim(),
      title_en: title_en?.trim() || null,
      description_ko: null,
      description_en: null,
      schema: PRESETS[kind as FormKind](),
      requires_login: requires_login === true,
      created_by: session?.user?.id ?? null,
    });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Admin form create error:', error);
    return NextResponse.json({ success: false, error: '신청서 생성에 실패했습니다.' }, { status: 500 });
  }
}
```

- [ ] **Step 6: 상세·수정·삭제 API 를 만든다**

`app/api/admin/forms/[id]/route.ts` — `GET`(폼 + 경고 목록 + dirty 수), `PUT`(메타 또는 스키마 저장), `DELETE`.

**중요**: `updateFormSchema`가 던지는 에러 메시지가 `LOCKED:`로 시작하면 **409**로 응답한다:

```ts
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.startsWith('LOCKED:')) {
        return NextResponse.json(
          { success: false, error: message.slice('LOCKED:'.length) },
          { status: 409 }
        );
      }
      throw error;
    }
```

- [ ] **Step 7: publish / close / duplicate API 를 만든다**

- `publish`: `status`가 `draft`가 아니면 400. `validateSchema` 차단 항목이 있으면 400(사유 나열). 통과하면 `publishForm()`.
- `close`: `open`이 아니면 400. `closeForm()`.
- `duplicate`: body에서 `slug`·`season`·`title_ko`를 받고 `slugExists` 확인 후 `duplicateForm()`.

- [ ] **Step 8: 빌드·타입 확인**

Run: `npx tsc --noEmit && npm run lint`
Expected: 에러 0건.

- [ ] **Step 9: 커밋**

```bash
git add types/permissions.ts lib/admin/menu-registry.ts locale/ko.json locale/en.json app/api/admin/forms
git commit -m "feat(forms): 메뉴 등록 + 신청서 관리 API

메뉴 키는 하나뿐이다 — 하위 경로는 resolveMenuKey 의 longest-match 로 상속된다.
의료정보가 있는 화면이라 fail-closed 로 admin 부터 연다.
잠금 이후 파괴적 편집은 409 로 거부한다."
```

---

## Task 6: 관리 화면 — 목록 + 새 신청서

**Files:**
- Create: `app/admin/forms/page.tsx`, `app/admin/forms/new/page.tsx`, `components/admin/forms/FormList.tsx`, `components/admin/forms/NewFormPanel.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: Task 5의 `GET/POST /api/admin/forms`, Task 3의 `getForms`
- Produces: 화면. 이후 태스크가 링크로 연결한다.

- [ ] **Step 1: 목록 서버 컴포넌트를 만든다**

`app/admin/forms/page.tsx` — `app/admin/faq/page.tsx`의 골격(`admin-page` / `admin-header` / `admin-header-content`)을 따른다.

```tsx
export default async function AdminFormsPage() {
  const session = await auth();
  await requireMenuAccess(session, 'forms');
  const forms = await getForms();
  return ( /* admin-page 골격 + <FormList forms={forms} /> */ );
}
```

목록의 각 행: 제목 · 시즌 · 상태 뱃지(초안/접수 중/마감) · 응답 수 · 공개 주소 · [편집] [응답 보기].
응답 수는 `getResponseCountsByForm()`을 `lib/d1/formResponses.ts`에 추가해 한 번에 가져온다(폼마다 쿼리를 돌리지 않는다).

- [ ] **Step 2: `getResponseCountsByForm` 을 추가한다**

`lib/d1/formResponses.ts`:

```ts
/** 폼별 응답 수 — 목록에서 N+1 쿼리를 피한다. */
export async function getResponseCountsByForm(): Promise<Record<number, number>> {
  const rows = await queryD1<{ form_id: number; n: number }>(
    'SELECT form_id, COUNT(*) AS n FROM form_responses WHERE is_latest = 1 GROUP BY form_id'
  );
  return Object.fromEntries(rows.map((r) => [r.form_id, r.n]));
}
```

- [ ] **Step 3: 새 신청서 화면을 만든다**

`app/admin/forms/new/page.tsx` + `components/admin/forms/NewFormPanel.tsx`(클라이언트).
프리셋 3종을 카드로 고르고 → 제목·주소(slug)·시즌 입력 → `POST /api/admin/forms` → 성공 시 `/admin/forms/{id}`로 이동.

slug 기본값은 `{시즌}-regular` 형태로 제안한다(연도 slug 정책, §7.9).

- [ ] **Step 4: CSS 를 추가한다**

`app/globals.css`에 `.forms-list`·`.form-status-badge`·`.preset-card` 계열. **관리 콘솔 규칙 준수**: 표면은 `var(--surface-2)`, 전경은 `rgba(var(--fg-rgb), α)`, 금색 텍스트는 `var(--soft-gold-text)`.

- [ ] **Step 5: 두 테마로 눈 확인**

Run: `npm run dev` → `/admin/forms` 방문 → 상단바 테마 토글로 라이트/다크 전환.
Expected: 두 테마 모두 대비·가독성 정상. 상태 뱃지가 라이트에서 읽힌다.

- [ ] **Step 6: 린트 통과 확인**

Run: `npm run lint:theme && npm run lint:i18n && npm run lint`
Expected: 전부 0건.

- [ ] **Step 7: 커밋**

```bash
git add app/admin/forms/page.tsx app/admin/forms/new app/globals.css \
        components/admin/forms lib/d1/formResponses.ts
git commit -m "feat(forms): 신청서 목록·생성 화면

새 신청서는 프리셋 선택으로 시작한다 — 빈 캔버스를 주지 않는다."
```

---

## Task 7: 편집기 5탭 + 운영 준비 상태 패널

**Files:**
- Create: `app/admin/forms/[id]/page.tsx`, `components/admin/forms/FormEditorTabs.tsx`, `components/admin/forms/ReadinessPanel.tsx`, `components/admin/forms/OptionTable.tsx`, `components/admin/forms/ConsentTable.tsx`, `components/admin/forms/ExtraQuestionTable.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: Task 5의 `GET/PUT /api/admin/forms/[id]`, publish/close/duplicate, Task 2의 `warnSchema`
- Produces: 편집 화면. 이 태스크가 요구 R2(연차 재사용)의 실현 여부를 좌우한다.

- [ ] **Step 1: 서버 컴포넌트 골격을 만든다**

`app/admin/forms/[id]/page.tsx`: `requireMenuAccess` → `getFormById` → `warnSchema(schema)` → `countDirty(id)` → 클라이언트 탭 컴포넌트에 넘긴다. 수업 셀렉트용으로 `getPrograms()`도 함께 가져온다.

- [ ] **Step 2: 운영 준비 상태 패널을 만든다**

`components/admin/forms/ReadinessPanel.tsx` — 편집 화면 상단 고정. **원장이 이해할 수 있는 문장으로만** 쓴다:

```
✓ 회원 정보 자동 채우기 — 준비됨
✗ 수강 배정 — 과목 2개에 수업이 연결되지 않았습니다  [과목 탭에서 연결]
✓ 필수 동의 5건
ℹ 명단에 아직 반영되지 않은 응답 0건
```

"파생 인덱스"·"바인딩" 같은 말을 화면에 쓰지 않는다. 이 패널이 이 설계의 최대 약점(매핑 오지정 → 조용한 실패)을 눈에 보이게 만드는 장치다.

- [ ] **Step 3: 5탭을 만든다**

`admin-page-tabs` CSS를 재사용한다.

1. **기본** — 제목·설명 ko/en 2열, slug, 시즌, 상태, 접수 기간 안내, 로그인 필수 토글
2. **과목·기간** — `q7_classes`/`q6_period`의 `options`를 **표로** 편집. 행마다: 라벨 ko/en · 안내 문구 · **수업 연결(programs 셀렉트)** · 정원 · 학비 코스 · 순서(↑↓) · 사용 여부
3. **동의·안내** — `consentKey`를 가진 문항 + `info` 블록. 유형 · 본문 ko/en(장문) · 필수 · 조건부 노출(셀렉트)
4. **추가 질문** — **유형 3종(단답/장문/단일선택)만.** 화면에 "이 답은 상세 화면과 CSV 끝열에만 나옵니다"라고 명시한다
5. **공유** — `<ShareQrCard title={form.title_ko} path={`/f/${form.slug}`} />` + URL 복사 + 새 탭 미리보기

**드래그앤드롭을 만들지 않는다.** ↑↓ 버튼을 쓴다(dnd 라이브러리가 없고 접근성도 낫다).

- [ ] **Step 4: 잠금 UI 를 붙인다**

`form.locked_at`이 있으면 삭제 버튼을 **'사용 안 함' 토글로 바꾼다**(`retired: true`). 409를 받으면 서버가 준 사유를 그대로 보여준다.

- [ ] **Step 5: 저장·게시 흐름을 붙인다**

저장은 `PUT /api/admin/forms/[id]`. 게시 버튼은 차단 항목이 있으면 사유를 모달로 띄우고 게시하지 않는다.

- [ ] **Step 6: 원장 시나리오를 손으로 돌린다**

Run: `npm run dev` → `/admin/forms/{id}` → **동의문 한 줄을 고치고 저장 → 재게시**.
Expected: 도움말 없이 끝난다. `form_schema_versions`에 새 행이 생긴다(확인: Task 1 Step 3의 쿼리 스크립트로 `SELECT version, note FROM form_schema_versions WHERE form_id = ?`).

- [ ] **Step 7: 두 테마 확인 + 린트**

Run: `npm run lint:theme && npm run lint:i18n && npm run lint && npx tsc --noEmit`
Expected: 0건. 라이트/다크 눈 확인.

- [ ] **Step 8: 커밋**

```bash
git add app/admin/forms/\[id\]/page.tsx components/admin/forms app/globals.css
git commit -m "feat(forms): 편집기 5탭 + 운영 준비 상태 패널

폼 빌더가 아니라 표 편집기다 — 원장이 준비물·FAQ 관리에서 하던 조작 그대로.
준비 상태 패널이 '폼은 도는데 명단이 안 나오는' 조용한 실패를 눈에 보이게 한다."
```

---

## Task 8: 공개 폼 렌더러

**Files:**
- Create: `app/f/[slug]/page.tsx`, `components/forms/FormRenderer.tsx`, `components/forms/fields/ShortField.tsx`, `LongField.tsx`, `SingleField.tsx`, `MultiField.tsx`, `ConsentField.tsx`, `InfoBlock.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: Task 2의 `visibleQuestions`/`validateAnswers`, Task 3의 `getOpenFormBySlug`
- Produces: `<FormRenderer schema formId slug locale prefill />`. Task 12(대리 입력)가 재사용한다.

- [ ] **Step 1: 접근성 패턴을 옮겨온다**

`components/classes/RegistrationForm.tsx`에서 **라벨 상시 노출 · on-blur 검증 · `aria-invalid`/`aria-describedby` · 오류 시 포커스 이동**을 필드 프리미티브로 승격한다. `register-*` CSS 클래스도 재사용한다.

- [ ] **Step 2: 공개 페이지를 만든다**

`app/f/[slug]/page.tsx`:

```tsx
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const form = await getOpenFormBySlug(slug);
  if (!form) return { title: '신청서 | KTDOC' };
  return {
    title: `${form.title_ko} | KTDOC`,
    // 검색엔진에 올리지 않되 카톡 미리보기는 살린다 — 링크를 뿌리는 것이 이 폼의 유일한 배포 경로다
    robots: { index: false, follow: false },
    openGraph: { title: form.title_ko, description: form.description_ko ?? undefined },
  };
}
```

폼이 없거나 `open`이 아니면 "접수가 마감되었습니다" 안내를 보여준다(404가 아니라 — 링크를 받은 사람에게 무슨 일인지 알려줘야 한다).

**히어로가 없으므로 `--page-offset-tight`를 쓴다.** `scripts/lintTheme.mjs`의 히어로 등록은 불필요하다.

- [ ] **Step 3: 렌더러를 만든다**

`components/forms/FormRenderer.tsx`(클라이언트):
- `useState<Answers>`로 답변 보관
- `visibleQuestions(schema, answers)`로 **매 렌더 조건부 노출을 다시 계산** — 이것이 구글폼과 갈리는 지점
- `exclusive` 선택지를 고르면 같은 문항의 나머지를 해제
- 라벨은 `locale === 'en' ? (label.en || label.ko) : label.ko`
- `help`는 `white-space: pre-line`으로 줄바꿈 보존
- 제출 전 `validateAnswers`로 클라이언트 검증 → 첫 오류 필드로 포커스 이동
- 허니팟 필드 + 렌더 시각(`renderedAt`)을 함께 보낸다 (`app/api/applications/route.ts:46`의 `MIN_SUBMIT_MS` 관용구 승계)

- [ ] **Step 4: 로그인 자동 채움을 붙인다**

세션이 있으면 서버 컴포넌트에서 `prefill`을 만들어 넘긴다: 이름·이메일·전화. 학부모면 `student_guardians`로 자녀 목록을 가져와 학생 셀렉트를 보여준다.

- [ ] **Step 5: 모바일 실기기로 확인**

Run: `npm run dev` → 같은 네트워크의 휴대폰에서 `/f/{slug}` 접속
Expected: 조건부 문항이 실제로 나타났다 사라진다. 긴 안내문의 줄바꿈이 살아 있다. 라이트/다크 두 테마 정상.

- [ ] **Step 6: 린트 + 커밋**

```bash
npm run lint:theme && npm run lint:i18n && npm run lint && npx tsc --noEmit
git add app/f components/forms app/globals.css
git commit -m "feat(forms): 공개 신청서 화면과 문항 렌더러

조건부 노출을 매 렌더 다시 계산한다 — 공연에 참가하면 미참가 사유를 묻지 않는다.
구글폼에서는 전원에게 떴다. 접근성 패턴은 RegistrationForm 에서 승계한다."
```

---

## Task 9: 제출 API

**Files:**
- Create: `app/api/forms/[slug]/submit/route.ts`
- Modify: `lib/push/*`에 `notifyStaffOfFormResponse()` 추가 (기존 `notifyUsers()` 위에 형제 함수 1개)

**Interfaces:**
- Consumes: Task 2 전 함수, Task 3의 `insertResponse`
- Produces: `POST /api/forms/[slug]/submit` → `{ success: true, data: { responseId } }`

- [ ] **Step 1: 라우트를 만든다**

핵심 순서를 주석으로 못박는다:

```ts
/**
 * 공개 신청서 제출
 * POST /api/forms/[slug]/submit
 *
 * 순서가 중요하다:
 *   1) 스팸 3종 (허니팟 / 최소 체류시간 / 본문 길이)
 *   2) 폼 상태·접수기간 **서버에서 재확인** — 화면이 열려 있던 동안 마감됐을 수 있다
 *   3) requires_login 확인 (클라이언트를 믿지 않는다)
 *   4) validateAnswers — 클라이언트 검증은 편의일 뿐이다
 *   5) insertResponse (본체 단일 INSERT + 파생)
 *   6) 운영진 통지 (실패해도 제출을 되돌리지 않는다)
 *
 * 미들웨어가 /api 를 타지 않으므로 이 라우트가 스스로 auth() 를 부른다.
 * 클라이언트가 보낸 user_id 는 절대 신뢰하지 않는다 — 세션에서만 읽는다.
 */
```

- [ ] **Step 2: 스팸 3종을 구현한다**

`app/api/applications/route.ts`의 관용구를 승계한다: 허니팟 필드가 비어있지 않으면 조용히 성공 응답, `Date.now() - renderedAt < MIN_SUBMIT_MS`면 거부.

- [ ] **Step 3: IP 해시를 만든다**

원문 IP를 저장하지 않는다:

```ts
import { createHash } from 'node:crypto';
const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
const submitIpHash = ip ? createHash('sha256').update(ip).digest('hex').slice(0, 16) : null;
```

- [ ] **Step 4: 통지를 붙인다**

`notifyStaffOfFormResponse(formTitle, studentName)` — **본문에 의료정보·연락처를 넣지 않는다**(NF1.4). "신청서 제목 + 학생 이름"까지만. `try/catch`로 감싸 실패해도 제출을 되돌리지 않는다.

- [ ] **Step 5: 손으로 왕복 1회**

Run: dev 서버에서 `/f/{slug}` 제출
Expected: `{ success: true, data: { responseId } }`. D1에서 확인:
```sql
SELECT id, student_name, email, phone, has_medical, derived_dirty FROM form_responses ORDER BY id DESC LIMIT 1;
SELECT * FROM form_response_selections WHERE response_id = (SELECT MAX(id) FROM form_responses);
SELECT * FROM form_response_consents WHERE response_id = (SELECT MAX(id) FROM form_responses);
```
파생 행이 실제로 생겼는지 눈으로 본다. `derived_dirty`가 0이어야 한다.

- [ ] **Step 6: 커밋**

```bash
git add app/api/forms lib/push
git commit -m "feat(forms): 공개 제출 API

폼 상태·로그인 요구·답변 검증을 전부 서버에서 다시 확인한다.
IP 는 해시만 남기고 통지 본문에 의료정보를 넣지 않는다."
```

---

## Task 10: 완료 화면

**Files:**
- Create: `app/f/[slug]/done/page.tsx`

- [ ] **Step 1: 완료 화면을 만든다**

`/f/[slug]/done?r={id}` — **접수번호를 크게** 보여준다. 메일이 신뢰 불가한 상태이므로 **이 화면이 영수증이다**(설계서 §3.5 #12).

내용: 접수번호 · 학생 이름 · 접수 일시 · "최종 등록금과 결제 안내는 확인 후 개별 연락드립니다" · 홈으로 돌아가기.

`r` 파라미터로 받은 id는 **소유 확인 없이 접수번호만 표시**한다(응답 내용은 보여주지 않는다 — 남의 번호를 넣어도 얻을 것이 없다).

- [ ] **Step 2: 확인 + 커밋**

Run: 제출 후 완료 화면 도달 확인, 두 테마 확인
```bash
git add app/f/\[slug\]/done
git commit -m "feat(forms): 제출 완료 화면 — 접수번호가 영수증이다"
```

---

## Task 11: 응답 목록 · 상세 · 상태 · 메모 · 민감 마스킹

**Files:**
- Create: `app/admin/forms/[id]/responses/page.tsx`, `app/admin/forms/[id]/responses/[rid]/page.tsx`, `components/admin/forms/ResponseTable.tsx`, `components/admin/forms/ResponseDetail.tsx`, `components/admin/forms/StatusControl.tsx`, `app/api/admin/forms/[id]/responses/route.ts`, `app/api/admin/forms/[id]/responses/[rid]/route.ts`, `app/api/admin/forms/[id]/responses/[rid]/reveal/route.ts`

**Interfaces:**
- Consumes: Task 3의 `getResponses`/`getResponseById`/`updateResponseStatus`/`addResponseNote`/`recordSensitiveView`/`rebuildDirtyForForm`, Task 3의 `adminResponseList` 관점
- Produces: 응답 관리 화면. Task 12·13이 상세 화면에 패널을 덧붙인다.

- [ ] **Step 1: 목록 화면을 만든다**

`app/admin/applications/page.tsx`의 골격(필터 + 검색 + 상태 셀렉트 + `new` 우선)을 물려받는다.

**진입 시 조용한 자동 재구축**: 서버 컴포넌트에서 `await rebuildDirtyForForm(formId)`를 부른다. 운영자는 이 일이 일어난 줄 모른다.

목록 열: 상태 · 학생 이름 · 학년 · 선택 과목(라벨 스냅샷) · 연락처(tel: 링크) · 이메일(mailto: 링크) · 접수일 · **의료 배지("있음"만, 내용은 없다)**.

- [ ] **Step 2: 민감 마스킹을 강제한다**

`sensitive: true` 문항의 답은 **목록에 절대 싣지 않는다.** 서버 컴포넌트에서 목록용 데이터를 만들 때 `answers_json`을 통째로 넘기지 말고 필요한 필드만 뽑아 넘긴다.

- [ ] **Step 3: 상세 화면을 만든다**

`app/admin/forms/[id]/responses/[rid]/page.tsx`:
- **답변 전개** — `form_schema_version`으로 `getSchemaVersion()`을 불러 **그때 화면을 재현한다.** 지금 스키마로 그리면 안 된다(문안이 바뀌었을 수 있다).
- **동의 증빙표** — `consent_key` · 동의 여부 · 문안 버전 · 시각
- **처리 패널** — 상태 셀렉트 + 메모 입력 + 이력 목록(append-only)
- **민감 문항** — 기본 접힘. [열람] 버튼을 눌러야 펼쳐지고, 그 순간 `POST .../reveal`로 열람 기록을 남긴다

- [ ] **Step 4: 상태 변경이 이력을 남기는지 확인한다**

상태를 바꾸면 `form_response_notes`에 `kind='status'` 행이 자동으로 생겨야 한다. **기존 `applications`의 최대 결함이 자유 전이가 아니라 무기록이었다** — 전이는 자유롭게 두고 전부 기록한다.

Run: 상태를 `new` → `reviewing`으로 바꾼 뒤
```sql
SELECT kind, from_status, to_status, author_name FROM form_response_notes WHERE response_id = ? ORDER BY id DESC LIMIT 1;
```
Expected: `status | new | reviewing | {운영자 이름}`

- [ ] **Step 5: 두 테마 확인 + 린트 + 커밋**

```bash
npm run lint:theme && npm run lint:i18n && npm run lint && npx tsc --noEmit
git add app/admin/forms/\[id\]/responses app/api/admin/forms/\[id\]/responses components/admin/forms
git commit -m "feat(forms): 응답 목록·상세·상태·메모·민감 마스킹

상세는 응답이 본 문안 버전으로 그때 화면을 재현한다.
상태 전이는 자유롭게 두되 전부 기록한다 — 옛 시스템의 결함은 자유가 아니라 무기록이었다.
의료정보는 목록에서 배지로만 보이고, 펼치면 열람 기록이 남는다."
```

---

## Task 12: CSV 내보내기 + 대리 입력

**Files:**
- Create: `lib/forms/csv.ts`, `lib/forms/csv.test.ts`, `app/api/admin/forms/[id]/export.csv/route.ts`, `app/admin/forms/[id]/responses/new/page.tsx`

- [ ] **Step 1: CSV 시험을 쓴다**

```ts
test('민감 열은 기본으로 빠진다 — 실수로 의료정보가 스프레드시트로 나가면 안 된다', () => {
  const csv = buildCsv({ schema: SCHEMA_WITH_MEDICAL, rows: [ROW], includeSensitive: false });
  assert.ok(!csv.includes('땅콩'));
  assert.ok(csv.includes('있음')); // 배지만
});

test('쉼표·따옴표·줄바꿈이 든 값을 안전하게 감싼다', () => {
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('그는 "네"라고 했다'), '"그는 ""네""라고 했다"');
  assert.equal(csvCell('첫 줄\n둘째 줄'), '"첫 줄\n둘째 줄"');
});

test('BOM 을 붙인다 — 엑셀이 한글을 깨뜨리지 않게', () => {
  assert.ok(buildCsv({ schema: SCHEMA_WITH_MEDICAL, rows: [], includeSensitive: false }).startsWith('﻿'));
});
```

- [ ] **Step 2: 시험 실패 확인 → 구현 → 통과 확인**

Run: `node --test lib/forms/csv.test.ts` (실패) → 구현 → 재실행 (통과)

- [ ] **Step 3: CSV 라우트를 만든다**

`?include_sensitive=1`은 **admin만** 허용하고, 허용 시 각 응답에 `recordSensitiveView(context: 'csv')`를 남긴다.

- [ ] **Step 4: 대리 입력 화면을 만든다**

`app/admin/forms/[id]/responses/new/page.tsx` — Task 8의 `<FormRenderer>`를 그대로 재사용하되 `POST /api/admin/forms/[id]/responses`로 보내고 `source='staff'`로 저장한다. 이메일은 NULL을 허용한다(전화로 받은 신청).

- [ ] **Step 5: 왕복 확인 + 커밋**

```bash
git add lib/forms/csv.ts lib/forms/csv.test.ts app/api/admin/forms/\[id\]/export.csv app/admin/forms/\[id\]/responses/new
git commit -m "feat(forms): CSV 내보내기 + 대리 입력

민감 열은 기본으로 빠지고, 포함하려면 admin 이어야 하며 열람 기록이 남는다.
대리 입력은 공개 폼 렌더러를 그대로 재사용한다."
```

---

## Task 13: 회원 결합 + 수강 배정 승격

**Files:**
- Modify: `app/api/admin/programs/[id]/enrollments/route.ts:64` **(선행 수정)**
- Create: `app/api/admin/forms/[id]/responses/[rid]/link-member/route.ts`, `app/api/admin/forms/[id]/responses/[rid]/promote/route.ts`, `components/admin/forms/MemberLinkPanel.tsx`, `components/admin/forms/PromotePanel.tsx`

- [ ] **Step 1: 역할 제한을 완화한다 (선행)**

`app/api/admin/programs/[id]/enrollments/route.ts:64`:

```ts
    // 일요 성인반·선생님 연수처럼 원생이 아닌 회원도 수업에 배정된다.
    // 'student' 만 허용하면 성인반 신청자를 배정할 수 없다(신청서 승격이 전부 막힌다).
    const ASSIGNABLE_ROLES = ['student', 'teacher', 'user', 'parent'];
    if (!ASSIGNABLE_ROLES.includes(member.role)) {
```

- [ ] **Step 2: 회원 결합 API 를 만든다**

두 갈래:
- **검색 결합** — 이름·이메일로 `users`를 찾아 `linkResponseToMember(linkSource: 'manual')`
- **계정 생성** — 없으면 만들어 준다. 임시 비밀번호를 발급하고 화면에 1회 표시

**미검증 이메일로 자동 결합하지 않는다**(NF·§8.2). 반드시 운영자가 고른다.

- [ ] **Step 3: 승격 API 를 만든다**

```ts
/**
 * 수강 배정 승격 — 응답 1건 → 선택 과목 N개의 배정 N건.
 *
 * createEnrollment 가 멱등(UPSERT)이라 N회 호출이 안전하다. 부분 실패해도
 * 다시 눌러 이어붙일 수 있다 — D1에 트랜잭션이 없으니 그게 유일한 안전망이다.
 *
 * 배정 대상은 student_user_id 다. submitted_by_user_id 가 아니다 —
 * 학부모가 대리 제출했을 때 학부모를 수업에 배정하면 안 된다.
 */
```

선행 조건: `student_user_id`가 있어야 한다(없으면 400 "먼저 회원을 연결해 주세요"). `program_id`가 없는 선택지는 건너뛰고 몇 건을 건너뛰었는지 응답에 담는다.

성공 시 `markPromoted()` + `addResponseNote({ kind: 'enroll' })`.

**미디어 동의 동기화(D3)**: 승격 시 `media_release` 동의가 `agreed=0`이면 `users.public_archive_consent`를 **즉시 0으로 내려쓴다**. `agreed=1`이면 1로 올린다. 그 뒤로는 프로필이 승자다.

- [ ] **Step 4: 승격을 손으로 확인한다**

Run: 상세 화면에서 회원 결합 → 승격
```sql
SELECT program_id, user_id, status FROM program_enrollments WHERE user_id = '{uuid}';
SELECT status, enrolled_at FROM form_responses WHERE id = {rid};
```
Expected: 선택 과목 수만큼 배정 행이 생기고 응답이 `enrolled`가 된다. **성인반(role != 'student')도 배정된다.**

- [ ] **Step 5: 커밋**

```bash
git add app/api/admin/programs/\[id\]/enrollments/route.ts app/api/admin/forms components/admin/forms
git commit -m "feat(forms): 회원 결합 + 수강 배정 승격

배정 대상은 student_user_id 다 — 학부모가 대리 제출해도 학부모를 배정하지 않는다.
성인반 배정을 막던 role!=='student' 400 을 함께 푼다(이걸 안 풀면 승격이 전부 막힌다).
미디어 동의 거부는 승격 시 프로필에 즉시 반영한다 — 모르면 안 보여주는 쪽으로 실패한다."
```

---

## Task 14: 과목별 명단 + 학비표 조회 보조

> ⚠️ 학비표 조회는 §7.12(과목↔코스 매핑)에 의존한다. **구조를 만들고 매핑이 비면 "개별 확인"으로 빠지게** 한다.

**Files:**
- Create: `app/admin/forms/[id]/roster/page.tsx`, `lib/forms/tuition.ts`, `lib/forms/tuition.test.ts`, `components/admin/forms/TuitionHint.tsx`

- [ ] **Step 1: 학비표 룩업 시험을 쓴다**

```ts
test('단품 조회 — 유년부 무용 3개월은 $400', () => {
  assert.equal(lookupTuition(['dance_1'], 'm3')?.amount, 400);
});

test('패키지가는 산식이 아니라 룩업이다 — 1 Dance + Kids Drum 1 은 $800 이 아니라 $650', () => {
  assert.equal(lookupTuition(['dance_1', 'kids_drum_1'], 'm3')?.amount, 650);
});

test('표에 없는 조합은 null 이다 — 이것은 오류가 아니라 정상 상태다', () => {
  assert.equal(lookupTuition(['kids_drum_1', 'drums_3'], 'm3'), null);
});

test('코스 순서가 달라도 같은 행을 찾는다', () => {
  assert.equal(
    lookupTuition(['kids_drum_1', 'dance_1'], 'm3')?.amount,
    lookupTuition(['dance_1', 'kids_drum_1'], 'm3')?.amount
  );
});

test('courseCode 가 하나라도 비면 조회하지 않는다 — 틀린 금액보다 모른다고 하는 게 낫다', () => {
  assert.equal(lookupTuition(['dance_1', ''], 'm3'), null);
});
```

- [ ] **Step 2: 시험 실패 확인 → 룩업 구현 → 통과 확인**

`lib/forms/tuition.ts` — 원본 자료 §C의 24행을 정렬된 코스코드 배열 → 금액 맵으로 옮긴다:

```ts
/**
 * lib/forms/tuition.ts — 학비표 조회 보조 (운영자 화면 전용)
 *
 * **계산하지 않는다. 표에서 찾아 줄 뿐이다.**
 * 패키지가는 산식이 아니라 조합마다 다른 확정 금액이다($400+$400인데 패키지 $650).
 * 그래서 룩업 테이블만이 표를 재현한다.
 *
 * 표에 없는 조합은 null 이고, 그것은 **오류가 아니라 정상 상태**다 —
 * 화면은 "표에 없는 조합 — 개별 확인"으로 정직하게 빠진다.
 *
 * ⚠️ courseCode 는 §7.12(원장 확인)가 끝나야 확정된다. 그전까지 대부분의
 *    선택지에 courseCode 가 없고, 조회는 그냥 null 을 돌려준다.
 */
```

- [ ] **Step 3: 명단 화면을 만든다**

`app/admin/forms/[id]/roster/page.tsx` — `getRoster()` 결과를 `option_key`로 묶어 과목별 섹션. 각 섹션 머리에 `7 / 10`(정원이 있으면). 정렬은 이미 SQL이 했다(1년 우선 → 선착순).

행: 순번 · 학생 이름 · 학년 · 등록 기간 · 연락처 · 상태.

- [ ] **Step 4: 상세 화면에 학비 힌트를 붙인다**

`components/admin/forms/TuitionHint.tsx` — 선택 과목의 `courseCode` + 기간으로 `lookupTuition()`. 결과가 있으면 금액과 표의 행 이름을, 없으면 "표에 없는 조합 — 개별 확인"을 보여준다. **신청자 화면에는 절대 렌더하지 않는다.**

- [ ] **Step 5: 확인 + 커밋**

```bash
npm test && npm run lint:theme && npm run lint:i18n && npm run lint && npx tsc --noEmit
git add app/admin/forms/\[id\]/roster lib/forms/tuition.ts lib/forms/tuition.test.ts components/admin/forms/TuitionHint.tsx
git commit -m "feat(forms): 과목별 명단 + 학비표 조회 보조

명단 정렬(1년 우선 → 선착순)이 배정 규칙 자체다.
학비는 계산하지 않고 표에서 찾아 줄 뿐이며, 표에 없는 조합은 정직하게 '개별 확인'으로 빠진다."
```

---

## Task 15: 연결 · 마무리 · 완료 게이트

**Files:**
- Modify: `app/admin/page.tsx`(또는 `components/admin/StaffDashboard.tsx`), `app/classes/[slug]/page.tsx`, `app/admin/programs/[id]` 편집 화면, `components/admin/programs/EnrollmentManager.tsx`

- [ ] **Step 1: 대시보드 콜아웃 소스를 교체한다**

`getApplicationCounts()` → `getPendingResponseCounts()`. 링크도 `/admin/applications` → `/admin/forms`로.

- [ ] **Step 2: 수업 상세의 신청 버튼을 잇는다**

`app/classes/[slug]/page.tsx`: `program.active_form_id`가 있으면 그 폼의 slug를 조회해 신청 버튼을 `/f/{slug}`로 보낸다. 없으면 기존 `ApplyModal` 그대로(3단계에 제거).

- [ ] **Step 3: 프로그램 편집에 신청 폼 셀렉트를 붙인다**

`/admin/programs/[id]`에 `active_form_id` 셀렉트(빈 값 = 연결 없음).

- [ ] **Step 4: EnrollmentManager 에 이름 검색을 넣는다**

드롭다운이 회원 수만큼 길어지면 못 쓴다. 입력으로 좁히는 검색을 추가한다(요구 R3.6).

- [ ] **Step 5: 완료 게이트를 전부 돌린다**

```bash
npm run lint:i18n     # ko/en 키 세트·자리표시자·중복 → 0건
npm run lint:theme    # 테마 토큰 오용 → 0건
npm test              # lib/**/*.test.ts
npm run lint          # eslint
npx tsc --noEmit      # 타입
npm run build         # 프로덕션 빌드
```
Expected: 전부 통과. **하나라도 실패하면 완료가 아니다.**

- [ ] **Step 6: 수동 확인 4종**

- [ ] 관리 편집기·응답 목록·상세를 **라이트/다크 두 테마로** 눈 확인 (`ShareQrCard` 콘솔 첫 투입 포함)
- [ ] 공개 폼 `/f/[slug]`을 **라이트/다크 두 테마로** 눈 확인
- [ ] **모바일 실기기에서 QR 스캔 → 제출 → 접수번호 확인 1회 왕복**
- [ ] **원장 시나리오**: 도움 없이 동의문 한 줄을 고치고 재게시할 수 있는가

- [ ] **Step 7: 커밋**

```bash
git add app/admin/page.tsx app/classes components/admin
git commit -m "feat(forms): 기존 화면과 연결 + 1단계 마무리

대시보드 신규 건수를 새 응답 소스로, 수업 상세 신청 버튼을 새 폼으로.
EnrollmentManager 에 이름 검색을 넣어 폼 없이도 배정할 수 있게 한다."
```

---

## 자체 검토 결과

**1. 스펙 커버리지** — 설계서 §3.1(1단계 범위) 항목별 대응:

| §3.1 항목 | 태스크 |
|---|---|
| 마이그레이션 0035 | 1 |
| types/forms.ts | 1 |
| lib/forms/schema.ts + test | 2 |
| lib/d1/chunk.ts · batchD1 | 3 |
| lib/d1/forms.ts · formResponses.ts · formViews.ts | 3 |
| lib/forms/presets.ts | 4 |
| 2026–2027 시드 | 4 |
| 메뉴 키 + locale | 5 |
| 편집기 5탭 | 7 |
| 게시 게이트 + 버전 스냅샷 + locked_at | 2(로직) · 3(저장) · 5(409) · 7(UI) |
| 공개 폼 + 완료 | 8 · 10 |
| 제출 API | 9 |
| 응답 목록·상세·상태·메모·이력 | 11 |
| 민감 마스킹 + 열람 기록 | 11 |
| 명단 roster | 14 |
| CSV | 12 |
| 학비표 조회 보조 | 14 |
| 대리 입력 | 12 |
| 회원 결합 + 승격 | 13 |
| ShareQrCard | 7(공유 탭) |
| 통지 | 9 |
| 대시보드 소스 교체 | 15 |
| /classes 신청 버튼 | 15 |
| enrollments 400 완화 · 이름 검색 | 13 · 15 |

누락 없음. **2단계 이후 항목(인라인 가입 R4.4~R4.6, 미제출자 추적, teacher 열람)은 의도적으로 이 계획 밖이다.**

**2. 플레이스홀더** — Task 4 Step 3의 `workshopPreset`/`surveyPreset` 본문과 `season` 프리셋의 Q6~Q14는 "원본 자료 §B에서 그대로 옮긴다"로 지시했다. 이는 TBD가 아니라 **출처가 명시된 전사 작업**이다(원본이 이 레포 안에 있다). Task 6~8·11의 UI 세부는 참조 파일을 파일명으로 지목했다.

**3. 타입 일관성** — `applyBindings`가 돌려주는 `selections`/`consents`의 필드명이 Task 3의 `writeDerived` 파라미터, 마이그레이션의 컬럼명과 일치함을 확인했다(`question_key`·`option_key`·`option_label_ko`·`program_id` / `consent_key`·`agreed`·`policy_version`). `getPendingResponseCounts`는 Task 3에서 정의하고 Task 15에서 쓴다. `rebuildDirtyForForm`은 Task 3 정의 · Task 11 사용. `chunkParams`는 Task 3 정의 · 같은 태스크 사용.
