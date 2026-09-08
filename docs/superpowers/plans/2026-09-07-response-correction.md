# 수강신청 과목 정정 — 구현 계획

> 실행 방식: 이 세션에서 인라인 실행(설계·코드 관례를 이미 쥐고 있는 쪽이 한다). 각 작업은 시험이 있는 순수 로직 → 서버 → 화면 순서.

**Goal:** 운영진이 응답 상세 한 자리에서 과목을 정정하면 답·배정·안내·이력이 함께 처리되고, 신청자 재제출도 같은 부품으로 합류한다.

**Spec:** `docs/superpowers/specs/2026-09-07-response-correction-design.md`

## 전역 제약
- 관리 콘솔 문구는 한국어 합니다체, 차분한 톤. 메일은 한/영 병기(`bilingual`).
- 신청자에게 학비를 보이지 않는다.
- D1에 트랜잭션 없음 → 모든 단계는 멱등, 실패는 단계명을 돌려준다.
- 순수 로직은 `node --test`가 도는 상대 경로 import(`../../types/forms.ts`).
- 관리 콘솔 CSS는 토큰(`var(--surface-2)`, `rgba(var(--fg-rgb),α)`)만. 두 테마 확인.

## 파일 지도
| 파일 | 책임 |
|---|---|
| `migrations/0044_response_correction.sql` | `program_enrollments.source_response_id`, `form_response_notes.payload_json` |
| `scripts/backfillEnrollmentSource.mjs` | note `신청서 접수 #N` → source_response_id |
| `lib/forms/correction.ts` (+test) | 순수: 과목 답 교체·검증, diff, 배정 계획, 요약 문장 |
| `lib/forms/correctionRun.ts` | 서버 오케스트레이션: 배정 맞추기·정정 적용·예고 (D1/메일/푸시 호출) |
| `lib/d1/formResponses.ts` | answers 갱신+파생 재구축, supersedes, payload 있는 이력, 정정 이력 조회, 줄기 배정 조회 |
| `lib/d1/enrollments.ts` | source_response_id 저장·조회 |
| `lib/mail/events.ts`, `templates/index.ts` | `form.corrected`, `enrollment.changed` |
| `lib/push/system.ts` | `notifyFamilyOfClassChange` (앱 알림함+푸시) |
| API `…/[rid]/correct`, `…/[rid]/reconcile`, `promote`(리팩터), `route.ts`(취소 시 회수) | |
| `app/api/forms/[slug]/submit`, `app/api/admin/forms/[id]/responses` | supersedes 채우기·재제출 diff 메일 |
| `components/admin/forms/CorrectionModal.tsx` | 정정 모달 |
| `components/admin/forms/ResponseActions.tsx` | 버튼·예고 카드·어긋남 |
| 상세·목록·명단·내 신청 내역·`/f/[slug]`·`EnrollmentManager` | 표시 |
| `app/admin/forms/guide/page.tsx` | 선생님 가이드 |

## 작업
1. 마이그레이션·타입·D1 헬퍼·백필 — 원격 적용은 사용자 확인 뒤(`npm run d1:migrate`).
2. `lib/forms/correction.ts` + 시험(배타·diff·계획: 줄기 밖 불변, 자기 취소 되살림, 시작 전/후, 미연결, 회원 재연결).
3. 메일 이벤트·문안·앱 알림.
4. `correctionRun.ts` + API 4개 + promote 리팩터 + 취소 회수.
5. 재제출 합류(supersedes·diff 메일·안내 띠).
6. 화면.
7. 가이드 페이지·CLAUDE.md·`npm test`·`lint:theme`·`tsc`·두 테마 확인.
