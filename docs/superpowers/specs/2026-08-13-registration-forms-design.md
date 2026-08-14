# KTDOC 신청서(질문지) 시스템 — 요구사항 정의서 · 설계

문서 버전: 0.2 · 작성 기준일: 2026-08-13
대상 저장소: `/home/owenkdev/Projects/KTDOC` · 다음 마이그레이션 번호: **0035**
원본 자료: [`2026-08-13-registration-forms-source.md`](./2026-08-13-registration-forms-source.md) — 구글폼 14문항 전문 + 학비표 24행 전사.
본문의 `src:NN` 인용은 그 파일의 줄 번호다.

**채택 결론**: 3개 렌즈 심사에서 A안 16.5 / B안 18 / C안 21이었고, 1:1 비교에서 C안이 A안과 B안을 각각 2:1로 이겼다(콩도르세 승자). **뼈대는 C안(코어·슬롯 하이브리드)** 을 쓴다. 다만 C안이 운영 현실 렌즈에서 깎인 세 가지(원장이 스키마 에디터를 다뤄야 함 / 파생 재구축을 사람에게 맡김 / 1단계에 승격·대리등록 없음)는 **B안의 화면 언어**와 **A안의 잠금·증빙 장치**를 접붙여 해소한다. 심사에서 지적된 치명적 결함은 §8에 하나씩 처리 결과를 적었고, 해소하지 못한 것은 "미해결"로 남겼다.

---

## 0. 확정된 결정 (2026-08-13, 사용자 답변)

§7의 미해결 쟁점 중 아래 6건은 **답이 나왔다.** 본문에 이미 반영돼 있고, §7의 해당 항목에는 확정 표시를 남겼다.

| # | 쟁점 | 확정 | 본문 반영 |
|---|---|---|---|
| D1 | 학비 범위 (§7.1) | **신청만 받고 금액은 개별 안내.** 신청자에게 금액을 계산해 보여주지 않는다. 단 **운영자 화면 전용 학비표 조회 보조**는 넣는다 | §3.1, §4.9 |
| D2 | 제출 문턱 (§7.6) | **비회원도 제출 가능.** 로그인 상태면 자동 채움 + 계정 결합. `requires_login`은 폼별 플래그로 남기되 2026–2027 정규 폼도 첫 해는 열어 둔다 | §4.2 `forms.requires_login`, §5.2 |
| D3 | 미디어 동의 (§7.5) | **회원 프로필이 현재 상태의 주인, 신청서 답은 그 시점 증빙.** 승격 시 거부는 즉시 내려쓰고 동의는 승격 시점에만 올린다 | §6 `public_archive_consent` 행 |
| D4 | 연락처 (§7.7) | **전화번호 필수 · 보호자명 선택.** 원본 구글폼에 없던 문항을 신설한다 | §4.3 `q4b_phone` / `q4c_guardian` |
| D5 | 형제자매 (§7.4) | **현행 유지 — 폼을 두 번 낸다.** "다른 자녀 신청" 버튼을 만들지 않는다(추천안 기각) | §3.5 YAGNI #8 |
| D6 | 온라인 결제 (§7.2) | **도입하지 않는다.** D1의 귀결 | §3.5 YAGNI #3 |

**운영자(개발자) 판단으로 확정한 것** — 사용자에게 다시 묻지 않는다:

| 쟁점 | 확정 | 근거 |
|---|---|---|
| 기존 `applications` (§7.3) | 1단계 차단 → 3단계 테이블·API·UI 제거 | 원격 D1 실측 0건. 지킬 데이터가 없다 |
| slug 정책 (§7.9) | 연도 slug (`/f/2026-2027-regular`) | 작년 폼 주소가 살아 열람·CSV가 안정적. QR은 카톡 배포가 주력 |
| teacher 응답 열람 (§7.10) | 1단계 admin 전용 → 2단계에 담당 과목 명단만 | fail-closed. 메뉴를 나중에 여는 게 싸다 |
| 정원 (§7.11) | 운영자 화면에 `7 / 10` 표시 + 1년 우선 정렬만 | 자동 마감·승급은 취소·환불과 얽혀 되돌리기 어렵다 |

**아직 답이 없는 것 — §7.12 하나뿐이다.** 과목 선택지를 어떻게 쪼개고 학비표·수업에 잇는가. 원장 확인 5문항이 필요하며, 그중 하나는 **현행 구글폼의 실제 결함**이다(Q11이 Q7에서 고를 수 없는 수업을 가리킨다). 수업 매핑 자체는 원격 D1 실측으로 초안이 나와 있어 확인만 하면 된다.

**이 문서의 사실 근거**: 코드 인용은 파일:라인으로 검증했고, 저장소 제약과 데이터 건수는 **원격 D1에 직접 쿼리를 던져** 확인했다(2026-08-13). 검증된 항목은 §1.3 표와 §7.12 매핑 초안이다.

---

## 1. 문제 정의

### 1.1 지금 실제로 돌아가는 흐름 (구글폼)

매년 학년도 시작 전, 원장이 구글폼으로 수강신청서를 새로 만든다. 2026–2027 폼은 14문항 + 안내 블록 4개다(섹션 헤더 포함). 만든 뒤 링크·QR을 카톡으로 배포하고, 응답 스프레드시트를 받아 반편성·연락·학비 안내·명단 작성에 쓴다. 다음 해에는 폼을 복제해 연도 문구와 과목·가격을 고친다.

이 흐름 자체는 잘 돌아간다. 아픈 곳은 **폼 바깥**이다.

| 아픈 지점 | 구체적 증상 | 원본 근거 |
|---|---|---|
| 응답이 사이트 밖에 산다 | 스프레드시트의 이름과 사이트 회원(users)이 이어지지 않는다. 수강 배정은 사람이 손으로 다시 입력한다 | — |
| 조건부 문항이 없다 | Q9(공연 미참가 사유)는 Q8=No일 때만, Q11(칼 소품비)은 중고등부 작품반만 유효한데 **전원에게 필수로 뜬다** | `src:85-86`, `src:98` |
| 연락처를 안 받는다 | 이메일만 받고 전화·보호자명이 없다. 실무는 전화로 돈다 | `src:209` |
| 동의 증빙이 약하다 | 동의 문안이 연도에 매여 있는데("2026–2027 시즌부터") 누가 언제 어느 문안에 동의했는지가 스프레드시트 한 칸의 "예"뿐이다. 제출자가 보호자인지 확인할 장치가 없다 | `src:90`, `src:127` |
| 미디어 동의가 두 곳에 있다 | Q13(신청서)과 사이트의 `users.public_archive_consent`가 서로 모른다 → **거부한 학생 사진이 `/students`에 노출될 수 있다** | `src:208` |
| 의료정보가 평문으로 공유된다 | Q5(알레르기·건강상태)가 스프레드시트에 그대로 있고 링크를 가진 사람이 다 본다 | `src:39-41` |
| 학비 안내가 전부 수작업 | 과목 조합 × 3기간 = 24행 룩업 표를 사람이 매번 뒤져 개별 연락한다. **매년 가장 오래 걸리는 일이 이것이다** | `src:135-137` |
| 특강마다 폼을 새로 만든다 | 중간 특강용 폼이 매번 별개로 생기고 응답도 따로 논다 | — |

### 1.2 사이트 안의 기존 `applications` 시스템

`migrations/0004_programs.sql:65-84`에 컬럼 11개짜리 신청 테이블이 있고, `/classes/[slug]`의 신청 모달(`RegistrationForm` + `ApplyModal`)이 `POST /api/applications`로 저장한다. 관리 화면은 `/admin/applications`.

**결론부터: 이 시스템은 요구를 담을 수 없고, 지킬 데이터도 없다.**

- **질문지라는 개념이 스키마에 없다.** 필드가 컬럼으로 고정돼 있어 Q1~Q14 같은 임의 문항을 담을 자리가 없다(`message` TEXT 하나가 자유기술 전부). 연도·버전 축도 없다.
- **`program_id`가 단일 필수**라 Q7 다중선택(과목 8종 중 N개)을 못 담는다. events(공연)에는 붙지도 않는다.
- **`confirmed` 상태가 아무 일도 하지 않는다.** `program_enrollments`(0018)와 연결이 0건이다. 신청 확정 ≠ 수강 배정.
- **메모 필드가 없다.** 통화 결과를 적을 곳이 없어 "지속 관리"의 뼈대가 없다.
- **`user_id`가 없다.** 회원과 신청을 잇는 축이 아예 없다.
- 상태 전이 규칙·이력·담당자 기록이 없다. 어느 상태에서 어디로든 자유 이동하고 흔적이 없다.
- API 3개가 `isAdmin(session)` 하드코딩이라 메뉴 권한 매트릭스로 teacher에게 열어줘도 403이 난다.
- 메일 발송이 인라인 nodemailer이고 `void` fire-and-forget이며, **Gmail 앱 비밀번호 만료(535) 이력**이 문서에 남아 있다. 재시도·큐·발송 로그가 전무하다.

그리고 **원격 D1 실측 결과 `SELECT COUNT(*) FROM applications` = 0건이다.** 이관할 데이터가 존재하지 않는다. 이 사실 하나가 "흡수냐 병존이냐"라는 논쟁을 통째로 지운다.

### 1.3 저장소가 강제하는 제약 (전부 원격 D1 실측)

| 항목 | 실측 결과 | 설계에 미치는 영향 |
|---|---|---|
| `BEGIN; … COMMIT;` | **거부** ("use state.storage.transaction() instead") | 다중 행 쓰기의 원자성이 없다 → **진실은 한 행에** |
| 다문장 요청 | 실행됨. 단 `lib/d1/client.ts`가 `result[0]`만 반환해 2번째 이후를 버린다 | `batchD1()` 신설 필요, 호출부 제한 |
| 바인딩 파라미터 | **하드 상한 100개**. `IN` 리스트에도 동일 적용(100 OK, 500 ERR) | INSERT·IN 모두 90개 단위 청크 헬퍼 필수 |
| `json_extract` / `->>` / 파라미터 경로 바인딩 | 동작 | JSON 슬롯 조회 가능 |
| `json_each` / `json_tree` / `jsonb()` | 동작 (SQLite 3.45+) | |
| 표현식 인덱스 `ON t(json_extract(...))` | **생성 성공** | JSON 축을 백필 없이 인덱싱 가능 |
| VIRTUAL 생성 컬럼 | **추가·읽기 성공** | JSON 축을 백필 없이 컬럼처럼 사용 가능 |
| FK 강제 | 활성 (고아 INSERT 거부) | ON DELETE 방향이 실제로 작동한다 |
| `sqlite_version()` | 차단 | — |

현재 데이터 규모: `programs` class 9 + camp 1, `program_enrollments` 1건, `applications` 0건. 연간 예상 응답 200~400건.

---

## 2. 요구사항

### 2.1 기능 요구 (사용자 5가지 요구의 추적 가능한 분해)

사용자 원문 요구를 R1~R5로 두고 하위 항목으로 쪼갠다. 각 항목에 §3(범위)의 단계와 §4(설계)의 대응물을 적는다.

**R1. 신청서를 등록하고 QR/URL로 공유해 응답을 받아 지속 관리하는 전체 흐름을 시스템으로 통합**

| ID | 요구 | 단계 | 대응 |
|---|---|---|---|
| R1.1 | 관리 콘솔에서 신청서를 만들고 문구·선택지를 편집한다 | 1 | `/admin/forms/[id]` 4탭 편집기 |
| R1.2 | 신청서를 게시하면 공개 URL이 생긴다 | 1 | `/f/[slug]` |
| R1.3 | 그 URL의 QR코드를 화면에서 얻고 인쇄·공유한다 | 1 | 기존 `ShareQrCard` 재사용(개발 0줄) |
| R1.4 | 방문자 응답이 사이트 DB에 쌓인다 | 1 | `form_responses` |
| R1.5 | 응답 접수를 운영진이 즉시 안다 | 1 | 웹푸시 + 인앱 알림함(1차), 메일(보조) |
| R1.6 | 응답을 목록·검색·필터로 본다 | 1 | `/admin/forms/[id]/responses` |
| R1.7 | 응답별 처리 상태를 바꾸고 **내부 메모**를 남긴다 | 1 | `form_response_notes` (기존 시스템의 최대 결함 보완) |
| R1.8 | 모든 상태 변경이 누가·언제·무엇에서 무엇으로 기록된다 | 1 | 동 테이블 append-only |
| R1.9 | 응답을 CSV로 내보낸다 | 1 | `/api/admin/forms/[id]/export.csv` |
| R1.10 | 과목별 명단을 화면에서 뽑는다 (1년 등록 우선 → 선착순 정렬) | 1 | `/admin/forms/[id]/roster` |

**R2. 2026-2027 질문지를 2027-2028에 재사용하거나 일부만 수정할 수 있어야 한다. 매년 관리 대상이다**

| ID | 요구 | 단계 | 대응 |
|---|---|---|---|
| R2.1 | 작년 신청서를 통째로 복제해 새 신청서를 만든다 | 1 | `POST /api/admin/forms/[id]/duplicate` — `schema_json` 컬럼 복사 |
| R2.2 | 문구(제목·설명·동의문·안내문)를 코드 배포 없이 고친다 | 1 | 편집기 |
| R2.3 | 선택지(과목·기간)를 추가·삭제·순서 변경한다 | 1 | 편집기 '과목' 탭 |
| R2.4 | 필수 여부·노출 조건을 바꾼다 | 1 | 편집기 |
| R2.5 | **부가 질문을 원장이 직접 신설한다** (단답/장문/단일선택 3종) | 1 | '추가 질문' 탭 |
| R2.6 | 작년 응답은 작년 문안 그대로 열람된다 | 1 | `form_schema_versions` 스냅샷 |
| R2.7 | 작년 신청서는 마감 상태로 남아 열람·CSV가 계속 된다 | 1 | `status='closed'` |

**R3. 모든 프로그램(정규+특강)에 폼을 붙일 수 있고, 대리 등록도 가능하고, 폼 없이 클래스에 직접 추가·관리도 가능해야 한다**

