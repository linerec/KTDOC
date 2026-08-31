/**
 * 신청서(질문지) 시스템 공용 타입
 *
 * DB 의존성이 없어 서버·클라이언트 어디서나 import 가능하다(types/permissions.ts 선례).
 *
 * schema_json 의 구조가 이 파일의 핵심이다. 문항이 스스로 "이 답이 어디로 가는가"를
 * 말하고(bind / selectionOf / consentKey), lib/forms/schema.ts 가 그 지시를 실행한다.
 * 지시자가 없으면 답은 answers_json 에만 남는다 — 그것이 이 설계가 그은 선이다.
 */

/** 한/영 병기 텍스트. en 이 비면 ko 로 폴백한다. */
export interface Bilingual {
  ko: string;
  en?: string;
}

/**
 * draft   — 초안. 운영진만 미리 볼 수 있다.
 * trial   — **임시 게시.** 링크를 아는 누구나 열어 끝까지 작성해 볼 수 있지만
 *           **제출해도 저장되지 않는다.** 원장·관계자가 진짜 화면을 확인하는 자리다.
 *           저장하지 않으므로 구조도 잠기지 않는다 — 보고 나서 과목을 고칠 수 있다.
 * open    — 접수 중. 첫 제출이 들어오면 구조가 잠긴다.
 * closed  — 마감. 응답은 그대로 남는다.
 *
 * ※ D1 스키마에 CHECK 제약을 걸지 않았기에 마이그레이션 없이 늘릴 수 있었다(0035 주석).
 */
export type FormStatus = 'draft' | 'trial' | 'open' | 'closed' | 'archived';
export type FormKind = 'season' | 'workshop' | 'survey';

export type ResponseStatus =
  | 'new'
  | 'reviewing'
  | 'needs_info'
  | 'accepted'
  | 'enrolled'
  | 'declined'
  | 'cancelled';

export type ResponseSource = 'public' | 'staff' | 'import';

/**
 * 응답이 회원과 이어진 경로 — 동의 증빙의 신뢰 등급이다.
 * 미검증 이메일로 자동 결합하는 경로(email_match)는 의도적으로 두지 않는다.
 */
export type LinkSource = 'session' | 'signup' | 'login_backfill' | 'manual';

export type QuestionType = 'short' | 'long' | 'single' | 'multi' | 'consent' | 'info';

/**
 * 코어 컬럼으로 복사되는 bind 값의 전체 목록.
 *
 * 여기 없는 bind 는 validateSchema 가 저장을 거부한다. 코어 컬럼을 늘리려면
 * 이 상수와 마이그레이션을 **같은 커밋에서 함께** 고쳐야 한다 — 문서 규율 대신
 * 코드 강제를 건 자리다(설계서 §4.1.3 승격 사다리 4칸).
 *
 * **여기에 한 줄을 더하면 lib/forms/staffEntry.ts 의 채움표가 타입으로 막는다.**
 * 일부러 그렇게 두었다. 운영진이 대신 입력하며 회원을 고를 때 그 새 칸을 채울지
 * (회원 정보에서 옮길지) 아니면 받아 적을지를 누군가는 정해야 하는데, 그 결정이
 * 빠진 채로 배포되면 아무도 눈치채지 못하기 때문이다. 컴파일 오류가 그 자리로
 * 데려간다 — 고치는 데 한 줄이면 된다.
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
  /** 수강 배정의 다리. 없으면 승격이 불가능하다(게시 게이트가 경고한다). */
  programId?: number;
  /** 명단 화면의 `7 / 10` 표시용. 자동 마감은 하지 않는다. */
  capacity?: number;
  /** 학비표 룩업 키(lib/forms/tuition.ts). 미정이면 생략한다. */
  courseCode?: string;
  /** 고르면 같은 문항의 나머지가 해제된다(Q11 "해당 없음"). */
  exclusive?: boolean;
  /**
   * **함께 고를 수 없는 짝**을 잇는 이름표. 같은 값을 가진 선택지끼리는 하나만 고를 수 있다.
   *
   * `exclusive`(위)와 다르다 — 저쪽은 "해당 없음"처럼 **문항 전체**를 비우는 한 개짜리
   * 스위치이고, 이쪽은 **몇 개씩 묶인 그룹**이 서로만 배타다. 삼고무·오고무는 서로
   * 못 고르지만 무용·모듬북은 그대로 고를 수 있어야 한다.
   *
   * 이름은 자유 문자열이다. 코드가 특정 과목을 아는 순간 다음 배타 관계는 또 코드를
   * 고쳐야 하므로, **관계는 데이터가 말하고 코드는 이름이 같은지만 본다.**
   * 예: 삼고무·오고무 = `'standing_drums'`, 난타 1드럼·3드럼 = `'kids_nanta'`.
   *
   * ※ 이미 저장된 응답은 소급 무효가 되지 않는다 — 검증은 새 제출에만 걸린다.
   */
  exclusiveGroup?: string;
  /** 동의 축으로 승격될 때의 동의 값. */
  consentValue?: boolean;
  /** 툼스톤 — 렌더하지 않되 옛 응답 해석은 유지한다. */
  retired?: boolean;
}

/**
 * 1단계 조건부 노출. 중첩·다중조건은 만들지 않는다(설계서 §3.5 #5).
 * 원본 14문항 중 조건부는 2건이고 둘 다 "이전 문항이 X면 표시" 1단계다.
 */
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

/**
 * answers_json 의 값 형태:
 *   short/long → string · single → 선택지 key · multi → key 배열 · consent → boolean
 *   info → 저장하지 않음
 * 라벨 스냅샷은 넣지 않는다 — 버전 스냅샷 테이블이 갖고 있다.
 * (반대로 파생 테이블에는 라벨을 스냅샷한다. 이 비대칭은 의도된 것이다.)
 */
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

/** 파생: 선택 축. answers_json 에서 언제든 재계산된다. */
export interface FormResponseSelection {
  id: number;
  response_id: number;
  question_key: string;
  option_key: string;
  option_label_ko: string | null;
  option_label_en: string | null;
  program_id: number | null;
}

/** 파생: 동의 축. 값 + 시점 + 문안버전이 함께 남아야 증빙이 성립한다. */
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
  kind: 'note' | 'status' | 'link' | 'enroll' | 'rebuild' | 'mail';
  from_status: string | null;
  to_status: string | null;
  body: string | null;
  author_id: string | null;
  author_name: string | null;
  created_at: string;
}
