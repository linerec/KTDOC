-- Migration: 신청서(질문지) 시스템 — forms / 버전 스냅샷 / 응답 / 파생 축 / 이력
-- Target DB: Cloudflare D1 (SQLite). ※ 0007·0008·0019만 MySQL, 나머지는 D1 대상.
-- Description:
--   구글폼으로 하던 "질문지 만들기 → 링크·QR 공유 → 응답 수집 → 수강 배정"을 사이트로 들인다.
--   코어(폼이 없어도 존재하는 축)는 컬럼, 폼마다 다른 문항은 JSON,
--   운영이 SQL로 쓰는 두 축(과목 선택 / 동의)만 재계산 가능한 파생 테이블.
--
--   ※ D1은 명시적 트랜잭션을 거부한다(BEGIN 실측 거부: "use state.storage.transaction()").
--     따라서 응답 본체는 반드시 단일 INSERT로 착지하고, 파생 테이블은 answers_json에서
--     언제든 재구축 가능해야 한다. **진실의 원천은 항상 form_responses.answers_json 이다.**
--   ※ 바인딩 파라미터 상한은 100개다(실측). 여러 행을 한 문장에 넣을 때는
--     lib/d1/chunk.ts 의 chunkParams(90)로 쪼갠다.
--   ※ CHECK 제약을 걸지 않는다(0032 선례) — 값이 늘 때 마이그레이션 없이 추가하려고.
--     검증은 lib/forms/schema.ts(순수 함수 + schema.test.ts)가 한다.
--   ※ MySQL users 와는 교차 저장소라 FK 없이 user_id TEXT(UUID)로만 잇는다(0018 선례).
--   ※ 증빙 테이블에는 상위 CASCADE 를 걸지 않는다 — 폼 삭제로 동의 증빙이 연쇄 소멸하면 안 된다.
-- Apply: npm run d1:migrate migrations/0035_registration_forms.sql

-- ── 1. 폼(질문지) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS forms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,                        -- 공개 URL /f/{slug}
  season TEXT,                               -- '2026-2027' 학년도 표기(연차 조회·보존기간 축)
  kind TEXT NOT NULL DEFAULT 'season',       -- season | workshop | survey (프리셋 식별)
  preset_key TEXT,                           -- 생성에 쓴 프리셋 키(추적용)
  title_ko TEXT NOT NULL,
  title_en TEXT,
  description_ko TEXT,
  description_en TEXT,
  status TEXT NOT NULL DEFAULT 'draft',      -- draft | open | closed | archived
  schema_json TEXT NOT NULL DEFAULT '{"version":1,"sections":[]}',
  schema_version INTEGER NOT NULL DEFAULT 1, -- 게시/편집 때마다 +1. 응답이 가리키는 문안 버전
  opens_at TEXT,                             -- NULL = 즉시. 안내용이며 자동 개시하지 않는다
  closes_at TEXT,                            -- NULL = 무기한. 안내용이며 크론으로 자동 마감하지 않는다
  requires_login INTEGER NOT NULL DEFAULT 0, -- 1이면 비회원 제출 차단
  allow_resubmit INTEGER NOT NULL DEFAULT 1, -- 재제출 허용(중복은 is_latest 로 정리)
  locked_at TEXT,                            -- 첫 제출 시각. 이후 파괴적 구조 변경을 API가 409로 막는다
  copied_from_form_id INTEGER REFERENCES forms(id) ON DELETE SET NULL,  -- 연차 복제 계보
  created_by TEXT,                           -- MySQL users.id
  published_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_forms_slug ON forms(slug);
CREATE INDEX IF NOT EXISTS idx_forms_status ON forms(status, season);