| ID | 요구 | 단계 | 대응 |
|---|---|---|---|
| R3.1 | 정규 학기 신청서를 만든다 | 1 | 프리셋 `season` |
| R3.2 | 특강용 짧은 신청서를 만든다 | 1 | 프리셋 `workshop` (5필드) |
| R3.3 | 신청서를 특정 수업(program)에 연결해 상세 페이지 신청 버튼이 그 폼으로 간다 | 1 | `programs.active_form_id` |
| R3.4 | 선택지 하나하나를 실제 수업(program)에 연결한다 | 1 | `option.programId` → `form_response_selections.program_id` |
| R3.5 | 운영진이 카톡·전화·종이로 온 신청을 **대신 입력한다** | 1 | `/admin/forms/[id]/responses/new`, `source='staff'` |
| R3.6 | 폼과 무관하게 회원을 수업에 직접 배정·해제한다 | 1 | 기존 `EnrollmentManager` 존치 + **이름 검색 추가** |
| R3.7 | 응답을 수강 배정으로 승격한다 (다과목 1응답 → N배정) | 1 | `createEnrollment()` UPSERT N회 |

**R4. 작성 시 사이트 회원정보가 없으면 회원정보를 함께 받아 회원가입까지 유도·처리**

| ID | 요구 | 단계 | 대응 |
|---|---|---|---|
| R4.1 | 로그인 상태면 이름·이메일·전화·자녀가 자동으로 채워진다 | 1 | 세션 + `getGuardianChildren()` |
| R4.2 | 로그인 상태면 응답이 회원 계정에 자동 결합된다 | 1 | `submitted_by_user_id` |
| R4.3 | **비회원도 로그인 없이 제출할 수 있다** | 1 | `requires_login=0` 기본 |
| R4.4 | 제출 후 화면에서 비밀번호만 정하면 회원가입이 끝난다 | 2 | `createMember()` 추출 후 호출 |
| R4.5 | 입력 이메일에 이미 계정이 있으면 로그인을 유도하고, **로그인 성공 후에만** 응답을 결합한다 | 2 | 자동 결합 금지(계정 탈취 방지) |
| R4.6 | 자녀 계정이 없는 신규 학부모도 막히지 않는다 | 2 | `student_guardians.student_id=NULL + claimed_student_name` |
| R4.7 | 운영진이 응답에서 회원을 검색해 결합하거나 계정을 만들어 준다 | 1 | 회원 결합 패널 + 임시 비밀번호 |

**R5. 질문지 내용은 원본 자료 파일 전문**

| ID | 요구 | 단계 | 대응 |
|---|---|---|---|
| R5.1 | 14문항 + 섹션 4개 + 말미 안내를 그대로 담는다 | 1 | 시드 스크립트 |
| R5.2 | 한/영 병기를 전 문항·전 선택지·전 설명에 유지한다 | 1 | 모든 텍스트가 `{ko, en}` 쌍 |
| R5.3 | 장문·불릿 설명의 줄바꿈을 보존한다 | 1 | `white-space: pre-line` |
| R5.4 | 조건부 문항 2건(Q9, Q11)이 조건에 맞을 때만 뜬다 | 1 | `showIf` 1단계 규칙 |
| R5.5 | 학비표를 운영자 화면에서 **조회 보조**한다 (계산·청구 아님) | 1 | `lib/forms/tuition.ts` 24행 룩업 |
| R5.6 | 학비 자동 산출·견적 | 4 | 원장 매핑 확인 후 (§7.1) |

### 2.2 비기능 요구

**NF1. PII·미성년·의료**
- NF1.1 Q5(의료) 등 `sensitive: true` 문항의 답은 **목록·기본 CSV에서 제외**하고, 목록에는 `has_medical` 배지("있음")만 보인다.
- NF1.2 민감 문항 열람은 상세 화면의 명시적 펼치기로만 가능하고, **열람 사실을 `form_sensitive_views`에 기록**한다.
- NF1.3 CSV에 민감 열을 포함하려면 체크박스 + 확인 모달을 거치고, 관리자만 가능하다.
- NF1.4 푸시 알림 본문에 의료·연락처를 넣지 않는다(학생 이름 + 폼 제목까지).
- NF1.5 IP 원문을 저장하지 않는다(`submit_ip_hash`만).
- NF1.6 응답 보존기간·파기 시점은 **미결정**(§7.8). 스키마는 `season` 스냅샷으로 학년도 단위 선별 파기가 가능하도록만 준비한다.

**NF2. 권한**
- NF2.1 관리 페이지는 `requireMenuAccess(session, 'forms')`, 관리 API는 `hasMenuAccess(session, 'forms')`. **`isAdmin()` 하드코딩 금지**(기존 applications API의 함정을 반복하지 않는다).
- NF2.2 신규 메뉴는 fail-closed로 `defaultRoles: ['admin']`으로 출발한다.
- NF2.3 공개 제출 API는 미들웨어가 `/api`를 타지 않으므로 **라우트가 스스로 `auth()`를 부른다**. 클라이언트가 보낸 `user_id`는 절대 신뢰하지 않는다.
- NF2.4 teacher에게 응답 열람을 여는 것은 2단계(`forms.responses` 키 분리). 1단계는 admin 전용.

**NF3. i18n**
- NF3.1 **폼 콘텐츠(문항 문구·선택지·동의문·안내문)는 `locale/*.json`이 아니라 폼 데이터**다. `schema_json` 안의 `{ko, en}` 쌍을 렌더러가 `LanguageContext`로 고른다(en이 비면 ko 폴백). 매년 바뀌는 것을 번들 json에 넣지 않는다.
- NF3.2 화면 크롬(버튼·오류·상태 라벨)만 `admin.forms.*` / `forms.*` 키로 `locale/ko.json`·`locale/en.json` **양쪽에** 추가. 한국어 값은 코드 fallback과 동일하게.
- NF3.3 `t(key, fallback)` 항상 fallback 인자를 넘긴다. 완료 전 `npm run lint:i18n` 0건.
- NF3.4 **응답자가 실제로 읽은 언어를 `form_responses.locale`에 기록**한다. 영어로 읽고 동의한 사람의 증빙에 한국어만 남는 것은 이중언어 사이트에서 증빙이 아니다.

**NF4. 성능·규모**
- NF4.1 D1 바인딩 파라미터 100개 상한 — INSERT와 `IN` 리스트 모두 `chunkParams(ids, 90)` 헬퍼를 거친다.
- NF4.2 모든 목록 조회에 `limit` 상한을 둔다(기본 100, 최대 500). 기존 `getApplications`의 무제한 패턴을 반복하지 않는다.
- NF4.3 연 200~400건 규모에서 `answers_json` 풀스캔은 문제가 아니다. **1단계에 표현식 인덱스를 달지 않는다**(§4.1.3 승격 사다리 참조).
- NF4.4 공개 폼은 `export const dynamic = 'force-dynamic'`. 스키마 로드는 폼 1행 조회 1회.

**NF5. 테마·레이아웃·접근성**
- NF5.1 **새 히어로를 만들지 않는다.** 공개 폼은 유틸형 페이지로 `padding-top: var(--page-offset-tight)`를 첫 섹션이 소유한다 → `scripts/lintTheme.mjs` 등록 불필요. (만약 히어로를 만들기로 하면 `GROUND_HEROES`에 반드시 등록)
- NF5.2 색은 역할 토큰(`--ground`, `--surface-2`, `rgba(var(--fg-rgb), α)`). 금색은 텍스트 `--soft-gold-text`/`--accent-text`, 배경·보더 `--soft-gold`/`--accent-color`.
- NF5.3 새 `<select>` 클래스를 만들면 `globals.css:8839-8846`의 option 배경 규칙에 셀렉터를 추가한다(라이트에서 흰 글자로 사라짐).
- NF5.4 접근성 기준선(기존 `RegistrationForm`에서 승계): 라벨 상시 노출, on-blur 검증, `aria-invalid`/`aria-describedby`, 오류 시 첫 필드 포커스, 성공 시 포커스 이동.
- NF5.5 완료 전 `npm run lint:theme` 0건 + **관리 콘솔·공개 폼을 라이트/다크 두 테마로 눈 확인** + 모바일 실기기에서 QR→제출 1회 왕복.

**NF6. 신뢰성**
- NF6.1 **접수 통지의 1차 채널은 웹푸시 + 인앱 알림함**. 메일은 보조. 근거: Gmail 앱비번 만료 이력이 문서로 남아 있고 재시도·큐·발송 로그가 없다.
- NF6.2 메일은 반드시 `lib/mail.ts` 공용 래퍼로만 보낸다. **인라인 nodemailer 금지.**
- NF6.3 제출자에게는 **접수번호를 완료 화면에 크게** 띄운다. 메일이 안 가도 남는 유일한 영수증이다.
- NF6.4 파생 테이블 부분 실패는 사고가 아니라 정상 상태로 취급하고, 자동 복구한다(§4.1.2).

**NF7. 스팸·남용**
- NF7.1 기존 `/api/applications`의 검증된 3종을 그대로 승계: `content-length > 64KB` → 413, 허니팟 `website` 채워짐 → **조용히 성공 위장**, `_t` 최소 2초 미만 → 429.
- NF7.2 응답당 답변 키 수 상한(100), 텍스트 필드 길이 상한(단답 200 / 장문 5000 / 이메일 254).
- NF7.3 **앱 레벨 레이트 리밋을 만들지 않는다.** 실제 남용이 관측되면 Vercel Firewall(코드가 아닌 설정)로 막는다.

---

## 3. 범위

### 3.1 1단계에 넣는 것 — "구글폼이 필요 없어진다"

기준선: **원장이 2026–2027 신청서를 사이트에서 만들고 → QR을 뿌리고 → 학부모가 폰으로 제출하고 → 운영진이 응답을 보고 메모하고 명단을 뽑고 CSV로 내보내고 → 확정된 사람을 수업에 배정한다.** 여기까지가 1단계다.

C안 원안은 승격·대리등록을 2단계로 뺐지만, 운영 현실 렌즈의 지적("학기 초 업무의 절반이 그 둘")을 받아들여 **승격(R3.7)과 대리 등록(R3.5)을 1단계로 당긴다.** 대신 회원 인라인 가입(R4.4~R4.6)을 2단계로 미뤄 총량을 유지한다.

- 마이그레이션 `0035_registration_forms.sql` (테이블 7 + `programs` ALTER 1줄)
- `types/forms.ts`, `lib/forms/schema.ts`(+`schema.test.ts`), `lib/forms/tuition.ts`, `lib/d1/forms.ts`, `lib/d1/formResponses.ts`, `lib/d1/chunk.ts`, `lib/d1/client.ts`에 `batchD1()`
- 메뉴 키 1개(`forms`) + locale ko/en
- **프리셋 기반 편집기** `/admin/forms/[id]` — 기본 / 과목·기간 / 동의·안내 / 추가 질문 / 공유 5탭
- 게시 게이트 `validateSchema()` + 버전 스냅샷 + `locked_at` 구조 잠금
- 공개 폼 `/f/[slug]` + 완료 `/f/[slug]/done` + `POST /api/forms/[slug]/submit`
- 응답 목록 / 상세 / 상태 · 메모 · 이력 / 민감 마스킹 + 열람 기록
- 과목별 명단 `/admin/forms/[id]/roster` (1년 등록 우선 → 선착순 정렬 기본값)
- CSV 내보내기 (민감 열 기본 제외)
- **학비표 조회 보조** — 선택 조합 + 기간 → 해당 학비표 행 표시, 없으면 "표에 없는 조합 — 개별 확인"
- 대리 입력 (`source='staff'`)
- 회원 결합 패널(검색 결합 + 계정 생성 + 임시 비밀번호) + **수강 배정 승격**
- `ShareQrCard` 투입
- `notifyStaffOfFormResponse()` (푸시 + 인앱)
- **2026–2027 폼 시드** `scripts/seedRegistrationForm.mjs`
- 대시보드 신규 건수 콜아웃 소스 교체 (`getApplicationCounts` → `getPendingResponseCounts`)
- `/classes/[slug]` 신청 버튼: `active_form_id` 있으면 `/f/{slug}`로
- **선행 수정 2건**: `/api/admin/programs/[id]/enrollments`의 `role !== 'student'` 400 완화, `EnrollmentManager` 드롭다운에 이름 검색

### 3.2 2단계 — 회원과 잇는다

- `app/api/register/route.ts`의 가입 로직 → `lib/members/createMember.ts` **함수 추출** (선행)
- 완료 화면 인라인 가입 3갈래 (R4.4~R4.6)
- `/account/password` 강제 리다이렉트의 `callbackUrl` 보존 (임시비번 회원이 폼 링크를 열 때)
- 미제출자 추적 (현 수강생 명단 ∖ 응답자) + 그 자리에서 대리 입력·푸시 독촉
- 미디어 동의 ↔ `users.public_archive_consent` 동기화 + 프로필 화면에 신청서 답 표시
- `forms.responses` 메뉴 키 분리 (teacher가 담당 과목 명단만)
- 응답 목록 필터 강화 — 필요하면 승격 사다리 2칸(표현식 인덱스)

### 3.3 3단계 — 옛 길을 닫는다

- 전 프로그램에 `active_form_id` 부여 → `/api/applications`, `RegistrationForm`, `ApplyModal`, `ApplyButton` 제거
- `applications` 메뉴 키 제거 + **`RETIRED_KEYS`에 등록**, `app/admin/applications/*` · `components/admin/applications/*` 삭제, `applications` 테이블 DROP (실측 0건이라 데이터 손실 없음)
- 인라인 nodemailer 잔재 정리 → `lib/mail.ts` 단일화
- 선택지 단위 `capacity` 대비 신청 수 표시 (자동 마감·승급은 아님)

### 3.4 4단계 이후 — 근거가 생기면

- 학비 룩업 테이블 + 예상 등록금 표시 (§7.1의 원장 확인이 끝난 뒤에만)
- 정원 기반 자동 대기(`waitlist`) + 승급 알림
- 격주(nth-week) 수업 일정 (현재 `lib/programSchedule.ts:85-100`이 매주 전개라 "2nd & 4th Sunday"를 표현 못 한다 — **별도 과제**)
- 이메일 검증(`email_verified`) 도입 / Turnstile

### 3.5 만들지 않는 것 (YAGNI) — 각각 이유 한 줄

