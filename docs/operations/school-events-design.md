# 학내 행사(수료식 등) 게시 설계

작성일: 2026-07-27 · 상태: 설계 확정, 구현 대기

## 1. 배경

2026년 7월 25일, 춤누리에서 2025–2026 클래스 수료식을 열었다. 아이들에게 상장과
수료증(Certification)을 수여하고 사진을 남겼다. 이런 학내 행사는 앞으로 매년
반복될 예정이다.

이 기록에는 두 개의 얼굴이 있다.

- **원생 쪽**: 아이들의 발자취. 내가 무엇을 했고 무엇을 마쳤는지의 기록.
- **예비 학부모 쪽**: "이 학원은 과정을 끝까지 운영하고 수료증까지 준다"는 증거.

두 번째 목적을 광고로 처리하면 안 된다. 홈에 "수료증을 드립니다!" 배너를 붙이는
순간 신뢰도가 떨어진다. **주장은 의심받고 기록은 믿어진다.** 따라서 형식은
어디까지나 원생의 아카이브이고, 설득력은 기록의 밀도에서 나오게 한다.

## 2. 설계 원칙

1. **새 개념을 만들지 않는다.** 새 테이블 0개, 새 최상위 메뉴 0개, 새 관리 화면 0개.
   `events`는 이미 날짜·장소·지도·시간·준비물·사진·영상·FAQ·체크인·캘린더·알림·RSVP를
   전부 갖고 있다. 학내 행사에 필요한 것은 그 부분집합이다.
2. **구분은 명시적으로.** "이건 공연, 이건 학내 행사"가 데이터에 남아야 한다.
   운영자가 나중에 헷갈리지 않고, 페이지마다 다르게 취급할 수 있어야 한다.
3. **노출은 기존 서사에 얹는다.** `/timeline`이 이미 '발자취'다. 새 페이지를 만드는
   대신 이미 있는 발자취를 사람들이 도달할 수 있는 곳까지 끌어올린다.
4. **선생님이 3분 안에 올릴 수 있어야 한다.**

## 3. 데이터 모델

### 3.1 `events.kind` 컬럼 추가 (D1)

```sql
-- migrations/0032_event_kind.sql
ALTER TABLE events ADD COLUMN kind TEXT NOT NULL DEFAULT 'performance';
CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind);
```

- 값은 **`'performance'` | `'school'`** 두 개로 시작한다.
- 기존 전 건은 `DEFAULT 'performance'`로 자동 정리되므로 데이터 이관 작업이 없다.
- D1은 원격 REST API이므로 `npm run d1:migrate`로 원격에 적용한다.

### 3.2 왜 `event_categories`에 한 줄 추가하지 않는가

`event_categories`(경연대회·축제·기업행사·문화행사·기타)는 **"어떤 공연인가"** 를
묻는 축이다. 여기에 '수료식'을 넣으면:

- 갤러리 필터에 `경연대회 · 축제 · 기업행사 · 수료식`이 나란히 뜬다 — 층위가 어긋난다.
- `/performances`의 레퍼토리 그리드가 `category_slug`로 그룹핑하므로
  (`app/performances/page.tsx`) 언젠가 레퍼토리에 수료식 섹션이 생긴다.

`kind`와 `category_id`는 **직교하는 두 축**이다. 학내 행사는 `category_id`를 비워둔다.

### 3.3 왜 `'school'` 하나로 시작하는가

수료식·발표회·워크샵·야유회를 지금 나누면 대부분 비어 있는 분류만 남는다.
실제로 종류가 3개 이상 쌓이고 그때 구분이 필요하면 그때 값을 추가한다. 값 추가는
`CHECK` 제약이 없으므로 마이그레이션 없이 가능하다.

### 3.4 타입·필터

```ts
// types/gallery.ts
export type EventKind = 'performance' | 'school';

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  performance: '공연',
  school: '학내 행사',
};

// Event 인터페이스에 추가
kind: EventKind;

// EventFilters에 추가
kind?: EventKind | 'all';   // 미지정 = 전체
```

