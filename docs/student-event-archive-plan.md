# 학생 이벤트 아카이브 · 참여 체크인 — 구현 계획

> 브랜치: `feature/student-event-archive`
> 목표: 수강생이 참가한/참가할 이벤트에 **체크인/체크아웃**하고, 그 데이터로 **본인 아카이브**(참여 이벤트+사진)를 보며, 웹사이트에 **연도별 수강생** 페이지를 두어 학생 본인·관계 기관이 **참여도**를 확인할 수 있게 한다.

## 데이터 모델 (확정)

- **체크인 저장소 = D1** (이벤트와 동일 store). 테이블 `event_checkins`
  (`event_id` INT → events, `user_id` TEXT = MySQL `users.id` UUID, `status`, `note`, `checked_in_at`; `UNIQUE(event_id,user_id)`).
  체크아웃 = 행 삭제. 교차 저장소라 FK 없음. 회원 이름은 `getUserNamesByIds`(MySQL)로 해석 — `gallery_photos.uploaded_by`와 동일 패턴.
- 마이그레이션: `migrations/0010_event_checkins.sql` (D1). 적용: `npm run d1:migrate migrations/0010_event_checkins.sql`.
- 데이터 계층: `lib/d1/checkins.ts` (checkInEvent/checkOutEvent/isCheckedIn/getUserCheckedInEventIds/getUserCheckins/getEventCheckins/getCheckinCountsByEvent/getCheckinCountsByUser). 타입: `types/gallery.ts`(EventCheckin, CheckedInEvent, CheckinStatus).

## 단계

- [x] **Phase 1 — 기반**: 마이그레이션 0010(원격 적용 완료)·타입·데이터 계층·index 연결. tsc·라이브 D1 왕복 검증 완료.
- [x] **Phase 2 — 체크인 UI(학생 콘솔)**: `/admin/library` 둘러보기 카드에 체크인/체크아웃 토글(`CheckinButton`, 학생 role에만 노출). API `/api/library/checkins`(GET 내 체크인 id·POST 체크인·DELETE 체크아웃, 본인·공개 이벤트만 서버 강제). 초기 상태는 `getUserCheckedInEventIds`로 서버 렌더. 카드 구조 `.library-card > .library-card-link + CheckinButton`. **Playwright로 체크인→영속(새로고침)→체크아웃 검증 완료.**
- [x] **Phase 3 — 학생 아카이브**: `/admin/library/archive`(메뉴 `library.archive`). `getUserCheckins` + `getPreviewImagesForEvents`(이벤트당 상위 3장, 윈도우 함수 단일 쿼리). 연도별 묶음 + 참여 요약(총 N개·활동 연도). 빈 상태→둘러보기 유도. **Playwright 검증 완료**(빈 상태/채워진 상태/사이드바 메뉴).
- [x] **Phase 4 — 연도별 수강생 공개 페이지**: `/students`(공개, 서버 컴포넌트 + Header/Footer). `getActiveStudents`(MySQL, active 원생, 이름·입학년도만) + `getCheckinCountsByUser`(D1). 입학년도 내림차순 그룹, 학생 칩에 "참여 N회" 배지, 상단 통계(수강생 수·연도 수·누적 참여). **Playwright 검증 완료**(그룹·배지·통계). ⚠️ **개인정보**: 보수적(이름+연도+참여수, PII 없음)으로 빌드함. 실명 공개 가부는 **병합 전 사용자 확정**. **남은 것: 헤더 내비 링크 미연결**(i18n keycode 필요 → Phase 6).
- [x] **Phase 5 — 참여도/검증 뷰**: 운영진 페이지 `/admin/participation`(메뉴 `participation`, teacher·admin). `getEventsWithParticipantCounts`(참가 있는 이벤트+수) + `getCheckinsForEvents`(명단) + `getUserNamesByIds`(이름, MySQL). 이벤트 카드(참가자 수·비공개 배지·참가자 칩) + 요약(이벤트 수·연인원). **Playwright 검증 완료**(선생님 계정, 이름 해석 OK).
- [ ] **Phase 6 — 마무리(사용자 결정 대기)**: ① 공개 `/students` 헤더 내비 링크(i18n keycode 필요) ② **실명 공개 정책 확정**(아래) ③ 체크인 대상 범위(공개 이벤트만 vs 예정 포함) ④ **main 병합·배포 승인**. Phase 1–5는 브랜치에서 완성·검증됨(미배포). 결정 후 진행.

## 결정/진행 로그