| # | 만들지 않는 것 | 이유 |
|---|---|---|
| 1 | `form_questions` 정규화 테이블 | 문항 단위 SQL 질의가 실무에 없고, 정규화하면 연차 복제가 컬럼 1개 복사에서 행 N+M개 복사로 비싸진다 |
| 2 | 학비 자동 산출·견적 | Q7 선택지 8개↔학비표 코스 6종 매핑 3건이 미정의이고, 패키지가는 산식이 아니라 행마다 다른 룩업이다($400+$400인데 패키지 $650) |
| 3 | 온라인 결제 | 현행 업무에 아예 없다(`src:140`). 결제는 학비 산출(2번)이 선행이다 |
| 4 | 정원 자동 마감 · 대기자 자동 승급 | 규칙이 문구로만 존재하고, `(1년 등록) DESC, submitted_at` 정렬이면 사람이 5분에 끝낸다 |
| 5 | 중첩·다중조건 `showIf`, 페이지 분기 | 원본 14문항 중 조건부는 2건이고 둘 다 "이전 문항이 X면 표시" 1단계다 |
| 6 | 파일 업로드 · 날짜 · 척도 문항 유형 | 원본에 하나도 없다. R2 업로드·용량·바이러스 검사가 통째로 딸려온다 |
| 7 | 제출자의 응답 수정 링크 | 편집 토큰·만료·재발송이 따라온다. 재제출 + `is_latest`/`supersedes`로 같은 결과를 얻는다 |
| 8 | 형제자매 관련 기능 일체 (동시 제출·"다른 자녀 신청" 버튼) | 응답 1행 = 학생 1명이 명단·배정의 단위다. 원본도 학생 1명 기준(`src:210`). **사용자가 현행 유지를 선택**했다(§7.4 D5) — 편의 버튼도 만들지 않는다 |
| 9 | 드래그앤드롭 문항 정렬 | Plain CSS 스택에 dnd 라이브러리가 없다. ↑↓ 버튼이 접근성도 낫다 |
| 10 | 응답 통계·차트 대시보드 | CSV가 그 일을 하고 엑셀이 더 빠르다 |
| 11 | 앱 레벨 레이트 리밋 | 앱 전체에 없고, 저장소·키 결정이 붙는다. Vercel Firewall 설정으로 대체 |
| 12 | 폼별 커스텀 자동응답 메일 | 메일 자체가 신뢰 불가. 접수번호 화면이 영수증이다 |
| 13 | 상태 전이 규칙 엔진 | 기존 시스템의 진짜 문제는 자유 이동이 아니라 **무기록**이었다. 전이는 자유롭게 두고 전부 기록한다 |
| 14 | 비공개 토큰 URL 폼 | URL이 유출돼도 가능한 일은 제출뿐이고 응답 조회는 어떤 경로로도 불가하다(현행 구글폼과 같은 노출 수준) |
| 15 | ko/en 외 3개 이상 언어 | 사이트 전체가 ko/en 2개다 |
| 16 | `applications` 데이터 이관 스크립트 | 실측 0건. 존재하지 않는 데이터를 위한 작업이다 |
| 17 | 응답 하드 삭제 UI | 동의 증빙이 매달려 있다. 삭제는 `cancelled` 상태 + 별도 파기 절차로만 |

---

## 4. 설계

### 4.1 핵심 원칙

#### 4.1.1 무엇이 컬럼이고 무엇이 JSON인가 — 승격 4문

**아래 4문 중 하나라도 '예'면 JSON 밖으로 나간다. 아니면 전부 `answers_json` 슬롯이다.**

| # | 질문 | 예이면 |
|---|---|---|
| A | **폼이 없어도 존재하는가?** 어떤 질문지를 쓰든 시스템이 스스로 필요로 하는 축인가 | `form_responses` 코어 컬럼 |
| B | **다른 저장소·테이블과 조인되는가?** (MySQL `users`, D1 `programs`/`program_enrollments`) | 코어 컬럼 |
| C | **한 응답이 값을 여러 개 갖고, 그 값 단위로 명단을 뽑는가?** | `form_response_selections` |
| D | **법적 증빙·철회 판정에 쓰이는가?** | `form_response_consents` |

이 기준으로 실제 판정한 결과:

- **코어로 올린다**: 학생 이름·학년, 이메일, 전화, 보호자명, 제출자 user_id, 대상 학생 user_id, 상태, 출처, 최신본 여부, 민감정보 유무, 메모, 시즌, 언어, 스키마 버전.
  - **학년(Q3)만 예외적으로 코어**다 — 반편성·정렬의 기본축이며 어떤 폼에나 사실상 존재한다(A문 통과).
- **코어로 올리지 않는다**: **등록유형(Q1)·등록기간(Q6)·공연참가(Q8)**. 정규 시즌 폼에만 있고 특강 폼에는 없다(A문 탈락). 이 판정이 이 설계가 그은 선의 실제 위치다.
- **파생으로 뺀다**: 과목 다중선택(C문), 동의 5종(D문).

#### 4.1.2 파생 테이블의 헌법 — 트랜잭션 부재 대응

D1은 명시적 트랜잭션을 거부한다(실측). "응답 1행 + 선택 N행 + 동의 M행"을 원자적으로 쓸 방법이 없다. 그래서:

> **`answers_json`이 유일한 진실의 원천이고, `form_response_selections`·`form_response_consents`는 그로부터 언제든 재계산되는 파생 인덱스다.**

- 두 파생 테이블에는 `schema_json` + `answers_json`에서 유도할 수 없는 정보를 **절대 담지 않는다**(라벨 스냅샷·해시는 유도 가능하므로 허용).
- 응답 본체는 **단일 INSERT**로 원자적으로 착지한다. 파라미터 상한 청크 분할이 필요 없다.
- `rebuildDerived(responseId)`는 1단계 필수 산출물이다.
- **운영자에게 "파생 재구축" 버튼을 노출하지 않는다.** 운영 현실 렌즈가 정확히 지적한 대로, 원장에게 파생 인덱스라는 개념을 설명해야 하는 UI는 실패다. 대신:
  1. **제출 경로**: 파생 INSERT 실패 시 응답에 `derived_dirty = 1`을 세우고 응답은 정상 저장한다.
  2. **조회 경로**: 응답 목록·명단 화면 진입 시 해당 폼의 `derived_dirty = 1` 행을 최대 20건까지 **조용히 자동 재구축**한다.
  3. **가시화**: `derived_dirty` 잔량은 폼 상세의 "점검" 배지에만 뜬다(개발자·admin용). 배지 문구는 "명단에 아직 반영되지 않은 응답 N건 — 잠시 후 자동 반영됩니다".
  4. 수동 재구축은 `POST /api/admin/forms/[id]/rebuild-derived`로 남기되 **UI 기본 노출은 하지 않는다**(admin 상세의 접힌 '개발자 도구' 안).

#### 4.1.3 승격 사다리 — JSON에 남긴 것을 조회하는 법

| 칸 | 방법 | 비용 | 언제 |
|---|---|---|---|
| 1 | 그냥 JSON (`->>`) | 0 | **기본값. 1단계는 전부 여기.** |
| 2 | 표현식 인덱스 `ON form_responses(json_extract(answers_json,'$.q6_period'))` | 마이그레이션 1줄, 백필 없음 | 특정 축 필터가 느려질 때 |
| 3 | VIRTUAL 생성 컬럼 | 마이그레이션 1줄, 백필 없음. **JSON이 여전히 원천** | 그 축을 자주 SELECT·ORDER BY할 때 |
| 4 | 진짜 정규 컬럼 + 백필 | 크다. **같은 값이 두 곳에 산다** | 값을 *쓰기*까지 해야 하거나 별도 행이 필요할 때만 |

**규율: 3칸까지는 자유롭게 오른다. 4칸은 설계 결정으로 취급하고 마이그레이션 주석에 근거를 적는다.**
심사에서 "1인 개발에서 문서 규율은 지켜지지 않는다"는 지적을 받았으므로, 4칸 승격에는 **코드 강제**를 하나 건다: `lib/forms/schema.ts`의 `CORE_BINDINGS` 상수에 없는 `bind` 값을 쓰면 `validateSchema()`가 저장을 거부한다. 코어 컬럼을 늘리려면 상수와 마이그레이션을 같은 커밋에서 함께 고쳐야 한다.

### 4.2 데이터 모델 — `migrations/0035_registration_forms.sql`

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
--   ※ CHECK 제약을 걸지 않는다(0032 선례) — 값이 늘 때 마이그레이션 없이 추가하려고.
--     검증은 lib/forms/schema.ts(순수 함수 + schema.test.ts)가 한다.
--   ※ MySQL users 와는 교차 저장소라 FK 없이 user_id TEXT(UUID)로만 잇는다(0018 선례).
--   ※ 증빙 테이블에는 상위 CASCADE 를 걸지 않는다. 폼 삭제로 동의 증빙이 연쇄 소멸하면 안 된다.
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
  locked_at TEXT,                            -- 첫 제출 시각. 이후 파괴적 구조 변경을 API 가 409 로 막는다
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
  form_id INTEGER NOT NULL REFERENCES forms(id),   -- ON DELETE 미지정(NO ACTION)
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

  -- 사람 축 (A·B문 통과)
  submitted_by_user_id TEXT,                 -- 제출한 회원(학부모일 수 있다). 비회원이면 NULL
  student_user_id TEXT,                      -- 대상 학생의 MySQL users.id. 승격의 기준. 매칭 전이면 NULL
  link_source TEXT,                          -- session | signup | login_backfill | manual | NULL
                                             --   동의 증빙의 신뢰 등급. email_match(미검증 자동결합)는 쓰지 않는다
  student_name TEXT NOT NULL,
  student_name_norm TEXT NOT NULL,           -- lower(trim(공백제거)) — 중복 판정 키
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
  derived_dirty INTEGER NOT NULL DEFAULT 0,  -- 파생 테이블 미반영/불일치 표시. 조회 시 자동 재구축
  internal_note TEXT,                        -- 최근 메모 요약(전체 이력은 form_response_notes)
  reviewed_by TEXT,
  reviewed_at TEXT,
  enrolled_at TEXT,                          -- 수강 배정 승격 시각

  -- 확장 슬롯
  answers_json TEXT NOT NULL DEFAULT '{}',   -- 문항키 → 값. 진실의 원천
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

-- ── 4. 파생 1: 선택 축(C문) — "과목별 명단"이 1순위 질의라 승격 ──
CREATE TABLE IF NOT EXISTS form_response_selections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  response_id INTEGER NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,                -- 'q7_classes'
  option_key TEXT NOT NULL,                  -- 선택지 안정 키(라벨이 아니다 — 라벨은 매년 바뀐다)
  option_label_ko TEXT,                      -- 스냅샷(스키마를 읽지 않고도 CSV·명단이 성립하게)
  option_label_en TEXT,
  program_id INTEGER REFERENCES programs(id) ON DELETE SET NULL,  -- 수강 배정의 다리
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_frs_uniq ON form_response_selections(response_id, question_key, option_key);
CREATE INDEX IF NOT EXISTS idx_frs_option ON form_response_selections(option_key);
CREATE INDEX IF NOT EXISTS idx_frs_program ON form_response_selections(program_id);

-- ── 5. 파생 2: 동의 축(D문) ──────────────────────────────────────
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
CREATE TABLE IF NOT EXISTS form_sensitive_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  response_id INTEGER NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
  viewer_id TEXT NOT NULL,                   -- MySQL users.id
  viewer_name TEXT,
  context TEXT,                              -- 'detail' | 'csv'
  viewed_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fsv_response ON form_sensitive_views(response_id, viewed_at);