```ts
// lib/d1/gallery.ts — getEvents()의 조건 절에 추가
if (kind && kind !== 'all') {
  conditions.push('e.kind = ?');
  params.push(kind);
}
```

## 4. 관리 흐름 (`/admin/gallery`)

### 4.1 EventForm

- 폼 **최상단**에 종류 선택(라디오 2개: 공연 / 학내 행사). 신규 기본값 `performance`.
- `kind === 'school'`이면 **쇼케이스 관련 필드를 숨긴다** (`is_signature`,
  `signature_order`). 학내 행사는 레퍼토리가 아니다.
- 나머지 필드는 전부 동일하게 쓴다. AI 포스터 자동채움·사진 업로드·알림 발송
  체크박스는 그대로 재사용한다.

### 4.2 권한 — 선생님 개방

현재 `gallery` 메뉴는 admin 전용이다(`lib/admin/menu-registry.ts`). 선생님이
아무것도 올릴 수 없으므로 **`/admin/permissions`에서 `gallery`를 teacher에 개방**한다.
마이그레이션 불필요, 즉시 반영.

안전장치는 이미 구조에 있다 — `is_published` 기본값이 0이므로 선생님은 초안까지
만들고 공개는 admin이 판단한다.

### 4.3 라벨

- 메뉴 라벨: `공연 관리` → `공연 · 행사 관리` (`menu-registry.ts`의 `label`)
- 번역 키 `admin.nav.gallery`를 `locale/ko.json`·`locale/en.json` 양쪽에 갱신
  (ko는 코드 폴백과 동일하게, en은 `Performances & Events`)

## 5. 공개 노출

### 5.1 홈 "최근 발자취" 섹션 (신설 — 이번 작업의 핵심)

현재 홈은 `events`를 한 건도 조회하지 않는다(`app/page.tsx`). 2010년부터 쌓인
활동 기록이 전부 홈 밖에 있다. 이것이 가장 큰 공백이다.

- 위치: `Mission` 다음, `Categories` 앞
- 내용: **이미 지난 행사 최근 3건**. `is_published = 1` AND `event_date <= date('now')`,
  `event_date DESC`. 큐레이션 없음(운영 부담 0)
  - 지난 행사만 넣는 이유: 섹션 이름이 '발자취'다. 예정된 공연이 섞이면 의미가
    흐려지고, 날짜가 지나도 자동으로 남으므로 관리가 필요 없다. 다가오는 일정
    노출은 별개 관심사이며 이번 범위 밖이다(`/calendar`·타임라인이 담당)
- **공연과 학내 행사를 섞는다.** 섞여야 "계속 뭔가를 하고 있다"가 읽힌다
- 카드 구성: 종류 뱃지(`공연`/`학내 행사`) + 날짜 + 제목 + 커버 이미지.
  설명 문구·CTA·홍보 카피 없음
- 섹션 하단에 "타임라인 전체 보기 →" 한 줄
- **이벤트가 0건이면 섹션 자체를 렌더하지 않는다**
- 서버 컴포넌트. 제목 등 고정 텍스트는 `<IntlObject>`

### 5.2 `/timeline`

- 각 카드에 종류 뱃지 추가
- 상단에 `전체 / 공연 / 학내 행사` 필터 토글

### 5.3 `/gallery`

- 기존 카테고리 필터 옆에 종류 필터 추가 (쿼리 파라미터 `kind`)

### 5.4 `/performances`

- `kind = 'school'`을 **명시적으로 제외**한다. `is_signature`로 이미 걸러지지만,
  쿼리에서 막아야 나중에 실수로 섞이지 않는다.

## 6. 수료증(Certification)을 증거로 만드는 법

카피가 아니라 기록으로 처리한다.