-- ── 2. 문안 버전 스냅샷 ──────────────────────────────────────────
--   왜 필요한가: schema_json 은 최신본 하나뿐이라, 문안을 고치면 "그때 무엇을 읽고
--   동의했는가"의 원문이 사라진다. 미성년 대상 미디어·환불 동의를 다루는 이상
--   해시로 '달라졌음'만 증명하는 것은 증빙이 아니다. 게시·편집 시마다 전문을 박는다.
--   비용: 폼 편집 1회당 1행(연 수십 행).
CREATE TABLE IF NOT EXISTS form_schema_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  form_id INTEGER NOT NULL REFERENCES forms(id),   -- ON DELETE 미지정(NO ACTION): 증빙은 연쇄 삭제되지 않는다
  version INTEGER NOT NULL,
  schema_json TEXT NOT NULL,                 -- 그 시점 전문(ko/en 포함)
  note TEXT,                                 -- '연도 문구 갱신' 등 편집 사유(선택)
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fsv_uniq ON form_schema_versions(form_id, version);

-- ── 3. 응답: 코어는 컬럼, 나머지는 슬롯 ──────────────────────────
CREATE TABLE IF NOT EXISTS form_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  form_id INTEGER NOT NULL REFERENCES forms(id),  -- NO ACTION: 응답이 있는 폼은 지울 수 없다
  form_title_ko TEXT,                        -- 스냅샷(0004 program_title_ko 관례 승계)
  form_schema_version INTEGER NOT NULL DEFAULT 1, -- 이 응답이 본 문안 버전 → form_schema_versions 조인
  season TEXT,                               -- 스냅샷(학년도 단위 조회·선별 파기)
  locale TEXT NOT NULL DEFAULT 'ko',         -- 응답자가 실제로 읽은 언어. 증빙의 일부다

  -- 사람 축
  submitted_by_user_id TEXT,                 -- 제출한 회원(학부모일 수 있다). 비회원이면 NULL
  student_user_id TEXT,                      -- 대상 학생의 MySQL users.id. 수강 배정 승격의 기준
  link_source TEXT,                          -- session | signup | login_backfill | manual | NULL
                                             --   동의 증빙의 신뢰 등급. 미검증 이메일 자동결합은 쓰지 않는다
  student_name TEXT NOT NULL,
  student_name_norm TEXT NOT NULL,           -- lower(공백제거) — 중복 판정 키
  student_grade TEXT,                        -- 반편성·정렬의 기본축이라 코어
  email TEXT,                                -- 공개 제출은 필수(API 검증), 대리 등록은 NULL 허용
  email_norm TEXT,
  phone TEXT,
  guardian_name TEXT,

  -- 운영 축
  status TEXT NOT NULL DEFAULT 'new',        -- new|reviewing|needs_info|accepted|enrolled|declined|cancelled
  source TEXT NOT NULL DEFAULT 'public',     -- public | staff | import
  is_latest INTEGER NOT NULL DEFAULT 1,      -- 같은 (form, 학생) 그룹의 최신본
  supersedes_response_id INTEGER REFERENCES form_responses(id) ON DELETE SET NULL,
  has_medical INTEGER NOT NULL DEFAULT 0,    -- sensitive 문항에 값이 있으면 1. 내용은 감춘다
  derived_dirty INTEGER NOT NULL DEFAULT 0,  -- 파생 미반영 표시. 조회 시 조용히 자동 재구축
  internal_note TEXT,                        -- 최근 메모 요약(전체 이력은 form_response_notes)
  reviewed_by TEXT,
  reviewed_at TEXT,
  enrolled_at TEXT,                          -- 수강 배정 승격 시각

  -- 확장 슬롯
  answers_json TEXT NOT NULL DEFAULT '{}',   -- 문항키 → 값. **진실의 원천**
  meta_json TEXT,                            -- ua 요약·referer 등. PII 금지
  submit_ip_hash TEXT,                       -- 원문 IP 저장 안 함

  submitted_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fr_form ON form_responses(form_id, is_latest, status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_fr_student_user ON form_responses(student_user_id);
CREATE INDEX IF NOT EXISTS idx_fr_submitter ON form_responses(submitted_by_user_id);
CREATE INDEX IF NOT EXISTS idx_fr_email ON form_responses(email_norm);
CREATE INDEX IF NOT EXISTS idx_fr_dedupe ON form_responses(form_id, email_norm, student_name_norm);
CREATE INDEX IF NOT EXISTS idx_fr_dirty ON form_responses(form_id, derived_dirty);

-- ── 4. 파생 1: 선택 축 — "과목별 명단"이 1순위 질의라 승격 ───────
--   라벨을 스냅샷하는 이유: CSV·명단이 schema_json 을 읽지 않고도 성립해야 한다.
--   (반대로 answers_json 에는 라벨을 넣지 않는다 — 버전 스냅샷 테이블이 갖고 있다.
--    이 비대칭은 의도된 것이다.)
CREATE TABLE IF NOT EXISTS form_response_selections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  response_id INTEGER NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,                -- 'q7_classes'
  option_key TEXT NOT NULL,                  -- 선택지 안정 키(라벨이 아니다 — 라벨은 매년 바뀐다)
  option_label_ko TEXT,                      -- 스냅샷
  option_label_en TEXT,
  program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL,  -- 수강 배정의 다리
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_frs_uniq ON form_response_selections(response_id, question_key, option_key);
CREATE INDEX IF NOT EXISTS idx_frs_option ON form_response_selections(option_key);
CREATE INDEX IF NOT EXISTS idx_frs_program ON form_response_selections(program_id);

-- ── 5. 파생 2: 동의 축 ───────────────────────────────────────────
--   값 + 시점 + 문안버전이 함께 남아야 증빙이 성립한다.
--   문안 원문은 form_schema_versions 조인으로 복원한다. 해시는 '작년과 같은 문안인가'를
--   한 줄로 비교하기 위한 보조축이지 증빙 자체가 아니다.
CREATE TABLE IF NOT EXISTS form_response_consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  response_id INTEGER NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
  consent_key TEXT NOT NULL,                 -- parade | prop_fee | refund_policy | media_release | final
  question_key TEXT NOT NULL,
  agreed INTEGER NOT NULL,                   -- 0 | 1
  policy_version INTEGER NOT NULL,           -- 응답 시점 forms.schema_version
  policy_text_hash TEXT,                     -- 그 시점 문안(ko+en) sha256 앞 16자
  agreed_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_frc_uniq ON form_response_consents(response_id, consent_key);
CREATE INDEX IF NOT EXISTS idx_frc_key ON form_response_consents(consent_key, agreed);

-- ── 6. 처리 이력 (append-only) ──────────────────────────────────
--   기존 applications 의 최대 결함은 자유 전이가 아니라 '무기록'이었다.
--   전이는 자유롭게 두고 전부 기록한다.
CREATE TABLE IF NOT EXISTS form_response_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  response_id INTEGER NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'note',         -- note | status | link | enroll | rebuild
  from_status TEXT,
  to_status TEXT,
  body TEXT,
  author_id TEXT,                            -- MySQL users.id
  author_name TEXT,                          -- 표시명 스냅샷
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_frn_response ON form_response_notes(response_id, created_at);

-- ── 7. 민감정보 열람 기록 ────────────────────────────────────────
--   의료정보(Q5)를 누가 언제 열어 봤는지 남긴다. "샜는지조차 모르는" 상태를 피한다.
CREATE TABLE IF NOT EXISTS form_sensitive_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  response_id INTEGER NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
  viewer_id TEXT NOT NULL,                   -- MySQL users.id
  viewer_name TEXT,
  context TEXT,                              -- 'detail' | 'csv'
  viewed_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fsv_response ON form_sensitive_views(response_id, viewed_at);

-- ── 8. 프로그램에 폼 붙이기 ──────────────────────────────────────
--   다:다가 아니라 1:N 이면 충분하다. 한 수업에 동시에 두 폼을 붙일 근거가 아직 없다.
ALTER TABLE programs ADD COLUMN active_form_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_programs_form ON programs(active_form_id);