-- ── 8. 프로그램에 폼 붙이기 (요구 R3.3) ──────────────────────────
--   다:다가 아니라 1:N 이면 충분하다. 한 수업에 동시에 두 폼을 붙일 근거가 아직 없다.
ALTER TABLE programs ADD COLUMN active_form_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_programs_form ON programs(active_form_id);
```

**MySQL 마이그레이션은 0건이다.** 회원 결합은 `user_id TEXT`(UUID, FK 없음) 교차 참조로만 잇고, 폼 안 가입은 기존 `users`/`student_guardians` 스키마로 충분하다(`student_guardians.student_id`가 이미 NULL 허용 + `claimed_student_name` 보유).

### 4.3 `schema_json` 구조

```jsonc
{
  "version": 1,
  "presetKey": "season-2026",
  "sections": [
    {
      "key": "student",
      "title": { "ko": "학생 정보", "en": "Student Information" },
      "body":  { "ko": "", "en": "" },
      "questions": [
        {
          "key": "q1_reg_type",           // 불변. 삭제는 retired:true 툼스톤으로
          "type": "single",               // short | long | single | multi | consent | info
          "required": true,
          "label": { "ko": "등록 유형", "en": "Registration Type" },
          "help":  { "ko": "", "en": "" },
          "options": [
            { "key": "new",       "label": { "ko": "신규 등록", "en": "New Student" } },
            { "key": "returning", "label": { "ko": "재등록",   "en": "Returning Student" } }
          ]
        },
        { "key": "q2_student_name", "type": "short", "required": true, "bind": "student_name",
          "label": { "ko": "학생 이름", "en": "Student Name" } },
        { "key": "q3_grade", "type": "short", "required": true, "bind": "student_grade", "label": {} },
        { "key": "q4_email", "type": "short", "required": true, "bind": "email", "format": "email", "label": {} },
        { "key": "q4b_phone", "type": "short", "required": true, "bind": "phone", "format": "tel",
          "label": { "ko": "연락처 (Phone)", "en": "Phone Number" } },          // D4: 신설·필수
        { "key": "q4c_guardian", "type": "short", "required": false, "bind": "guardian_name",
          "label": { "ko": "보호자 이름 (Parent/Guardian)", "en": "Parent/Guardian Name" } },  // D4: 신설·선택
        { "key": "q5_medical", "type": "long", "required": false, "sensitive": true, "label": {} }
      ]
    },
    {
      "key": "classes",
      "questions": [
        { "key": "q6_period", "type": "single", "required": true,
          "options": [{ "key": "m3" }, { "key": "m6" }, { "key": "y1" }] },
        { "key": "q7_classes", "type": "multi", "required": true, "minSelect": 1,
          "selectionOf": "class",                      // ← 선택 파생 테이블로 승격하라는 지시
          "options": [
            { "key": "nanta_basic_1drum", "programId": 12, "capacity": 10,
              "courseCode": "kids_drum_1",
              "label": { "ko": "기초 난타반 1 Drum (12:45~1:15 P.M.)", "en": "…" } },
            { "key": "kids_dance", "programId": 13, "label": {} }
          ] }
      ]
    },
    {
      "key": "policy",
      "questions": [
        { "key": "q8_perform", "type": "single", "required": true,
          "options": [{ "key": "yes" }, { "key": "no" }] },
        { "key": "q9_reason", "type": "long", "required": false,
          "showIf": { "question": "q8_perform", "equals": ["no"] } },
        { "key": "q10_parade", "type": "consent", "required": true, "consentKey": "parade" },
        { "key": "q11_prop", "type": "single", "required": true, "consentKey": "prop_fee",
          "showIf": { "question": "q7_classes", "includes": ["youth_repertoire"] },
          "options": [{ "key": "agree", "consentValue": true },
                      { "key": "na", "consentValue": false, "exclusive": true }] },
        { "key": "q12_refund", "type": "consent", "required": true, "consentKey": "refund_policy" },
        { "key": "q13_media", "type": "single", "required": true, "consentKey": "media_release",
          "options": [{ "key": "yes", "consentValue": true }, { "key": "no", "consentValue": false }] },
        { "key": "q14_final", "type": "consent", "required": true, "consentKey": "final" },
        { "key": "info_tuition", "type": "info",
          "label": { "ko": "등록금 안내", "en": "Tuition Information" }, "help": {} }
      ]
    },
    { "key": "extras", "title": { "ko": "추가 질문", "en": "Additional" }, "questions": [] }
  ]
}
```

**매핑 지시자(binding)가 이 설계의 엔진이다.** 문항이 스스로 "이 답이 어디로 가는가"를 말한다:

| 지시자 | 효과 |
|---|---|
| `bind: "student_name" \| "student_grade" \| "email" \| "phone" \| "guardian_name"` | 코어 컬럼으로 복사 (`CORE_BINDINGS` 상수에 없는 값은 게이트가 거부) |
| `selectionOf` + `options[].programId` | `form_response_selections` 행 생성 |
| `consentKey` (+ `consentValue`) | `form_response_consents` 행 생성 |
| `sensitive: true` | `has_medical=1`, 목록·기본 CSV 제외 |
| `options[].exclusive` | 고르면 같은 문항의 나머지 해제 (Q11 "해당 없음") |
| `options[].capacity` | 명단 화면의 `7 / 10` 표시 (자동 마감 없음) |
| `options[].courseCode` | 학비표 룩업 키 (미정이면 생략) |
| `showIf: { question, equals[] \| includes[] }` | 1단계 조건부 노출 |
| `retired: true` | 툼스톤 — 렌더하지 않되 옛 응답 해석은 유지 |

지시자가 없으면 답은 `answers_json`에만 남는다.

**`answers_json` 값 형태**: `short`/`long` → 문자열, `single` → 선택지 key, `multi` → key 배열, `consent` → boolean, `info` → 저장하지 않음. 라벨 스냅샷은 넣지 않는다(버전 스냅샷 테이블이 갖고 있다). 반대로 파생 테이블에는 라벨을 스냅샷한다 — CSV·명단이 스키마를 읽지 않고도 성립해야 하기 때문. **이 비대칭이 의도된 것임을 마이그레이션 주석에 남긴다.**

### 4.4 편집기의 화면 언어 — "폼 빌더"가 아니라 "표 편집기"

C안이 운영 현실 렌즈에서 깎인 첫 번째 이유는 "원장이 스키마 에디터를 다뤄야 한다"였다. 해법은 저장소를 바꾸는 게 아니라 **화면을 B안의 언어로 바꾸는 것**이다. `schema_json`은 그대로 두고, 편집 UI만 도메인 표로 보이게 한다.

**신규 폼 생성 = 프리셋 선택** (`lib/forms/presets.ts`):

| 프리셋 | 내용 | 용도 |
|---|---|---|
| `season` | 14문항 + 섹션 4개 + 안내 블록 전부 포함 | 정규 학기 신청서 |
| `workshop` | 이름·이메일·전화·과목 1개·최종 동의 = 5필드 | 특강·단기 (30초에 만든다) |
| `survey` | 안내 + 자유 문항 0개 | 설문 |

**편집 화면 5탭** (`admin-page-tabs` 재사용):

1. **기본** — 제목·설명 ko/en(`admin-form-bilingual` 2열), slug, 시즌, 상태, 접수 기간 안내, 로그인 필수 토글
2. **과목·기간** — `q7_classes.options` / `q6_period.options`를 **표로** 편집. 행마다: 라벨 ko/en · 안내 문구(시간·격주) · **수업 연결(programs 셀렉트)** · 정원 · 학비 코스 · 순서(↑↓) · 사용 여부. 원장은 준비물·FAQ 관리에서 이미 같은 조작을 해봤다.
3. **동의·안내** — `consentKey`를 가진 문항 + `info` 블록을 표로. 유형(체크/예-아니오/선택지/안내문) · 본문 ko/en(장문) · 필수 · 조건부 노출(셀렉트 2개: "특정 과목 선택 시" / "공연 미참가 시")
4. **추가 질문** — 원장이 직접 신설하는 자유 문항. **유형 3종(단답/장문/단일선택)만.** 행 추가 = 질문 문구 ko/en + 유형 + 필수 토글. 이 답은 상세 화면과 CSV 끝열에만 나오고 SQL 집계의 1급 시민이 아니다 — **이 선이 흐려지면 이 설계가 무너진다**(§8.R5).
5. **공유** — `<ShareQrCard title={form.title_ko} path={`/f/${form.slug}`} />` + URL 복사 + 새 탭 미리보기

**"운영 준비 상태" 패널** (A안에서 접붙임) — 편집 화면 상단 고정. 원장이 이해할 수 있는 문장으로만:

```
✓ 회원 정보 자동 채우기 — 준비됨
✗ 수강 배정 — 과목 2개에 수업이 연결되지 않았습니다  [과목 탭에서 연결]
✓ 필수 동의 5건
ℹ 명단에 아직 반영되지 않은 응답 0건
```

이 패널이 이 설계의 최대 약점(매핑 지시자 오지정 → 폼은 정상 작동하는데 명단이 안 나옴 = **조용한 실패**)을 눈에 보이게 만든다.

### 4.5 게시 게이트와 잠금

**모든 `schema_json` 저장은 `validateSchema()`를 통과해야 한다.** 게이트를 우회하는 직접 PUT 경로를 만들지 않는다(코드 규율이 아니라 API 표면의 문제).

`validateSchema()`가 **차단**하는 것:
- 문항 key 중복 / 비ASCII / 빈 값
- `bind` 값이 `CORE_BINDINGS`에 없음, 또는 같은 `bind`를 두 문항이 씀
- `consentKey` 중복
- `showIf`가 존재하지 않는 문항·선택지를 가리킴
- 같은 문항 안 선택지 key 중복
- `multi`인데 `minSelect > 선택지 수`
- `format: "email"`인데 `type !== "short"`

`validateSchema()`가 **경고**만 하는 것(게시는 가능):
- `selectionOf` 문항의 선택지에 `programId` 미연결
- `capacity` 미지정
- `courseCode` 미지정

**버전 스냅샷**: `status='draft'→'open'`(게시) 시, 그리고 게시 이후의 모든 `schema_json` 저장 시 → `forms.schema_version += 1` + `form_schema_versions`에 전문 1행 INSERT. 편집 1회당 1행(연 수십 행)이므로 비용이 없다.

**구조 잠금(`locked_at`)** — A안에서 접붙임. 첫 제출이 들어오면 `locked_at`이 찍힌다. 그 뒤로 API가 **409로 거부**하는 것:
- 문항 삭제 (→ `retired: true`로만 가능)
- 선택지 삭제 (→ 사용 여부 off로만 가능)
- 문항 `type` 변경
- `bind` / `consentKey` / `selectionOf` 변경
- `required` false → true (이미 낸 사람의 응답이 소급 무효가 된다)

**허용**되는 것: 문항 추가, 선택지 추가, 모든 문구 수정, 순서 변경, `required` true → false, 정원·수업 연결 변경.

이렇게 하면 "실수로 필수로 만들었는데 이미 3명이 냈다"에서 운영자가 막히지 않고(→false는 허용), 증빙은 버전 스냅샷이 지킨다. C안 원안의 "에디터가 삭제 버튼을 진짜 삭제로 구현하면 그날로 깨진다"는 관례 의존이 **코드 강제로 바뀐다.**

### 4.6 화면 목록

**관리 콘솔** (메뉴 키 `forms`, 그룹 `lesson`, `programs` 다음 자리, `defaultRoles: ['admin']`)

| 경로 | 내용 | 단계 |
|---|---|---|
| `/admin/forms` | 폼 목록(상태 뱃지·시즌·응답 수). [새 신청서] | 1 |
| `/admin/forms/new` | 프리셋 선택 + 제목·slug·시즌 | 1 |
| `/admin/forms/[id]` | 편집 5탭 + 운영 준비 상태 패널 + [게시]/[마감]/[복제] | 1 |
| `/admin/forms/[id]/responses` | 응답 목록(필터·검색·정렬) | 1 |
| `/admin/forms/[id]/responses/new` | 대리 입력 (`source='staff'`) | 1 |
| `/admin/forms/[id]/responses/[rid]` | 상세: 답변 전개 / 처리 패널 / 동의 증빙표 / 회원 결합 / 수강 배정 / 학비표 조회 | 1 |
| `/admin/forms/[id]/roster` | 과목별 명단 (정원 대비, 1년 우선→선착순) | 1 |
| `/admin/forms/[id]/unsubmitted` | 미제출자 추적 | 2 |

⚠️ 하위 경로는 `resolveMenuKey`의 세그먼트 longest-match로 **자동으로 `forms` 키를 상속**한다. hidden 메뉴 + `parentKey` + `menuNav.test.ts` 계약을 통째로 피한다 — **메뉴 키 1개면 충분하다.**

**공개**

| 경로 | 내용 | 단계 |
|---|---|---|
| `/f/[slug]` | 공개 폼. `force-dynamic`, `robots:{index:false, follow:false}` + openGraph 유지(카톡 미리보기), 히어로 없이 `--page-offset-tight` | 1 |
| `/f/[slug]/done?r={id}` | 완료 화면 + **접수번호 크게** + (2단계) 가입 갈래 | 1 |

**기존 화면 수정**

| 경로 | 수정 | 단계 |
|---|---|---|
| `/classes/[slug]` | `active_form_id` 있으면 신청 버튼이 `/f/{slug}`로 | 1 |
| `/admin/programs/[id]` | "신청 폼" 셀렉트(`active_form_id`) + `EnrollmentManager`에 **이름 검색** | 1 |
| `/admin` (StaffDashboard) | 신규 건수 소스 교체 | 1 |

### 4.7 API 목록

**공개**

| 메서드·경로 | 인증 | 내용 |
|---|---|---|
| `POST /api/forms/[slug]/submit` | 없음 (`auth()`는 선택적 자체 호출) | 제출. 스팸 3종 → 폼 상태·기간 재확인 → `validateAnswers` → `applyBindings` → 응답 단일 INSERT → 파생 INSERT(실패 시 `derived_dirty=1`) → 푸시 통지 → `{success:true, data:{responseId}}` |

**관리** (전부 `hasMenuAccess(session,'forms')` + `{success, data|error}` 규약)

| 메서드·경로 | 내용 |
|---|---|
| `GET/POST /api/admin/forms` | 목록 / 생성(프리셋) |
| `GET/PUT/DELETE /api/admin/forms/[id]` | 조회 / 스키마·헤더 저장(게이트 통과 필수) / 삭제(응답 0건일 때만) |
| `POST /api/admin/forms/[id]/publish` | `draft→open`. 버전 스냅샷 |
| `POST /api/admin/forms/[id]/close` | `open→closed` |
| `POST /api/admin/forms/[id]/duplicate` | 연차 복제. `schema_json` 컬럼 복사 |
| `GET /api/admin/forms/[id]/responses` | 응답 목록(필터·검색·페이지, limit 상한) |
| `POST /api/admin/forms/[id]/responses` | 대리 입력 |
| `GET/PATCH /api/admin/forms/[id]/responses/[rid]` | 상세 / 상태·메모 변경(자동 이력 기록) |
| `POST /api/admin/forms/[id]/responses/[rid]/reveal` | 민감 문항 열람 + `form_sensitive_views` 기록 |
| `POST /api/admin/forms/[id]/responses/[rid]/link-member` | 회원 검색 결합 / 계정 생성 |
| `POST /api/admin/forms/[id]/responses/[rid]/promote` | **수강 배정 승격** |
| `GET /api/admin/forms/[id]/roster` | 과목별 명단 |
| `GET /api/admin/forms/[id]/export.csv` | CSV (`?include_sensitive=1`은 admin만 + 열람 기록) |
| `POST /api/admin/forms/[id]/rebuild-derived` | 파생 재구축 (UI 기본 노출 없음) |

**선행 수정**

| 파일 | 수정 |
|---|---|
| `app/api/admin/programs/[id]/enrollments/route.ts:64` | `member.role !== 'student'` 400 → `['student','teacher','user','parent']` 허용. 이걸 풀지 않으면 일요 성인반 승격이 전부 막힌다 |
| `lib/d1/client.ts` | `batchD1(statements)` 추가. **롤백이 없다**는 사실을 함수 주석에 못박고, 호출부를 파생 INSERT 1곳으로 제한 |
| `lib/d1/chunk.ts` (신규) | `chunkParams(values, 90)` — INSERT·IN 리스트 공용 |

### 4.8 상태 전이

```
                    ┌──────────────┐
   제출 →  new ─────▶  reviewing  ─────▶ accepted ─────▶ enrolled
             │        └──────┬───────┘        │              │
             │               ▼                │              │
             │          needs_info ───────────┘              │
             │               │                               │
             └───────────────┴──────▶ declined / cancelled ◀─┘
```

- **전이 규칙을 강제하지 않는다.** 어느 상태에서 어디로든 갈 수 있다. 기존 시스템의 진짜 문제는 자유 이동이 아니라 무기록이었다.
- **모든 전이가 `form_response_notes`에 `kind='status'`, `from_status`, `to_status`, `author_id`로 자동 기록된다.**
- **`enrolled`만 예외**: 승격 API(`/promote`)만 이 값을 설정한다. 드롭다운에서 직접 고를 수 없다. 그래야 "확정 상태인데 아무 일도 안 일어남"이라는 기존 시스템의 결함이 반복되지 않는다.
- **`is_latest`는 상태와 직교한다.** 재제출로 눕혀진 이전 본은 상태를 유지한 채 `is_latest=0`이 되고, 목록 기본 필터에서 빠진다.

**응답 대표 질의**

```sql
-- 과목별 명단 (1년 등록 우선 → 선착순: 원본 src:55 의 배정 규칙이 곧 ORDER BY)
SELECT r.id, r.student_name, r.student_grade, r.email, r.phone,
       r.answers_json ->> '$.q6_period' AS period,
       r.status, r.has_medical