1. ✅ **공개 범위 = 동의(opt-in)** (사용자 결정 2026-06-27). 구현: `users.public_archive_consent`(migration 0011, MySQL, 기본 0). 학생이 **내 프로필**에서 토글 → `/students`는 `getActiveStudents`가 `consent=1`만 노출. 해제 시 즉시 제외. Playwright 검증 완료. 부수: `profile` 메뉴를 student·parent도 접근하도록 확장(레지스트리 default + menu_permissions의 profile/student·parent=1 갱신).
2. ✅ **체크인 대상 = 공개·비공개 모두** (사용자 결정 2026-06-27). 학생은 비공개(미공개) 이벤트에도 체크인 가능. 둘러보기는 학생에게 전체 이벤트 노출(`published:'all'`), 비공개 카드는 "비공개" 배지+공개 상세 링크 비활성. 그 외 역할은 공개 전용. API는 존재만 검증. Playwright 검증 완료(학생 비공개 체크인 OK, 학부모는 비공개 미노출).
3. ✅ **공개 라우트** = `/students`.
4. ⏳ **관계자 접근**: `/students`는 비로그인 공개. 이벤트별 참가 명단(`/admin/participation`)은 운영진 전용 — 외부 공유 방식은 미정.

## 정제 (refinements)

- 둘러보기에서 **체크인한 이벤트 강조**: 금색 테두리 + 썸네일 "✓ 참여함" 플래그(`.library-card.is-checked`). 학생 전용.
- **모아보기**: 둘러보기에 "✓ 체크인한 것만(n)" 필터(`?mine=1`) + "내 참여 아카이브 →" 링크. 풍부한 모아보기는 기존 `/admin/library/archive`(사진 포함).
- **콘솔 이벤트 상세** `/admin/library/[id]` (읽기 전용): 둘러보기·아카이브 카드 클릭 시 콘솔 안에서 열림. **비공개 이벤트도 열람 가능**(공개 `/gallery` 상세는 404라). 설명·사진(ImageGallery 재사용)·영상(VideoList 재사용)·체크인 토글. 학생 카드는 이 상세로, 그 외 역할은 공개 `/gallery` 상세로 연결.

## 멤버 앱 로드맵 (2026-06-27 방향 전환)

목표: "지난 공연 아카이브"가 아니라 **멤버가 다가오는 이벤트 참여를 관리하는 능동형 앱**.

- [x] **A. 이벤트 상세 참가자 명단** — `/admin/library/[id]`에 체크인 인원 수·이름 표시(`getEventCheckins`+`getUserNamesByIds`).
- [x] **B. 이벤트 실행 정보** — events에 `location/location_url/call_time/start_time/end_time/prep_notes`(D1 migration 0012). EventForm 입력 + 상세 표시(장소+지도링크·시간·준비물). create/update API·lib 반영.
- [x] **C. 참여 예정(RSVP) 맥락** — `event_date>=today`면 "다가오는 이벤트". 라벨 분기(참여 신청/✓참여 예정 vs 참여 체크인/✓참여함). CheckinButton `upcoming` prop. 둘러보기 카드에 "다가오는" 플래그.
- [x] **D. 캘린더** — `/admin/library/calendar`(메뉴 `library.calendar`). 월별 격자, 날짜별 이벤트 칩, 내 참여=금색, 비공개=점선, 오늘 강조, 월 네비(?month=YYYY-MM), 범례. 커스텀(외부 라이브러리 없음).
- [x] **E. 다가오는 우선(둘러보기)** — 학생 둘러보기를 [응답 필요 콜아웃] + [📅 다가오는 이벤트(오름차순, 체크인)] + [연도별 지난 이벤트]로 재구성. 카드 렌더 헬퍼화. 필터바에 📅 캘린더 링크. (mineOnly·비학생은 기존 동작.) Playwright 검증 완료.
- [ ] **F. 학부모 자녀 대행 체크인** (student_guardians 활용).
- [ ] **G. 멤버 톤(ADMIN→마이페이지) · H. 알림/리마인더 · I. 모바일/PWA**.

브랜치: `feature/event-info-rsvp` (A+B+C). migration 0012는 원격 D1 적용 완료(additive).

## 비고
- 작업은 **feature 브랜치에서만**. 절반 상태가 운영에 배포되지 않도록 main push 보류(완성·검토 후 병합).
- 단, D1 스키마(0010)는 additive 새 테이블이라 원격 적용해도 무해(미배포 코드가 안 쓰면 그만).