1. **사실 서술**: 이벤트 설명에 `"2025–2026 과정을 마친 원생들에게 수료증을
   수여했습니다."` 수준의 서술. 형용사 없음.
2. **참여 인원**: 참가자를 체크인(`event_checkins`)으로 연결하면
   `/admin/participation`·`/admin/archive`·`/students`에 자동 반영된다.
   공개 상세에는 **이름 없이 "수료 N명"** 숫자만 노출한다.
3. **행사 FAQ**: `faq_items.event_id`가 이벤트별 Q&A를 이미 지원한다
   (`migrations/0029_faq.sql`). *"수료증은 어떤 기준으로 주나요?"* 같은 1~2문항.

## 7. 공짜로 따라오는 기능 (추가 개발 없음)

| 기능 | 근거 |
|---|---|
| 사진·영상 첨부 | `event_images`, `event_videos` |
| 참여자 체크인 → 학생별 아카이브 | `event_checkins` → `/admin/archive`, `/students` |
| 행사별 Q&A | `faq_items.event_id` |
| 지도·집합시간·준비물 | `location_*`, `call_time`, `prep_notes` |
| 캘린더 구독 자동 반영 | `lib/calendar.ts` → `/calendar.ics` |
| 푸시 알림 발송 | `EventForm`의 알림 섹션 |
| **참석 회람(카톡 대체)** | `/rsvp/[id]` |

마지막 항목이 특히 크다. 수료식처럼 참석 조사가 필요한 행사에 회람 페이지가
그대로 붙는다.

## 8. 프로젝트 규약 준수

- **i18n**: 새 UI 텍스트는 서버 컴포넌트 `<IntlObject>` / 클라이언트 `useT()`.
  항상 fallback을 넘기고, `locale/ko.json`·`locale/en.json` 키 세트를 맞춘다.
- **관리 콘솔 테마**: EventForm에 추가하는 라디오는 라이트·다크 두 테마에서
  대비를 확인한다. `rgba(255,255,255,α)` 직접 사용 금지 —
  `rgba(var(--fg-rgb), α)` 계열 토큰 사용.
- **페이지 레이아웃**: 홈 섹션은 첫 섹션이 아니므로 상단 오프셋을 건드리지 않는다.
- **스크롤 리빌**: 홈 신설 섹션은 기존 `ScrollReveal` 패턴을 재사용한다.

## 9. 범위 밖 (YAGNI)

- `programs` ↔ `events` 연결 (수료식을 특정 학년도 수업에 링크) — 필요성이
  실제로 확인되면 별도 작업
- `/community` 활용 — 목적이 다르고, 죽은 메뉴를 되살리는 비용이 더 크다
- 학내 행사 전용 목록 페이지
- 수료증 PDF 발급·다운로드
- `kind` 값 세분화

## 10. 리스크

| 리스크 | 대응 |
|---|---|
| 미성년자 얼굴·이름 공개 | 얼굴이 크게 식별되는 개인 사진은 `public_archive_consent` 확인 전까지 비공개. 공개 상세에는 인원 수만 |
| 홈 섹션에 부적절한 이벤트 노출 | 노출 원치 않으면 `is_published = 0`으로 관리 (별도 플래그 없음) |
| 홈이 D1 조회로 느려짐 | Hero가 이미 외부 API를 부르므로 동적 렌더. 3건 조회는 무시할 수준 |
| 선생님 권한 개방 후 오게시 | `is_published` 기본 0 — 공개는 admin |

## 11. 검증

- `npx tsc --noEmit` · `npm run lint` 통과
- 마이그레이션 후 기존 이벤트가 전부 `kind='performance'`인지 확인
- `/performances`에 학내 행사가 뜨지 않는지 확인
- `/timeline`·`/gallery` 필터가 종류별로 정확히 거르는지 확인
- 홈에 이벤트 0건일 때 섹션이 사라지는지 확인
- 관리 콘솔 라이트·다크 양쪽에서 EventForm 확인