FROM form_response_selections s
JOIN form_responses r ON r.id = s.response_id
WHERE s.option_key = ?1 AND r.form_id = ?2
  AND r.is_latest = 1 AND r.status NOT IN ('cancelled','declined')
ORDER BY CASE r.answers_json ->> '$.q6_period'
           WHEN 'y1' THEN 0 WHEN 'm6' THEN 1 ELSE 2 END,
         r.submitted_at;

-- 정원 대비 현황
SELECT s.option_key, s.option_label_ko, COUNT(*) AS requested
FROM form_response_selections s
JOIN form_responses r ON r.id = s.response_id
WHERE r.form_id = ?1 AND r.is_latest = 1 AND r.status NOT IN ('cancelled','declined')
GROUP BY s.option_key ORDER BY s.option_key;

-- 미디어 동의 거부자(노출 차단 대상)
SELECT r.student_user_id, r.student_name
FROM form_response_consents c
JOIN form_responses r ON r.id = c.response_id
WHERE c.consent_key = 'media_release' AND c.agreed = 0 AND r.is_latest = 1;

-- 정산 플래그 한 줄
SELECT r.id, r.student_name,
       r.answers_json ->> '$.q8_perform' AS perform,
       r.answers_json ->> '$.q6_period'  AS period,
       (SELECT agreed FROM form_response_consents c
         WHERE c.response_id = r.id AND c.consent_key = 'prop_fee') AS prop_fee
FROM form_responses r WHERE r.form_id = ?1 AND r.is_latest = 1;
```

### 4.9 학비표 조회 보조 (`lib/forms/tuition.ts`)

**자동 산출이 아니다. 계산도 청구도 하지 않는다.** 학비표 24행을 `(코스 개수 벡터 + Sat/Sun 조건 플래그) × 3기간 → 금액`의 순수 룩업으로 하드코딩하고, 운영자 상세 화면에 **해당 행을 그냥 띄운다.**

```
선택: 1 Dance Course + Kids Drum 3 / 기간: 6개월
→ 학비표: $1,225   (2026–2027 표 기준, 참고용)
```

매칭되지 않으면:

```
→ 표에 없는 조합 — 개별 확인 필요
```

근거: 매년 가장 오래 걸리는 일이 "개별 연락해 등록금 안내"이고, 사람이 표를 뒤지는 수고만 없애는 이 기능은 반나절 작업이다. 미정의 조합은 "개별 확인"으로 정상적으로 빠지므로 §7.1이 미확정인 지금 넣어도 안전하다. `courseCode`가 비어 있으면 그냥 조회를 시도하지 않는다.

---

## 5. 핵심 흐름 4종

### 5.1 폼 제작 · 공유 (R1.1~R1.3, R2.5, R3.1~R3.4)

1. `/admin/forms` → **[새 신청서]** → 프리셋 선택(`정규 학기` / `특강` / `설문`) + 제목 ko/en + slug + 시즌.
   - `season` 프리셋을 고르면 **14문항이 이미 들어 있는 상태로** 편집기가 열린다. 빈 캔버스에서 문항을 조립하지 않는다.
   - `workshop` 프리셋은 5필드짜리 짧은 폼이다. 특강 폼 만들기가 30초에 끝난다.
2. **과목·기간 탭**에서 표를 편집한다. 각 과목 행에서 `programs` 셀렉트로 **수업을 연결**한다 — 이 연결이 명단·승격의 유일한 통로다.
3. **동의·안내 탭**에서 연도 문구·환불 규정·미디어 동의문을 고친다. 조건부 노출은 셀렉트 2종("특정 과목 선택 시" / "공연 미참가 시")으로만.
4. **추가 질문 탭**에서 올해만 필요한 질문을 원장이 직접 신설한다(단답/장문/단일선택).
5. 상단 **운영 준비 상태 패널**이 빨간 줄을 보여주면 고친다. 경고가 있어도 게시는 가능하다.
6. **[게시]** → `validateSchema()` 차단 항목이 없으면 `status='open'`, `published_at`, `schema_version` 확정, `form_schema_versions`에 전문 스냅샷 1행.
7. **공유 탭**의 `ShareQrCard`에서 QR을 내려받아 인쇄하거나 URL을 카톡으로 뿌린다. **기존 컴포넌트에 prop만 넣는다 — 신규 개발 0줄.**
8. 특강이면 `/admin/programs/[id]`에서 `active_form_id`로 그 수업에 붙인다. `/classes/[slug]`의 신청 버튼이 `/f/{slug}`로 간다.

### 5.2 방문자 제출 (+ 회원가입) (R4.1~R4.7, R5.1~R5.4, NF7)

1. QR/링크 → `/f/[slug]`.
   - `draft`/`archived` → 404. `closed` 또는 기간 밖 → 접수 마감 안내(제출 불가).
   - `requires_login=1`인데 비로그인 → 로그인 CTA + `callbackUrl=/f/{slug}` (`LoginForm`이 사이트 내 상대경로만 허용하는 기존 방어 그대로).
2. **로그인 상태면 프리필**: `bind`가 있는 문항에 세션의 이름·이메일·전화가 채워진다. 학부모면 `getGuardianChildren()`으로 자녀 셀렉트가 뜨고, 고르면 **`student_user_id`가 확정된다**(승격의 기준). `link_source='session'`.
3. **렌더**: `schema_json`을 순회해 섹션·문항을 그린다. 유형별 필드 프리미티브는 기존 `RegistrationForm`의 접근성 기준선을 승계한다. CSS는 `register-*` 클래스 확장.
   - `showIf` 미충족 문항은 **DOM에서 제거하고 값도 전송하지 않는다.** Q9(공연 미참가 사유)와 Q11(칼 소품비)이 여기서 해결된다 — 구글폼이 못 하던 것.
   - `exclusive` 선택지를 고르면 같은 문항의 나머지가 해제된다.
   - 응답자의 현재 언어를 `locale`로 함께 보낸다.
4. **제출** `POST /api/forms/[slug]/submit`:
   - 방어: `content-length > 64KB` → 413 / 허니팟 `website` 채워짐 → **조용히 성공 위장** / `_t` 2초 미만 → 429 / 답변 키 수 100 초과 → 400.
   - **서버가 폼 상태·기간을 재확인한다**(클라이언트 신뢰 금지). 세션이 있으면 라우트가 스스로 `auth()`를 불러 `submitted_by_user_id`를 확정한다.
   - `validateAnswers(schema, answers)` — 필수(숨겨진 문항은 필수 해제), 길이, 선택지 키 소속, 이메일 형식, `consent` 필수 true.
   - `applyBindings()` → 코어 컬럼을 채우고 **`form_responses` 단일 INSERT**. 본체는 원자적으로 착지한다.
   - 이어서 파생 2종 INSERT. **실패하면 `derived_dirty=1`만 세우고 응답은 정상 처리한다.**
   - **중복 판정**: 같은 `form_id` + (`submitted_by_user_id` 또는 `email_norm`) + `student_name_norm`의 기존 `is_latest=1` 행이 있으면 옛 행을 `is_latest=0`으로 내리고 새 행에 `supersedes_response_id`를 잇는다. **제출을 막지 않는다** — 정정 재제출과 형제자매가 정상 업무다. (`is_latest` 갱신이 두 문장이라 원자적이지 않다 → 조회 시 그룹 내 `MAX(submitted_at)` 보정을 이중으로 건다.)
   - **통지**: `lib/push/system.ts`에 `notifyStaffOfFormResponse()` 형제 함수 1개 추가 → 내부 `notifyUsers()`가 푸시 실패 흡수 + MySQL `notifications` + `notification_recipients`까지 3단계를 이미 처리한다. 메일은 `lib/mail.ts`로 보조 발송(fire-and-forget).
5. **완료 화면** `/f/[slug]/done?r={id}` — **접수번호를 크게** 띄운다. 메일이 안 가도 제출자에게 남는 유일한 영수증이다.
6. **가입 갈래 (2단계)** — 가입을 제출의 전제조건으로 만들지 않는다. 구글폼보다 마찰이 커지면 흐름 자체가 실패한다.
   - (a) 로그인 상태였다 → 이미 결합됨. "내 신청 내역" 안내.
   - (b) 비회원인데 **입력 이메일에 이미 계정이 있다** → "이미 계정이 있습니다. 로그인하면 이 신청이 계정에 연결됩니다" + `callbackUrl`. **자동 결합하지 않는다** — 앱 전체에 이메일 검증(`email_verified` 쓰기 코드)이 0건이라 자동 결합은 계정 탈취 통로가 된다. 로그인 성공 후 `응답 id + 이메일 일치`로 백필하고 `link_source='login_backfill'`.
   - (c) 신규 → 이름·이메일·전화가 채워진 간이 가입 패널에서 **비밀번호만 받는다.** `lib/members/createMember.ts`(추출) 호출 → `status='pending'`, `terms_agreed_at` 기록 → 자동 로그인 → `submitted_by_user_id` 백필, `link_source='signup'`.
     - **학부모 자녀 선행가입 404 회피**: `student_guardians`에 `student_id=NULL` + `claimed_student_name`/`claimed_enrollment_year`만 남긴다. 기존 스키마가 이미 지원한다. 첫 신청 가족이 막히지 않는다.
     - 가입 결과가 `pending`이라 `/admin`에 못 들어간다. 그래서 **본인 확인 화면은 콘솔이 아니라 공개 경로**에 둔다.
     - `mustChangePassword` 전역 리다이렉트(`auth.config.ts:28`) 때문에 임시 비번 회원이 폼 링크를 열면 비밀번호 페이지로 튕긴다 → 그 페이지가 `callbackUrl`을 보존해 폼으로 되돌린다(2단계 필수 항목).

### 5.3 응답 처리 → 수강 배정 (R1.6~R1.10, R3.5~R3.7, R4.7)

1. `/admin/forms/[id]/responses` — 진입 시 `derived_dirty` 행을 조용히 자동 재구축한다.
   - 열: 제출시각 / 학생 / 학년 / 이메일·전화(`mailto:`·`tel:`) / 과목 칩 / 기간 / 상태 / 메모 유무 / **`has_medical` 배지(내용 없음)**
   - 정렬 기본: 미처리 우선 + 최신순. 명단 화면 정렬 기본: **1년 등록 우선 → 선착순**.
   - 필터: 상태 · 과목(`option_key`) · 기간(`answers_json ->> '$.q6_period'`) · 검색(이름·이메일·전화)
2. 상세 `/admin/forms/[id]/responses/[rid]`:
   - 왼쪽: 문항 순서대로 답 전개. **`form_schema_version`으로 `form_schema_versions`를 조인해 그 시점 문안으로 렌더한다** — 폼을 나중에 고쳐도 당시 화면이 실제로 재현된다.
   - 민감 문항은 접혀 있고, [펼쳐 보기]를 누르면 `/reveal` 호출 → `form_sensitive_views` 기록 후 표시.
   - 오른쪽: 상태 셀렉트(변경 시 이력 자동) / 메모 입력 / 동의 증빙표(항목·값·시각·문안버전·해시) / 학비표 조회 결과 / 회원 결합 / 수강 배정.
3. **회원 결합**: `student_user_id`가 비어 있으면 이름+이메일로 MySQL 후보 검색(`lib/members.ts`) → 확정(`link_source='manual'`). 없으면 **[계정 만들기]** → `createMember()` + `generateTempPassword()`/`setTempPassword()`(`must_change_password=1`) → 임시 비밀번호를 화면에 1회 표시(운영진이 전달). 학부모 계정도 같은 패널에서 만들고 `student_guardians` 링크를 즉시 확정.
4. **[수강 배정] 승격**:
   ```
   form_response_selections 중 program_id 가 있는 행마다
   → createEnrollment({ program_id, user_id: student_user_id, enrolled_by, note: `form#${rid}` })
   → UPSERT(ON CONFLICT DO UPDATE) 라 멱등. 두 번 눌러도 안전
   → 성공 시 status='enrolled', enrolled_at 기록, notes 에 kind='enroll' 1행
   → 미디어 동의 동기화: media_release 가 거부면 users.public_archive_consent=0 즉시 반영
   ```
   - **`student_user_id`가 없으면 승격 버튼이 비활성**이다("먼저 회원을 연결하세요"). 학부모를 수업에 배정하는 사고를 구조적으로 막는다.
   - `program_id`가 없는 선택지는 회색 + "수업 연결 필요" + 편집 링크.
5. **대리 등록** `/admin/forms/[id]/responses/new` — 같은 렌더러를 운영진 모드로. `source='staff'`, 허니팟·최소시간 생략, **이메일 필수 완화**(전화만 아는 경우). `email` 컬럼이 NULL 허용이라 가짜 이메일을 만들 필요가 없다.
6. **폼 없이 직접 관리** — 기존 `/admin/programs/[id]`의 `EnrollmentManager`가 그대로 산다. 폼은 입구가 하나 더 생긴 것이지 유일한 입구가 아니다. 다만 **드롭다운에 이름 검색을 넣는다**(학기 중 추가 등록·형제 추가·체험 후 등록이 상시 발생하는데 현재는 회원을 하나씩 드롭다운에서 골라야 한다).
7. **CSV**: 열 순서 = `schema_json` 순서. 제출시각/학생/학년/이메일/전화/보호자/등록유형/기간/과목 N열/공연 Y·N/미참가사유/동의 5종/추가질문 N열. **`sensitive` 문항은 기본 제외**, 포함하려면 체크박스 + 확인 모달 + 열람 기록. `response_id IN (...)`은 `chunkParams(ids, 90)`을 반드시 거친다.

### 5.4 연도 재사용 (R2.1~R2.7)

1. `/admin/forms`에서 `2026-2027` 폼의 **[내년 폼 만들기]**.
2. `POST /api/admin/forms/[id]/duplicate` — 서버가 하는 일:
   - `schema_json` **컬럼 통째 복사** (문항 N개·선택지 M개를 행으로 옮기지 않는다. 이게 복제가 싼 이유다)
   - `season`을 다음 학년도로, `slug`를 `2027-2028-regular`로, `status='draft'`, `schema_version=1`, `locked_at=NULL`, `copied_from_form_id=원본id`
   - **응답은 따라오지 않는다** (`form_id`로 완전 분리)
   - `showIf`는 문항 key·선택지 key를 참조하고 key가 그대로 복사되므로 **리매핑이 필요 없다** — B안이 자백한 "복제 로직에서 가장 깨지기 쉬운 한 줄"(옵션 id를 문자열에 박는 DSL)이 이 설계에는 존재하지 않는다.
3. 편집: 연도 문구, 가격 안내, 새 과목 추가, 폐지 과목 `retired: true`, 동의 문안 갱신. **문항 key는 불변**이라 작년 응답의 `answers_json`이 계속 해석되고 연도 간 비교가 성립한다.
4. **[게시]** → 새 slug로 QR을 다시 뽑는다. 작년 폼은 `closed`(열람·CSV 계속 가능) → 학년도가 끝나면 `archived`.
5. 문안이 바뀌면 `schema_version`이 오르고 **이후 응답만** 새 버전으로 서명된다. 작년 응답은 `form_schema_versions`의 옛 행을 가리키므로 증빙이 소급 오염되지 않는다.
6. **폼 삭제 UI는 없다.** 응답이 매달린 `form_id`가 `NO ACTION`이라 DB가 거부하고, `archived`가 삭제의 자리를 대신한다.

> ⚠️ **slug 정책 결정 필요** — 매년 새 slug(`2027-2028-regular`)면 작년 QR이 죽고 새로 인쇄해야 한다. 고정 slug(`apply`)를 매년 갈아끼우면 QR을 재사용하는 대신 작년 폼 주소가 사라진다. §7.9.

---

## 6. 기존 시스템과의 관계

| 대상 | 판정 | 근거와 처리 |
|---|---|---|
| **`applications` 테이블** | **폐기** (1단계 차단 → 3단계 DROP) | 원격 D1 실측 **0건**. 이관할 데이터가 없다. 1단계에서 `/classes/[slug]` 신청 버튼을 `active_form_id`가 있는 수업부터 새 폼으로 돌리고, 3단계에 테이블·API·컴포넌트를 제거한다. 병존 기간을 최소로 끊는다 |
| `app/api/applications/route.ts` | 폐기 (3단계) | 인라인 nodemailer 포함 삭제. 스팸 3종의 **관용구는 새 라우트가 승계**한다 |
| `components/classes/RegistrationForm.tsx` | **부분 흡수** | 접근성 패턴(라벨 상시 노출·on-blur·`aria-invalid`/`describedby`·포커스 이동)과 `register-*` CSS를 **동적 문항 렌더러의 필드 프리미티브로 승격**한다. 파일 자체는 3단계에 제거 |
| `ApplyModal` / `ApplyButton` / `ApplyModalProvider` | 폐기 (3단계) | `#apply` 딥링크 관례는 새 폼에 필요 없다(폼 자체가 독립 URL) |
| `applications` 메뉴 키 | 폐기 + **`RETIRED_KEYS` 등록** (3단계) | 키 재사용 금지 규칙. 잔여 DB 권한 행 부활 방지 |
| `app/admin/applications/*` | 폐기 (3단계) | 목록 UI 골격(필터+검색+상태 셀렉트+mailto/tel, `new` 우선 정렬)은 새 응답 테이블이 물려받는다 |
| `getApplicationCounts()` / `StaffDashboard` 콜아웃 | **소스 교체** (1단계) | `getPendingResponseCounts()`로 |
| **`programs`** | **연동** (컬럼 1개 추가) | `active_form_id` ALTER 1줄. 폼이 프로그램에 붙는 방향이지, 프로그램이 폼에 종속되지 않는다. `program_type`의 class/program 구분은 라벨뿐이므로 폼 프리셋(`season`/`workshop`)이 실질 구분을 맡는다 |
| `program_images` / `program_supplies` / `gallery_photos.program_id` | 무관 | 손대지 않는다 |
| **`program_enrollments`** | **연동 + 선행 수정 1건** | `createEnrollment()` UPSERT를 승격 API가 그대로 호출한다(멱등이라 다과목 1응답 → N배정이 안전). **`/api/admin/programs/[id]/enrollments:64`의 `role !== 'student'` 400을 완화하지 않으면 성인반·선생님 승격이 전부 막힌다.** `EnrollmentManager`는 존치하되 이름 검색을 추가 |
| **`users` (MySQL)** | **연동, 마이그레이션 0건** | `user_id TEXT`(UUID, FK 없음) 교차 참조. `submitted_by_user_id`(제출자)와 `student_user_id`(대상 학생)를 **분리**한다 — 학부모 대리 제출 시 이 분리가 없으면 학부모를 수업에 배정한다 |
| `app/api/register/route.ts` | **리팩터** (2단계 선행) | 인라인 가입 로직을 `lib/members/createMember.ts`로 함수 추출. 기존 라우트도 이걸 부르게 바꾼다(동작 동일). 폼 내 가입과 대리 계정 생성이 둘 다 이 함수를 쓴다 |
| `student_guardians` | **활용, 스키마 무변경** | `student_id=NULL` + `claimed_student_name`을 그대로 쓴다. 신규 가족의 자녀 선행가입 404를 우회하는 경로가 **이미 스키마에 있다** |
| `users.terms_agreed_at` (0031) | **유지, 무관** | 사이트 가입 약관 동의. 신청서의 동의 5종과는 별개 축이다 |
| `users.public_archive_consent` (0011) | **동기화 규칙 신설** | **현재 상태의 주인은 회원 프로필**(가변·철회 가능, 노출 판정의 유일한 근거). **응답의 `media_release`는 그 시점 서명**(불변·증빙). 승격 시 거부(`agreed=0`)는 **즉시** `public_archive_consent=0`으로 내려쓰고, 동의는 승격 시점에만 1로 올린다. 그 뒤 본인이 프로필에서 바꾼 값이 승자. 프로필 화면에 "2026–2027 신청서에서 ○○로 답하셨습니다"를 표시해 어긋남을 눈에 보이게 한다. **이 규칙을 구현하지 않으면 거부한 학생 사진이 `/students`에 노출된다 — 법적 위험이다** |
| `users.email_verified` | **미사용 유지** | 컬럼은 있으나 쓰기 코드가 앱 전체에 0건이다. 이 설계는 이 구멍을 **해결하지 못한다**(§8.R7). 완화로 미검증 이메일 자동 결합만 금지한다 |
| `lib/push/*` (0013/0014/0016/0033) | **재사용** | `notifyUsers()` 위에 형제 함수 1개 추가. 푸시 미설정 회원도 `/admin/inbox`에서 확인 |
| `lib/mail.ts` | **재사용, 보조 채널** | 새 코드는 이것만 쓴다. 인라인 nodemailer 금지 |
| `components/share/ShareQrCard.tsx` | **재사용, 개발 0줄** | 콘솔 첫 투입이므로 `.share-qr-card` 계열 CSS를 관리 콘솔 라이트/다크에서 눈으로 확인 |
| `components/common/Modal.tsx` | 재사용 | 문항 편집·확인 모달 |
| `/rsvp/[id]` | **관례만 승계** | `force-dynamic` + `robots:{index:false}` + openGraph 유지. 저장소는 공유하지 않는다(체크인 테이블은 boolean 응답 전용) |
| `lib/programSchedule.ts` | **무관, 알려진 한계** | 매주 전개라 "2nd & 4th Sunday" 격주 수업을 표현 못 한다. 폼은 선택지 라벨로 안내할 뿐이고, 근본 해결은 별도 과제(4단계) |
| `lib/d1/eventViews.ts` | 관례 참조 | "필터가 아니라 관점" 규칙에 따라 `lib/d1/formViews.ts`를 두고 `formViews.test.ts`로 잠근다 |

