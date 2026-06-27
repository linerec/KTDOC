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
- [ ] **Phase 5 — 참여도/검증 뷰**: 이벤트별 참가자 수(운영진·관계자용; `getCheckinCountsByEvent`, 참가자 명단=`getEventCheckins`+이름해석). 학생별 참여 리포트.
- [ ] **Phase 6 — 마무리**: 카피 톤(차분한 합니다체) 점검, 반응형/접근성, 문서, main 병합·배포.

## 열린 결정 (사용자 확인 필요)

1. **연도별 수강생 공개 범위/개인정보**: 실명을 공개 웹에 노출할지, 활동(동의/active) 학생만·예명·이니셜·옵트인 중 무엇으로 할지. 기본은 보수적으로(예: 동의 플래그) 갈지.
2. **체크인 대상**: 공개(published) 이벤트만인지, 운영진이 만든 "참가 예정(upcoming)" 이벤트도 체크인 허용할지(`status='going'`).
3. **공개 라우트 이름**: `/students` vs `/members` vs `/archive`.
4. **검증(관계자) 접근**: 비로그인 공개로 둘지, 별도 링크/권한으로 둘지.

## 비고
- 작업은 **feature 브랜치에서만**. 절반 상태가 운영에 배포되지 않도록 main push 보류(완성·검토 후 병합).
- 단, D1 스키마(0010)는 additive 새 테이블이라 원격 적용해도 무해(미배포 코드가 안 쓰면 그만).