---

## 7. 쟁점과 그 결론

**§7.1~§7.11은 답이 나왔다**(§0 표). 각 항목은 판단 근거를 남기기 위해 원문을 보존하고 머리에 확정 내용을 붙였다.
**§7.12만 아직 열려 있고, 이것이 1단계 착수의 유일한 남은 블로커다.**

### 7.1 학비 자동 산출 범위 — ✅ 확정: (B) 운영자 화면 조회 보조까지

**질문**: 학비를 시스템이 어디까지 다뤄야 하는가? 그리고 그 전제로 **Q7 선택지를 학비표에 맞게 쪼갤 것인가?**

**사실 확인**:
- Q7 선택지 8개와 학비표 코스 6종이 **1:1이 아니다.** "기초 난타반 1 Drum & 3 Drum"은 한 선택지인데 학비표에서는 $400/$450 두 코스다(`src:61` ↔ `src:152-153`). "오고무, 동고"도 $600/$700 두 코스에 걸친다(`src:63` ↔ `src:154-155`).
- 일요 성인반 3종(`src:66-68`)의 학비표 대응이 **불명**(`src:202`). "K-DRUM Ensemble"↔"Mega Drum" 대응은 **추정**(`src:201`).
- 패키지가는 산식이 아니다. $400+$400=$800인데 패키지 $650(`src:204`). 1 Dance 1년 $1,140인데 400×4×0.8=$1,280(`src:151`). **행마다 규칙이 다르므로 룩업 테이블만이 표를 재현한다.**
- 표에 없는 조합이 존재한다(`src:205`) → **"가격 없음"이 오류가 아닌 정상 상태**여야 한다.

**선택지**:
- (A) 1단계는 안내 문구만. 학비 관련 기능 0.
- (B) **1단계에 조회 보조만** — 선택 조합 + 기간 → 학비표 해당 행을 운영자 화면에 표시. 계산·청구 없음. 미정의 조합은 "개별 확인".
- (C) 1단계에 견적 자동 산출 + 신청자에게 표시.
- (D) 결제까지.

**내 추천: (B) + Q7 선택지 쪼개기**
근거: (A)는 매년 가장 오래 걸리는 일("개별 연락해 등록금 안내")을 그대로 둔다. (B)는 반나절 작업으로 사람이 표를 뒤지는 수고를 없애면서 계산 책임을 지지 않는다 — 미정의 조합은 정직하게 "개별 확인"으로 빠진다. (C)는 매핑 3건이 미정인 상태에서 **틀린 금액을 학부모에게 보여주는 위험**을 진다. 선택지 쪼개기는 데이터 편집이라 마이그레이션이 필요 없고, 다만 **선택지 key는 한 번 정하면 툼스톤 없이는 못 바꾸므로 지금 확정**해야 한다.

**확정 내용**: (B)를 채택한다 — 신청자에게는 금액을 보여주지 않고, 응답 상세의 운영자 화면에서만 학비표 해당 행을 조회한다. 계산·청구는 하지 않는다. 표에 없는 조합은 "개별 확인"으로 정직하게 빠진다.
**남은 하위 문제는 §7.12로 분리했다** — 조회 보조가 성립하려면 과목↔코스 매핑 4문항의 답이 필요하다.

### 7.2 온라인 결제 도입 여부 — ✅ 확정: (A) 도입하지 않는다

**질문**: 신청 시 결제를 받을 것인가?

**사실**: 현행 흐름에 온라인 결제가 아예 없다(`src:140`). 확인 후 개별 안내다(`src:137`).

**선택지**: (A) 도입하지 않는다 / (B) 신청과 별개의 결제 링크만 안내 / (C) 신청 흐름에 결제 통합(Stripe·Square 등)

**내 추천: (A). 최소 4단계까지 미룬다.**
근거: 결제는 학비 산출(§7.1)이 확정된 뒤에만 가능하고, 도입하는 순간 환불 규정 자동화·정산·분쟁 처리·PCI 준수가 통째로 따라온다. 현재 학원 업무 어디에도 없던 것을 신청서 시스템에 얹으면 1단계가 좌초한다. 필요해지면 Vercel Marketplace의 결제 통합을 별도 Phase로.

### 7.3 기존 `applications` 이관 — ✅ 확정: (B) 1단계 차단 → 3단계 제거

**질문**: 기존 신청 시스템을 어떻게 할 것인가?

**사실**: **원격 D1 실측 `SELECT COUNT(*) FROM applications` = 0건.** 이관할 데이터가 없다.

**선택지**: (A) 읽기 전용으로 영구 병존 / (B) 1단계 차단 → 3단계 완전 제거 / (C) 즉시 제거

**내 추천: (B)**
근거: 0건이므로 지킬 데이터가 없고, 병존은 "신규 신청이 어디로 갔는지 운영자가 헷갈리는" 순수 비용이다. 1단계에서 `active_form_id`가 붙은 수업부터 신규 폼으로 돌리고, 전 프로그램에 폼이 붙는 3단계에 테이블·API·UI·메뉴 키를 제거한다. (C)는 아직 폼이 안 붙은 수업의 신청 경로가 잠깐 사라지므로 안 된다.
**확인 필요**: 프로덕션 D1이 개발용과 같은 인스턴스가 맞는가? (실측은 현재 연결된 원격 D1 기준이다. 별도 프로덕션 DB가 있다면 거기서 다시 세야 한다.)

### 7.4 형제자매 다중 등록 — ✅ 확정: (A) 현행 유지 (추천안 기각)

**질문**: 한 가족이 자녀 2명을 신청할 때 어떻게 하는가?

**사실**: 현행 구글폼은 학생 1명 기준이고 형제는 폼을 다시 낸다(`src:210`). 응답 1행 = 학생 1명이 명단·배정의 단위다.

**선택지**:
- (A) 현행 유지 — 폼을 두 번 낸다. 로그인 회원은 자녀 셀렉트가 있어 두 번째 제출이 30초.
- (B) 완료 화면에 **"같은 정보로 다른 자녀 신청하기"** 버튼 — 연락처·동의는 유지하고 학생 정보만 비운 채 다시 연다.
- (C) 한 폼에서 학생 N명을 동시에 받는다.

**내 추천이었던 것: (B)** — 완료 화면에 "다른 자녀 신청하기" 버튼.
**확정: (A).** 사용자가 (A)를 선택했다. 응답 1행 = 학생 1명이라는 전제는 (A)에서도 (B)에서도 같으므로 데이터 모델에 영향이 없고, **1단계 구현 범위가 그만큼 줄어든다.** 로그인 회원은 자녀 셀렉트가 있어 두 번째 제출이 짧다. 필요해지면 (B)는 클라이언트 로직 하나라 언제든 나중에 붙일 수 있다.
**여전히 확인하면 좋은 것**(블로커 아님): 형제 할인이 있는가? 있다면 학비표 조회 보조에 반영이 필요하다.

### 7.5 미디어 동의 중복 — ✅ 확정: (B) 프로필이 주인, 신청서는 증빙

**질문**: 신청서 Q13(미디어 동의)과 회원 프로필 `public_archive_consent` 중 무엇이 `/students` 공개 노출의 판정 근거인가?

**사실**: 두 곳에 동의가 생기고 지금은 서로 모른다(`src:208`). 규칙을 정하지 않으면 **거부한 학생 사진이 공개된다.** 동의는 철회 가능해야 한다.

**선택지**:
- (A) 프로필 토글이 항상 승자. 신청서 답은 증빙으로만 보관.
- (B) **신청서 답을 승격 시 프로필에 1회 반영하고, 그 뒤 프로필이 승자.** 거부는 즉시 반영, 동의는 승격 시점에만 반영.
- (C) 신청서 답이 항상 승자(프로필 토글 제거).

**내 추천: (B)**
근거: "현재 상태의 주인은 프로필(가변·철회 가능), 응답의 동의는 그 시점 서명(불변·증빙)"이라는 분리가 법적으로도 UX적으로도 옳다. 거부만 즉시 반영하는 비대칭은 **안전한 쪽으로 실패**하기 위함이다(모르면 안 보여준다). 프로필 화면에 "2026–2027 신청서에서 ○○로 답하셨습니다"를 표시해 어긋남을 눈에 보이게 한다. (C)는 철회 경로가 없어 부적절하다.

### 7.6 비회원 제출 허용 여부 — ✅ 확정: (A) 허용 (폼별 플래그는 유지)

**질문**: 신청서를 로그인 없이 낼 수 있게 할 것인가?

**사실**: 요구 4는 "회원정보가 없으면 함께 받아 가입 유도"라 비회원 제출을 전제한다. 그런데 최종 동의 문안이 "본인(학부모/보호자)"으로 쓰여 있고(`src:127`), 대상 다수가 미성년이다. **비회원 제출은 제출자를 특정할 방법이 이메일 한 줄뿐이고 그 이메일도 검증되지 않는다** — 서명 없는 온라인 동의의 한계이며 이 설계가 해결하지 못한다.

**선택지**:
- (A) 허용 (`requires_login=0`) — 마찰 최소, 동의 증빙 약함
- (B) 금지 (`requires_login=1`) — 증빙 강함, 신규 가족은 가입부터 해야 함
- (C) **폼별로 고른다** — 정규 학기는 로그인 필수, 특강은 비회원 허용

**내 추천: (C), 기본값은 (A)**
근거: `requires_login` 컬럼이 이미 폼별 플래그라 코드 변경이 0이다. 정규 학기 신청은 동의 항목이 5개이고 미디어·환불 등 법적 무게가 있으므로 로그인 필수가 합리적이고, 특강은 마찰을 줄이는 게 낫다. 다만 **첫 해에 로그인을 강제하면 학부모 상당수가 가입 단계에서 이탈**할 위험이 있으므로, 2026–2027 정규 폼도 첫 해는 (A)로 열고 `link_source`로 신뢰 등급을 남기며 관찰하는 것을 권한다.
**이건 학원이 골라야 한다 — 접근성과 동의 효력의 맞바꿈이고, 개발자가 정할 문제가 아니다.**

### 7.7 전화번호·보호자명 수집 — ✅ 확정: (B) 전화 필수 · 보호자명 선택

**질문**: 올해부터 전화번호와 보호자명을 받을 것인가?

**사실**: 원본 폼에 없다(`src:209`). 그런데 실무 연락은 전화로 돈다.

**선택지**: (A) 안 받는다 / (B) 선택 항목으로 받는다 / (C) 필수로 받는다

**내 추천: (B) 전화 필수 · 보호자명 선택**
근거: 이메일만으로는 학기 초 급한 연락(반편성 변경, 준비물 안내)이 안 된다. 필수로 해도 마찰이 거의 없는 필드다. 보호자명은 로그인 회원이면 자동으로 채워지므로 선택으로 충분하다. **문항 추가는 데이터 편집이라 배포가 필요 없다.**

### 7.8 응답 보존기간·파기 — ⏸ 보류 (1단계 차단 요인 아님)

**질문**: 신청 응답, 특히 의료정보(Q5)를 언제까지 보관하는가?

**사실**: 스키마는 `season` 스냅샷으로 학년도 단위 선별 파기가 가능하도록만 준비했다. 정책은 정해진 바 없다.

**선택지**: (A) 정하지 않는다(무기한 보관) / (B) 응답 3년 · 의료 정보는 학년도 종료 후 즉시 파기 / (C) 전부 학년도 종료 후 1년

**내 추천: (B)**
근거: 동의 증빙은 분쟁 가능성 때문에 몇 년 남겨야 하지만, 의료정보는 학년도가 끝나면 목적이 소멸한다. 선별 파기는 이 스키마에서 한 문장이다:
```sql
UPDATE form_responses
   SET answers_json = json_remove(answers_json, '$.q5_medical'), has_medical = 0
 WHERE season = '2026-2027';
```
**단 이건 법률 자문이 아니다.** 미국 소재 학원의 미성년자 의료정보 보관 규정을 확인해야 한다 — 나는 모른다.

### 7.9 slug 정책 (QR 재사용) — ✅ 확정: (A) 연도 slug

**질문**: 매년 새 URL을 쓸 것인가, 같은 URL을 유지할 것인가?

**선택지**:
- (A) 연도 slug (`/f/2027-2028-regular`) — 작년 폼 주소가 살아 있음. **QR을 매년 새로 인쇄**
- (B) 고정 slug (`/f/apply`)를 매년 갈아끼움 — QR 재사용. 작년 폼은 별도 URL로 이동
- (C) 둘 다 — 고정 slug가 현재 열린 폼으로 리다이렉트

**내 추천: (A), 필요하면 나중에 (C)**
근거: QR은 카톡으로 뿌리는 게 주력이고 인쇄물은 부수적이다. 연도 slug면 작년 폼 주소가 그대로 살아 열람·CSV가 안정적이고, 구조가 단순하다. A안이 이걸 위해 template/version 2층 테이블을 세웠는데, **학원이 매년 QR을 새로 인쇄해도 되는지는 아직 아무도 안 물어봤다.** 물어보고 정하는 게 맞다.

### 7.10 teacher의 응답 열람 범위 — ✅ 확정: (A) 1단계 admin 전용 → 2단계 (B)

**질문**: 선생님이 신청 응답을 볼 수 있어야 하는가? 본다면 무엇까지?

**선택지**: (A) 못 본다(admin 전용) / (B) 담당 과목 명단만 / (C) 전체 응답(의료 제외) / (D) 전체

**내 추천: (A)로 시작 → 2단계에 (B)**
근거: fail-closed 원칙이고, 메뉴 추가는 DB 마이그레이션이 필요 없어 나중에 여는 게 싸다. 의료정보와 연락처가 들어 있는 화면이므로 처음부터 넓게 열 이유가 없다.

### 7.11 정원(capacity) 표시 범위 — ✅ 확정: (B) 운영자 화면 표시 + 1년 우선 정렬

**질문**: "북 수량 제한, 1년 등록자 우선, 잔여 선착순"(`src:55`)을 시스템이 어디까지 다루는가?

**선택지**: (A) 아무것도 안 한다 / (B) **운영자 화면에 `7 / 10` 표시 + 1년 우선 정렬만** / (C) 신청 화면에 잔여 수 표시 / (D) 자동 마감 + 대기 승급

**내 추천: (B)**
근거: (B)는 선택지에 `capacity` 숫자 하나 + `COUNT` 쿼리 하나로 거의 공짜이고, 정렬이 배정 규칙 자체다. (C)는 마감 임박 표시가 오히려 혼란을 부르고(취소·환불로 수시로 변한다), (D)는 취소·환불·연락과 얽혀 실수하면 되돌리기 어렵다.

### 7.12 과목 선택지 ↔ 학비표 코스 ↔ 수업(programs) 매핑 🚧 **유일한 남은 블로커**

**질문**: Q7의 과목 선택지 8개를 어떻게 쪼개고, 각각을 학비표의 어느 코스·사이트의 어느 수업에 잇는가?

**왜 지금 답이 필요한가** — 세 가지가 여기에 매달려 있다:

1. **선택지 key는 한 번 정하면 사실상 못 바꾼다.** 첫 제출이 들어오면 `locked_at`이 찍히고 선택지 삭제가 409로 막힌다(§4.5). 응답이 그 key를 가리키고 있기 때문이다.
2. **`options[].programId`가 없으면 수강 배정 승격이 안 된다.** 폼은 정상 작동하는데 명단이 안 나오는 **조용한 실패**가 된다(§4.4의 "운영 준비 상태" 패널이 이걸 눈에 보이게 하지만, 근본 해결은 매핑 확정이다).
3. **`options[].courseCode`가 없으면 D1(학비표 조회 보조)이 성립하지 않는다.**

**확인된 사실**(원본 자료 대조 결과):

| # | 폼 선택지 | 학비표 대응 | 상태 |
|---|---|---|---|
| 1 | 기초 난타반 (12:45~1:15) **1 Drum & 3 Drum** | Kids Drum 1 = $400 / Kids Drum 3 = **$450** | ❓ 한 선택지가 **가격이 다른 두 코스**에 걸친다 |
| 2 | 유년부 무용 (1:25~2:05) | 1 Dance Course $400 | ✅ 명확 |
| 3 | **오고무, 동고** (5 Standing Drum, 2:15~3:00) | 3 Standing Drums(삼고무/동고) $600 / 5 Standing Drums(오고무) **$700** | ❓ 라벨은 둘을 묶었는데 괄호는 5 Standing만 말한다. 두 코스에 걸친다 |
| 4 | 모북의 합주 **K-DRUM Ensemble** (4:10~5:00) | Mega Drum 모듬북 $650 (추정) | ❓ 명시적 대응 없음 |
| 5 | 고급반 무용 (5:15~6:45, 격주) | 1 Dance Course $400 (Advanced Dance) | ✅ 추정이나 표에 "Advanced Dance" 명기 |
| 6 | 일요 성인 기초무용반 | ❓ | ❓ 표에 대응 행 불명 |
| 7 | 일요 성인 난타반 | ❓ | ❓ 표에 대응 행 불명 |
| 8 | 일요 성인 고급반 | ❓ | ❓ 표에 대응 행 불명 |

일요 성인반 3종은 `*2 Dance Courses (Sat + Sun Combination Package)` $580 행과 관계가 있어 보이지만 **확인되지 않았다.**

#### 수업(`programs`) 매핑 초안 — 원격 D1 실측 (2026-08-13)

`program_type='class'` 9건을 실제로 조회한 결과, 폼 선택지 8개와 **거의 1:1로 대응한다.** 원장은 아래 표를 확인만 하면 된다:

| 폼 선택지 | → `programs` | id | 확신도 |
|---|---|---|---|
| 1. 기초 난타반 (1 Drum & 3 Drum) | 유년부 난타 수업 | 12 | 높음 |
| 2. 유년부 무용 | 유년부 한국무용 | 13 | 높음 |
| 3. 오고무, 동고 (5 Standing Drum) | 삼고무 및 오고무 수업( 동고) | 14 | 높음 |
| 4. 모북의 합주 K-DRUM Ensemble | K-드럼 앙상블 | 16 | 높음 |
| 5. 고급반 무용 (5:15~6:45, 격주) | 고급작품무용반 | 17 | **중간** ↓ |
| 6. 일요 성인 기초무용반 | 성인반 기본무용 | 19 | 높음 |
| 7. 일요 성인 난타반 | 성인 전통북춤 클래스 | 20 | 높음 |
| 8. 일요 성인 고급반 | 성인 고급무용반 | 21 | 높음 |
| **(폼에 없음)** | **중고등부 한국무용 작품반** | **15** | 🚨 |

#### 🚨 발견: Q11이 Q7에서 고를 수 없는 수업을 가리킨다

**Q11(칼춤 소품비 $80)은 "중고등부 작품반 신청 학생만 해당"이라고 명시한다**(`src:98`). 그런데 **Q7의 8개 선택지 어디에도 "중고등부 작품반"이 없다.** 사이트에는 별도 수업(`programs.id=15`)으로 존재한다.

즉 현행 구글폼에서는 **중고등부 작품반을 신청할 방법이 없는데 그 반의 소품비 동의만 전원에게 필수로 받고 있다.** 둘 중 하나다:

- (가) "고급반 무용 (Advanced Korean Dance 5:15~6:45, biweekly)"이 실은 중고등부 작품반이다 → 그렇다면 `programs`의 id 15와 id 17 중 어느 쪽이 맞는지 정리가 필요하다
- (나) Q7에 "중고등부 작품반" 선택지가 **누락**됐다 → 새 폼에서 추가해야 한다

**이 답이 Q11의 조건부 노출(`showIf`) 대상을 결정한다.** (나)라면 새 선택지 key를 만들어야 하고, (가)라면 기존 선택지에 붙인다. 답이 없으면 Q11은 지금처럼 전원 필수로 남을 수밖에 없다.

**원장에게 물어야 할 5문항**:

1. 기초 난타반을 **"1 Drum"과 "3 Drum" 두 선택지로 나눌까요?** (가격이 $400 / $450로 다릅니다)
2. "오고무, 동고"를 **"삼고무·동고(3 Standing)"과 "오고무(5 Standing)" 두 선택지로 나눌까요?** ($600 / $700)
3. **일요 성인반 3종은 학비표의 어느 행입니까?** 별도 가격이 있나요, 아니면 "1 Dance Course"로 취급합니까? "Sat + Sun Combination Package $580"은 어떤 조합을 말합니까?
4. **"모북의 합주 K-DRUM Ensemble" = 학비표의 "Mega Drum 모듬북"이 맞습니까?**
5. **"중고등부 작품반"은 Q7에서 어떻게 신청합니까?** "고급반 무용"이 그것입니까, 아니면 선택지가 빠진 것입니까? (위 🚨 항목)

수업(`programs`) 매핑은 위 초안 표로 대부분 해결됐다 — 확신도 '높음' 7건은 그대로 쓰고, 5번(고급반 무용)과 중고등부 작품반만 확인하면 된다.

**진행 방식 제안** — 이 답을 기다리는 동안 1단계가 멈추지는 않는다:
- 매핑이 필요 없는 부분(테이블·API·편집기·공개 폼·응답 관리·CSV)은 **먼저 만들 수 있다.**
- 매핑이 필요한 부분(수강 배정 승격, 학비표 조회 보조, 명단의 정원 표시)은 **선택지 key 확정 이후**에 붙인다.
- 다만 **2026–2027 폼을 실제로 게시하기 전에는 반드시 답이 있어야 한다.** 게시 후에는 선택지를 못 쪼갠다.

---

## 8. 리스크와 완화

### 8.1 심사에서 지적된 치명적 결함 처리 결과

| # | 결함 (지적된 안) | 처리 |
|---|---|---|
| ① | **파생 테이블이 조용히 어긋난다** (C) | **완화**. `answers_json` SSOT + 응답 본체 단일 INSERT + `derived_dirty` 플래그 + **조회 시 자동 재구축**. 운영자에게 "재구축 버튼"을 노출하지 않는다 |
| ② | **`schema_json` 버전별 원문을 보관하지 않아 증빙이 소실된다** (C) | **해소**. `form_schema_versions` 테이블을 1단계 필수로 신설. 게시·편집마다 전문 스냅샷 1행. 응답 상세는 `form_schema_version` 조인으로 **당시 화면을 실제로 재현**한다 |
| ③ | **`rebuildDerived`가 삭제된 program에서 FK 위반으로 실패** (C) | **해소**. 재구축 시 `programId` 목록을 live `programs`와 대조해 없으면 `NULL`로 넣는다. 근거를 함수 주석에 기록 |
| ④ | **ON DELETE CASCADE 체인이 증빙을 파괴** (A) | **해소**. `forms` → `form_schema_versions`/`form_responses`는 **NO ACTION**. 응답이 있는 폼은 DB가 삭제를 거부한다. 응답 하드 삭제 UI도 없다 |
| ⑤ | **장문 약관(description)이 스냅샷되지 않아 문구 수정이 소급 오염** (A) | **해소**. 버전 스냅샷이 `schema_json` 전문(설명·불릿 포함)을 담으므로 라벨만이 아니라 약관 본문이 통째로 보존된다 |
| ⑥ | **`student_user_id` 부재로 학부모를 수업에 배정** (B) | **해소**. `submitted_by_user_id`(제출자)와 `student_user_id`(대상 학생)를 분리하고, **`student_user_id`가 없으면 승격 버튼이 비활성**이다 |
| ⑦ | **`DEFAULT 'submitted'` + 트랜잭션 부재 → 반쪽 신청이 정상으로 보임** (B) | **해소**. 응답 본체가 단일 INSERT라 반쪽이 생기지 않는다. 파생 누락은 `derived_dirty`로 명시되고 자동 복구된다 |
| ⑧ | **`show_when='class:12'` 문자열 DSL의 복제 리매핑** (B) | **해소**. `showIf`가 문항 key·선택지 key를 참조하고 복제는 `schema_json` 통째 복사라 **리매핑 자체가 존재하지 않는다.** 게시 게이트가 존재하지 않는 참조를 차단한다 |
| ⑨ | **미검증 이메일 자동 결합 = 계정 탈취 통로** (A) | **해소**. `link_source`에 `email_match`를 두지 않는다. 기존 계정이면 로그인을 유도하고 **로그인 성공 후에만** 백필(`login_backfill`) |
| ⑩ | **문항 툼스톤·승격 사다리가 문서 규율일 뿐** (C) | **부분 해소**. 툼스톤은 `locked_at` + API 409로 **코드 강제**했다. 승격 사다리 4칸은 `CORE_BINDINGS` 상수 검증으로 반쯤 강제했다(코어 컬럼을 늘리려면 상수+마이그레이션을 같은 커밋에서 고쳐야 함). **완전하지는 않다** |
| ⑪ | **`applications` 실측 없이 이중 운영 비용 지불** (A·B) | **해소**. 실측 0건 확인. 1단계 차단 → 3단계 제거 |
| ⑫ | **D1 100-param 상한이 `IN` 리스트에도 적용** (셋 다 놓침) | **해소**. `lib/d1/chunk.ts`의 `chunkParams(ids, 90)`을 CSV·미제출자 추적·명단 조회에 강제 |
| ⑬ | **`lib/d1/client.ts`가 다문장 결과를 버림** (A·B 놓침) | **해소**. `batchD1()` 신설, 호출부를 파생 INSERT 1곳으로 제한, 롤백 없음을 주석에 명시 |
| ⑭ | **1단계에 승격·대리등록이 없어 첫 학기가 반쪽** (A·C) | **해소**. 둘 다 1단계로 당기고 인라인 가입을 2단계로 밀어 총량 유지 |
| ⑮ | **원장이 스키마 에디터를 다뤄야 한다** (C) | **완화**. 프리셋 + 도메인 표 편집기 5탭 + 운영 준비 상태 패널. 빈 캔버스에서 문항을 조립하는 화면이 존재하지 않는다 |
| ⑯ | **`applications` API의 `isAdmin` 하드코딩** (기존 부채) | **해소**. 신규 API는 전부 `hasMenuAccess`. 기존 것은 3단계 제거 시 함께 사라진다 |

### 8.2 남은 리스크

| 리스크 | 심각도 | 완화 | 상태 |
|---|---|---|---|
| **매핑 지시자 오지정 → 폼은 정상 작동하는데 명단이 안 나온다 (조용한 실패)** | 높음 | 게시 게이트(차단 항목) + 운영 준비 상태 패널(경고 항목). 강제하지는 않는다 — 강제하면 "어떤 신청서든"이라는 전제가 무너진다 | 완화 |
| **부가 질문 슬롯이 비대해져 이 설계가 무너진다** | 높음 | 유형 3종 제한 + "SQL 집계의 1급 시민이 아니다"를 문서와 UI 문구 양쪽에 명시. **부가 질문이 10개를 넘거나 거기에 `bind`가 필요해지면 설계 재검토 신호**로 취급한다 | 완화 |
| **`email_verified` 부재 → 오타 이메일 계정, 같은 원생의 중복 계정** | 중간 | 자동 결합 금지 + 폼 내 가입 전 기존 회원 조회. **근본 해결은 이 설계의 범위 밖** | **미해결** |
| **동의 주체를 식별할 수 없다 (비회원 제출)** | 중간~높음 | `link_source` 신뢰 등급 기록 + `requires_login` 폼별 플래그. **기록은 방어가 아니다** — §7.6에서 학원이 골라야 한다 | **미해결(정책)** |
| **`is_latest` 갱신이 두 문장이라 원자적이지 않다** | 낮음 | 조회 시 그룹 내 `MAX(submitted_at)` 보정 이중 적용. 중복 2건이 보이는 사고보다 낫다는 판단 | 완화 |
| **민감정보가 상세·CSV·푸시·브라우저 캐시로 샌다** | 중간 | 목록·CSV 기본 제외 + 열람 기록 + 푸시 본문 최소화. 1단계에 로그가 있으므로 "샜는지조차 모르는" 상태는 아니다 | 완화 |
| **메일이 여전히 신뢰 불가** | 중간 | 1차 채널을 푸시+인앱으로 옮겼을 뿐 메일 자체는 고쳐지지 않았다. 신청자 확인 메일은 인프라(앱비번·발송 로그·재시도) 정비 후에만 | **미해결(별도 과제)** |
| **편집기 완성도가 R2 실현을 좌우한다** | 중간 | 프리셋으로 시작점을 없애고 표 편집기로 낮췄지만, 그마저 부실하면 결국 개발자가 매년 JSON을 고치게 된다. **1단계 완료 판정에 "원장이 도움 없이 동의문 하나를 고쳐 재게시한다"를 포함할 것** | 완화 |
| **`programs.active_form_id`가 1:N을 강제** | 낮음 | 한 수업에 두 폼(정규+특강)을 동시에 붙여야 하면 다:다 테이블 + 백필이 필요하다. 지금은 근거가 없다 | 수용 |
| **격주(nth-week) 수업 일정을 표현 못 한다** | 낮음(범위 밖) | `lib/programSchedule.ts`가 매주 전개라 "2nd & 4th Sunday"가 캘린더에 잘못 뜬다. 폼은 선택지 라벨로 안내만 한다 | **미해결(별도 과제)** |
| **보존기간·파기 정책 미정** | 중간 | 스키마는 `season`으로 준비만 했다 | **미해결(§7.8)** |

### 8.3 완료 게이트 (1단계)

```
npm run lint:i18n     # ko/en 키 세트·자리표시자·중복 → 0건
npm run lint:theme    # 히어로 등록·테마 토큰 오용 → 0건
npm test              # lib/**/*.test.ts — schema.test.ts, formViews.test.ts 포함
npm run lint          # eslint
```
추가 수동 확인:
- 관리 콘솔 편집기·응답 목록·상세를 **라이트/다크 두 테마로 눈 확인** (`ShareQrCard` 콘솔 첫 투입 포함)
- 공개 폼 `/f/[slug]`을 **라이트/다크 두 테마로 눈 확인**
- **모바일 실기기에서 QR 스캔 → 제출 → 접수번호 확인 1회 왕복**
- **원장 시나리오 1회**: 도움 없이 동의문 한 줄을 고치고 재게시할 수 있는가

`schema.test.ts`가 잠글 불변식:
- `validateSchema()`가 차단 항목 8종을 전부 거부한다
- `applyBindings()`가 코어 컬럼·선택 파생·동의 파생을 정확히 만든다
- `evaluateShowIf()`로 숨겨진 문항이 필수 검증에서 제외된다
- `locked_at` 이후 파괴적 편집이 409를 낸다
- 복제 결과의 `showIf` 참조가 전부 유효하다
- `exclusive` 선택지가 나머지를 해제한다
- 재제출 시 `is_latest` 그룹에 최신본이 하나만 남는다

---

## 부록 A. 신규·수정 파일 목록

**신규**
```
migrations/0035_registration_forms.sql
types/forms.ts
lib/forms/schema.ts            lib/forms/schema.test.ts
lib/forms/presets.ts
lib/forms/tuition.ts
lib/forms/csv.ts
lib/d1/forms.ts                lib/d1/formResponses.ts
lib/d1/formViews.ts            lib/d1/formViews.test.ts
lib/d1/chunk.ts
lib/members/createMember.ts    (2단계, /api/register 에서 추출)
app/f/[slug]/page.tsx          app/f/[slug]/done/page.tsx
app/api/forms/[slug]/submit/route.ts
app/admin/forms/page.tsx
app/admin/forms/new/page.tsx
app/admin/forms/[id]/page.tsx
app/admin/forms/[id]/responses/page.tsx
app/admin/forms/[id]/responses/new/page.tsx
app/admin/forms/[id]/responses/[rid]/page.tsx
app/admin/forms/[id]/roster/page.tsx
app/api/admin/forms/**                        (§4.7)
components/forms/FormRenderer.tsx
components/forms/fields/*.tsx                 (short/long/single/multi/consent/info)
components/admin/forms/FormEditorTabs.tsx
components/admin/forms/ReadinessPanel.tsx
components/admin/forms/OptionTable.tsx
components/admin/forms/ConsentTable.tsx
components/admin/forms/ExtraQuestionTable.tsx
components/admin/forms/ResponseTable.tsx
components/admin/forms/ResponseDetail.tsx
components/admin/forms/MemberLinkPanel.tsx
components/admin/forms/PromotePanel.tsx
components/admin/forms/TuitionHint.tsx
scripts/seedRegistrationForm.mjs
```

**수정**
```
lib/d1/client.ts                    + batchD1()
lib/d1/index.ts                     + forms/formResponses 재수출
lib/push/system.ts                  + notifyStaffOfFormResponse()
types/permissions.ts                MenuKey 에 'forms'
lib/admin/menu-registry.ts          노드 1개 (group 'lesson', programs 다음, defaultRoles ['admin'])
locale/ko.json / locale/en.json     admin.nav.forms + admin.forms.* + forms.*
app/globals.css                     .form-* / .apply-* 최소 블록
app/api/admin/programs/[id]/enrollments/route.ts   role 제한 완화 (선행)
components/admin/programs/EnrollmentManager.tsx    이름 검색 추가
app/admin/programs/[id]/page.tsx    active_form_id 셀렉트
app/classes/[slug]/page.tsx         active_form_id 있으면 /f/{slug}
components/admin/StaffDashboard.tsx 신규 건수 소스 교체
app/admin/page.tsx                  동
```

## 부록 B. 착수 전 체크리스트

**해결됨** (2026-08-13):

- [x] §7.1 학비 범위 — 신청만 + 운영자 화면 조회 보조 (D1)
- [x] §7.5 미디어 동의 우선순위 — 프로필이 주인, 신청서는 증빙 (D3)
- [x] §7.6 비회원 제출 허용 여부 — 허용 (D2)
- [x] §7.7 전화·보호자명 수집 — 전화 필수 · 보호자명 선택 (D4)
- [x] §7.4 형제자매 — 현행 유지 (D5)
- [x] §7.2 온라인 결제 — 도입 안 함 (D6)
- [x] §7.9 slug 정책 — 연도 slug (개발자 판단)
- [x] Q7 8종 ↔ D1 `programs` 대응표 — **원격 D1 실측으로 초안 완성** (§7.12). 9건 중 7건 확신도 높음

**남음**:

- [ ] §7.12 원장 확인 5문항 — **1단계의 유일한 블로커**. 단, 매핑이 필요 없는 부분(테이블·API·편집기·공개 폼·응답 관리·CSV)은 답을 기다리는 동안 먼저 만들 수 있다. **폼을 실제로 게시하기 전에는 반드시 답이 있어야 한다** (게시 후 선택지 쪼개기 불가)
- [ ] Q11(칼 소품비)이 걸리는 정확한 선택지 key — §7.12의 5번 문항에 포함. **현행 폼의 결함이 여기서 드러났다**
- [ ] 프로덕션 D1이 `.env.local`의 인스턴스와 동일한지 확인 — **개발자 확인**. (정황 증거: 실측한 `programs` 9건이 실제 운영 중인 수업 목록과 일치한다. 그래도 `D1_DATABASE_ID`를 Vercel 프로덕션 환경변수와 대조할 것)
- [ ] §7.8 응답 보존기간·파기 정책 — 1단계 차단 요인은 아니나, **미국 소재 학원의 미성년자 의료정보 보관 규정 확인 필요**. 이 문서는 법률 자문이 아니다