# 학내 행사(수료식) 게시 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 수료식 같은 학내 행사를 `events`에 종류 축(`kind`) 하나만 추가해 담고, 홈 "최근 발자취" 섹션과 `/timeline`을 통해 예비 학부모에게 광고 아닌 기록으로 노출한다.

**Architecture:** 새 테이블·새 최상위 메뉴·새 관리 화면을 만들지 않는다. `events` 테이블에 `kind TEXT NOT NULL DEFAULT 'performance'` 컬럼을 추가하고, 이 축을 관리자 폼·API·공개 페이지 필터에 관통시킨다. 노출은 이미 존재하는 `/timeline`(발자취)을 정면으로 삼고, 현재 `events`를 전혀 조회하지 않는 홈에 "최근 발자취" 섹션을 신설해 진입로를 만든다.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Cloudflare D1(원격 REST) · Plain CSS(디자인 토큰)

설계 문서: `docs/operations/school-events-design.md`

## Global Constraints

- **테스트 인프라 없음.** 이 프로젝트에는 jest/vitest 등 자동 테스트가 없다(`package.json`에 `test` 스크립트 없음). 각 태스크의 검증 게이트는 **`npx tsc --noEmit` + `npm run lint` + 실제 화면 확인**이다. 테스트 파일을 새로 만들지 말 것.
- **D1은 원격 REST API다.** 로컬 D1 데이터가 없다. 마이그레이션은 `npm run d1:migrate`로 **운영과 공유되는 원격 DB**에 적용된다. 되돌리기 어려우므로 SQL을 먼저 검토할 것.
- **i18n**: 새 UI 텍스트는 서버 컴포넌트 `<IntlObject keycode="..." />`, 클라이언트 컴포넌트 `const t = useT()` → `t('key', '한국어 기본값')`. **항상 fallback을 넘긴다.** `locale/ko.json`·`locale/en.json` **양쪽에 같은 키**를 추가하고, ko 값은 코드 fallback과 동일하게 둔다.
- **관리 콘솔 테마**: 콘솔(`/admin`) CSS는 라이트가 기본이고 다크로 전환된다. `rgba(255,255,255,α)` 직접 사용 금지 — `rgba(var(--fg-rgb), α)`·`var(--surface-2)` 토큰 사용. 금색 텍스트는 `var(--soft-gold-text)`. **콘솔 UI를 만들면 완료 전에 두 테마 모두 확인한다.**
- ~~**공개 사이트는 항상 다크**다. 공개 페이지 CSS에는 테마 분기가 필요 없다.~~
  **(2026-08-07 무효)** 공개 사이트도 한지(라이트) 기본 + 다크 전환이 된다. CLAUDE.md의
  '공개 사이트 테마' 규칙을 따를 것.
- **스타일**: Plain CSS만. Tailwind·framer-motion·shadcn 없음. 전역 스타일은 `app/globals.css`.
- **용어**: 관리 콘솔 문구에서 관리 대상은 "공연"으로 통일돼 있다. 이번 작업으로 "공연 · 행사"가 병기되는 지점만 바꾸고, 코드의 `gallery` 라우트/키는 레거시 그대로 둔다.
- **커밋**: 각 태스크 끝에 1커밋. 브랜치는 `main` 직접(프로젝트 관행). 커밋 전 `git fetch` — 여러 세션이 병렬로 작업해 origin이 앞서 있을 수 있다.

---

## File Structure

| 파일 | 책임 | 태스크 |
|---|---|---|
| `migrations/0032_event_kind.sql` | (신규) `events.kind` 컬럼·인덱스 | 1 |
| `types/gallery.ts` | `EventKind` 타입·라벨 상수, `Event`/`EventFilters`/`CreateEventInput`에 `kind` | 1 |
| `lib/d1/gallery.ts` | `getEvents` kind 필터, `createEvent`/`updateEvent` kind 반영, `getRecentPastEvents` 신설 | 1, 7 |
| `app/api/admin/gallery/events/route.ts` | POST에서 kind 수용, 권한을 isStaff로 | 2 |
| `app/api/admin/gallery/events/[id]/route.ts` | PUT에서 kind 수용, 권한을 isStaff로(DELETE는 admin 유지) | 2 |
| `components/admin/gallery/EventForm.tsx` | 종류 라디오, kind에 따른 쇼케이스 필드 숨김 | 3 |
| `lib/admin/menu-registry.ts` | `gallery` 메뉴 라벨·기본 권한 | 3 |
| `locale/ko.json`·`locale/en.json` | 신규 문구 키 | 3, 5, 6, 7 |
| `app/performances/page.tsx` | `kind: 'performance'` 필터 | 4 |
| `components/timeline/EventTimeline.tsx` | 종류 뱃지 + 종류 필터 토글 | 5 |
| `app/gallery/page.tsx`·`components/gallery/GalleryFilter.tsx` | 종류 필터 | 6 |
| `components/home/RecentJourney.tsx`·`RecentJourneyCard.tsx` | (신규) 홈 "최근 발자취" 섹션 | 7 |
| `app/page.tsx` | 섹션 삽입 | 7 |
| `app/gallery/[year]/[slug]/page.tsx` | 학내 행사 뱃지 + 참여 인원 | 8 |
| `app/globals.css` | 뱃지·필터·홈 섹션 스타일 | 3, 5, 7, 8 |

---

## Task 1: `kind` 축 도입 (D1 스키마 + 타입 + 쿼리)

**Files:**
- Create: `migrations/0032_event_kind.sql`
- Modify: `types/gallery.ts`, `lib/d1/gallery.ts`

**Interfaces:**
- Produces: `EventKind` (`'performance' | 'school'`), `EVENT_KIND_LABELS`, `Event.kind`, `EventFilters.kind`, `CreateEventInput.kind` — 이후 모든 태스크가 이 이름을 쓴다.

- [ ] **Step 1: 마이그레이션 파일 작성**

`migrations/0032_event_kind.sql`:

```sql
-- 0032: 이벤트 종류 축(공연 / 학내 행사)
--
-- events.category_id는 "어떤 공연인가"(경연대회·축제·기업행사…) 축이므로
-- 여기에 '수료식'을 섞지 않는다. kind는 그와 직교하는 별도 축이다.
-- 기존 전 건은 DEFAULT로 'performance'가 되므로 데이터 이관 작업이 없다.

ALTER TABLE events ADD COLUMN kind TEXT NOT NULL DEFAULT 'performance';

CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind);
```

- [ ] **Step 2: 원격 D1에 적용**

Run: `node scripts/d1Migrate.mjs migrations/0032_event_kind.sql`

> 러너는 **파일 경로를 인자로 받는다.** `npm run d1:migrate`만 실행하면 사용법만 출력하고 끝난다.

Expected: 문장 2개가 `OK`. 재실행 시 `ALTER ADD COLUMN`은 `duplicate column name`으로 `SKIP` 처리되어 멱등하다.

> 롤백이 필요하면 `ALTER TABLE events DROP COLUMN kind;` (D1의 SQLite는 DROP COLUMN을 지원한다). 단 원격 운영 DB이므로 실행 전 반드시 확인할 것.

- [ ] **Step 3: 적용 확인**

Run:
```bash
node -e '
const fs=require("fs");
for(const l of fs.readFileSync(".env.local","utf8").split("\n")){
  const m=l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/); if(m&&!(m[1] in process.env)) process.env[m[1]]=m[2].trim().replace(/^["\x27]|["\x27]$/g,"");
}
const{CLOUDFLARE_ACCOUNT_ID:A,CLOUDFLARE_API_TOKEN:T,D1_DATABASE_ID:D}=process.env;
fetch(`https://api.cloudflare.com/client/v4/accounts/${A}/d1/database/${D}/query`,{method:"POST",headers:{Authorization:`Bearer ${T}`,"Content-Type":"application/json"},body:JSON.stringify({sql:"SELECT kind, COUNT(*) n FROM events GROUP BY kind",params:[]})}).then(r=>r.json()).then(b=>console.log(JSON.stringify(b.result[0].results)));
'
```

Expected: `[{"kind":"performance","n":1}]` — 기존 이벤트가 전부 `performance`로 채워졌음을 확인.

- [ ] **Step 4: 타입 추가**

`types/gallery.ts` — `EventCategory` 인터페이스 위(파일 상단 주석 바로 아래)에 추가:

```ts
/**
 * 이벤트 종류 — category_id('어떤 공연인가')와 직교하는 축.
 * 'performance' = 대외 공연, 'school' = 수료식·발표회 등 학내 행사.
 */
export type EventKind = 'performance' | 'school';

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  performance: '공연',
  school: '학내 행사',
};

export const EVENT_KIND_LABELS_EN: Record<EventKind, string> = {
  performance: 'Performance',
  school: 'School Event',
};
```

`Event` 인터페이스에 `category_id` 바로 아래 한 줄 추가:

```ts
  kind: EventKind;
```

`EventFilters` 인터페이스에 `showcase?: boolean;` 아래 추가:

```ts
  /** 종류 필터 — 미지정이거나 'all'이면 전체 */
  kind?: EventKind | 'all';
```

`CreateEventInput` 인터페이스에 `category_id?: number;` 아래 추가:

```ts
  kind?: EventKind;
```

- [ ] **Step 5: `getEvents`에 kind 필터 추가**

`lib/d1/gallery.ts`의 `getEvents` — 구조 분해에 `kind` 추가:

```ts
  const {
    year,
    category,
    search,
    page = 1,
    limit = 20,
    featured,
    published = true,
    showcase,
    kind,
  } = filters;
```

`if (showcase) { ... }` 블록 **바로 아래**에 추가:

```ts
  if (kind && kind !== 'all') {
    conditions.push('e.kind = ?');
    params.push(kind);
  }
```

- [ ] **Step 6: `createEvent`에 kind 반영**

`lib/d1/gallery.ts`의 `createEvent` — INSERT 컬럼 목록의 `category_id,` 뒤에 `kind,`를 넣고 VALUES 자리표시자를 하나 늘린다:

```ts
  const { lastRowId } = await executeD1(
    `INSERT INTO events (
      slug, year, event_date, title_ko, title_en,
      description_ko, description_en, category_id, kind,
      is_published, is_featured, is_signature, signature_order,
      location, location_url, location_address, location_lat, location_lng,
      call_time, start_time, end_time, prep_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
```

파라미터 배열에서 `input.category_id || null,` 바로 다음 줄에 추가:

```ts
      input.kind || 'performance',
```

> 자리표시자 개수가 21 → 22로, 파라미터 개수도 21 → 22로 함께 늘어난다. 저장이 실패하면 이 개수 불일치를 먼저 의심할 것.

- [ ] **Step 7: `updateEvent`에 kind 반영**

`lib/d1/gallery.ts`의 `updateEvent` — `if (input.category_id !== undefined) { ... }` 블록 바로 아래에 추가:

```ts
  if (input.kind !== undefined) {
    updates.push('kind = ?');
    params.push(input.kind);
  }
```

- [ ] **Step 8: 타입체크·린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: 오류 없음. (`Event.kind`를 필수로 만들었으므로 `EventWithCategory`를 손으로 만드는 코드가 있으면 여기서 잡힌다 — 있으면 해당 지점에 `kind: 'performance'`를 채운다.)

- [ ] **Step 9: 커밋**

```bash
git add migrations/0032_event_kind.sql types/gallery.ts lib/d1/gallery.ts
git commit -m "feat(events): 이벤트 종류 축(kind) 컬럼 추가 — 공연/학내 행사 구분"
```

---

## Task 2: API 계층 — kind 수용 + 선생님 권한 개방

**Files:**
- Modify: `app/api/admin/gallery/events/route.ts`, `app/api/admin/gallery/events/[id]/route.ts`

**Interfaces:**
- Consumes: Task 1의 `CreateEventInput.kind`, `UpdateEventInput.kind`, `EventKind`
- Produces: POST·PUT가 `kind`를 저장한다. `isStaff` 기준으로 teacher가 공연·행사를 생성·수정할 수 있다.

> **배경:** 메뉴 권한(`/admin/permissions`)만 열어도 API가 `isAdmin`으로 막혀 있으면 선생님은 저장할 수 없다. 두 곳을 함께 열어야 한다. **삭제(DELETE)는 admin 전용을 유지한다** — 되돌릴 수 없는 작업이다.

- [ ] **Step 1: POST 라우트 — 권한을 isStaff로**

`app/api/admin/gallery/events/route.ts` 상단 import 수정:

```ts
import { isAdmin, isStaff } from '@/lib/isAdmin';
```

`POST` 핸들러의 권한 체크를 교체:

```ts
    const session = await auth();
    if (!isStaff(session)) {
      return NextResponse.json(
        { success: false, error: '운영진 권한이 필요합니다.' },
        { status: 403 }
      );
    }
```

같은 파일의 `GET`(관리자용 목록, 비공개 포함)도 `isStaff`로 바꾼다 — 선생님이 목록을 못 보면 편집 진입 자체가 안 된다.

> `isAdmin` import를 남겨두면 lint의 unused 규칙에 걸린다. 이 파일에서 `isAdmin`을 더 쓰지 않으면 import에서 뺄 것.

- [ ] **Step 2: POST 라우트 — kind 수용**

같은 파일에서 body 구조 분해에 `kind`를 추가한다(`category_id` 다음):

```ts
    const { title_ko, event_date, title_en, category_id, kind, description_ko, description_en, is_published, is_featured, is_signature, signature_order, slug, location, location_url, location_address, location_lat, location_lng, call_time, start_time, end_time, prep_notes } = body;
```

날짜 형식 검증 블록 **아래**에 종류 검증을 추가:

```ts
    if (kind !== undefined && kind !== 'performance' && kind !== 'school') {
      return NextResponse.json(
        { success: false, error: '행사 종류 값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }
```

`const input: CreateEventInput = {` 안, `category_id,` 다음 줄에 추가:

```ts
      kind: kind ?? 'performance',
```

- [ ] **Step 3: PUT 라우트 — 권한과 kind**

`app/api/admin/gallery/events/[id]/route.ts`:

1. `PUT` 핸들러의 권한 체크를 `isStaff`로 교체(문구도 `'운영진 권한이 필요합니다.'`). import에 `isStaff`를 추가한다.
2. `DELETE` 핸들러는 **`isAdmin` 그대로 둔다.**
3. body → input 매핑에서 `if (body.category_id !== undefined) input.category_id = body.category_id;` 아래에 추가:

```ts
    if (body.kind !== undefined) input.kind = body.kind;
```

4. 날짜 형식 검증 블록 아래에 종류 검증 추가:

```ts
    if (input.kind !== undefined && input.kind !== 'performance' && input.kind !== 'school') {
      return NextResponse.json(
        { success: false, error: '행사 종류 값이 올바르지 않습니다.' },
        { status: 400 }
      );
    }
```

- [ ] **Step 4: 이미지·영상 하위 라우트 권한 확인**

Run: `grep -rn "isAdmin" app/api/admin/gallery/`

선생님이 행사를 만들면 **사진을 올릴 수 있어야 의미가 있다.** 다음 라우트가 `isAdmin`이면 `isStaff`로 바꾼다:
- `app/api/admin/gallery/events/[id]/images/route.ts` (사진 업로드)
- `app/api/admin/gallery/events/[id]/videos/route.ts` (영상 추가)

**바꾸지 않는 것**: `app/api/admin/gallery/photos/bulk/route.ts`(일괄 삭제 포함), 각 라우트의 `DELETE` 핸들러 — admin 전용 유지.

- [ ] **Step 5: 타입체크·린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: 오류 없음

- [ ] **Step 6: 커밋**

```bash
git add app/api/admin/gallery/
git commit -m "feat(api): 공연 API에 kind 수용 + 생성·수정 권한을 운영진(teacher)으로 개방"
```

---

## Task 3: 관리자 폼 — 종류 선택 UI

**Files:**
- Modify: `components/admin/gallery/EventForm.tsx`, `lib/admin/menu-registry.ts`, `locale/ko.json`, `locale/en.json`, `app/globals.css`

**Interfaces:**
- Consumes: Task 1의 `EventKind`, Task 2의 API
- Produces: 새 공연 기본값 `performance`. `kind === 'school'`이면 쇼케이스 필드가 숨겨진다.

- [ ] **Step 1: 폼 상태에 kind 추가**

`components/admin/gallery/EventForm.tsx` — import에 타입 추가:

```ts
import type {
  EventDetail,
  EventCategory,
  CreateEventInput,
  UpdateEventInput,
  ExtractedEventInfo,
  EventKind,
} from '@/types/gallery';
```

`useState`의 `formData` 초기값에서 `category_id` 다음 줄에 추가:

```ts
    kind: (event?.kind || 'performance') as EventKind,
```

- [ ] **Step 2: 저장 페이로드에 kind 추가**

같은 파일 `handleSubmit`의 `const body: CreateEventInput | UpdateEventInput = {` 안, `category_id:` 다음 줄에 추가:

```ts
        kind: formData.kind,
```

같은 객체에서 `is_signature`와 `signature_order`를 **학내 행사일 때 강제로 끈다** — 숨긴 필드에 이전 값이 남아 있을 수 있다:

```ts
        is_signature: formData.kind === 'school' ? false : formData.is_signature,
        signature_order: formData.kind === 'school' ? 0 : Number(formData.signature_order) || 0,
```

- [ ] **Step 3: 종류 라디오 UI 추가**

`<h3 className="admin-form-section-title">공연 기본 정보</h3>`와 그 아래 `<p className="admin-form-help">` 다음, **제목 입력 필드 앞**에 삽입:

```tsx
          <div className="admin-form-group">
            <span className="admin-form-label">종류</span>
            <div className="event-kind-radios" role="radiogroup" aria-label="행사 종류">
              <label className="event-kind-radio">
                <input
                  type="radio"
                  name="kind"
                  value="performance"
                  checked={formData.kind === 'performance'}
                  onChange={handleChange}
                />
                <span>공연</span>
              </label>
              <label className="event-kind-radio">
                <input
                  type="radio"
                  name="kind"
                  value="school"
                  checked={formData.kind === 'school'}
                  onChange={handleChange}
                />
                <span>학내 행사</span>
              </label>
            </div>
            <p className="admin-form-help">
              수료식·발표회처럼 학원에서 여는 행사는 &lsquo;학내 행사&rsquo;를 선택하세요.
              공개 사이트의 공연 페이지에는 표시되지 않고, 발자취·갤러리에 기록으로 남습니다.
            </p>
          </div>
```

> `handleChange`는 `type === 'checkbox'`가 아니면 `value`를 그대로 저장하므로 라디오에 그대로 쓸 수 있다. 별도 핸들러가 필요 없다.

- [ ] **Step 4: 학내 행사일 때 쇼케이스 필드 숨기기**

같은 파일에서 `is_signature` 체크박스와 `signature_order` 입력을 감싸는 `<div className="admin-form-row">` 전체를 조건부로 만든다:

```tsx
          {formData.kind !== 'school' && (
            <div className="admin-form-row">
              {/* 기존 is_signature 체크박스 + signature_order 입력 그대로 */}
            </div>
          )}
```

- [ ] **Step 5: 라디오 스타일 추가 (두 테마 대응)**

`app/globals.css` 하단(관리 콘솔 관련 스타일 근처)에 추가:

```css
/* 공연/학내 행사 종류 선택 라디오 (관리 콘솔) */
.event-kind-radios {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.4rem;
}

.event-kind-radio {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.5rem 0.9rem;
  border: 1px solid rgba(var(--fg-rgb), 0.18);
  border-radius: 999px;
  background: var(--surface-2);
  cursor: pointer;
  font-size: 0.92rem;
  transition: border-color 0.18s ease, background 0.18s ease;
}

.event-kind-radio:hover {
  border-color: rgba(var(--fg-rgb), 0.35);
}

.event-kind-radio:has(input:checked) {
  border-color: var(--accent-color);
  background: rgba(var(--fg-rgb), 0.06);
}

.event-kind-radio:has(input:focus-visible) {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}
```

- [ ] **Step 6: 메뉴 라벨 변경**

`lib/admin/menu-registry.ts` — `gallery` 노드의 `label`을 바꾼다:

```ts
  { key: 'gallery', href: '/admin/gallery', label: '공연 · 행사 관리', iconKey: 'gallery', group: 'show', defaultRoles: ['teacher', 'admin'] },
```

`defaultRoles`에 `'teacher'`를 추가하는 것도 함께 한다(DB에 행이 없을 때의 폴백). 하위 메뉴 `gallery.photos`는 `['admin']` 그대로 둔다 — 사진 보관함의 일괄 작업은 admin 전용이다.

- [ ] **Step 7: locale 키 갱신**

`locale/ko.json`의 `"admin.nav.gallery"` 값을 `"공연 · 행사 관리"`로,
`locale/en.json`의 같은 키를 `"Performances & Events"`로 바꾼다.

- [ ] **Step 8: 타입체크·린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: 오류 없음

- [ ] **Step 9: 두 테마에서 화면 확인**

Run: `npm run dev`

1. `/admin/gallery/new` 접속
2. 종류 라디오가 제목 필드 위에 보이고, 기본값이 "공연"인지 확인
3. "학내 행사"를 선택하면 쇼케이스 체크박스·순서 입력이 사라지는지 확인
4. **상단바 테마 토글로 라이트·다크를 전환하며** 라디오의 선택 상태 대비가 두 테마에서 모두 읽히는지 확인
5. 학내 행사로 저장한 뒤 `/admin/gallery` 목록에 나타나는지 확인

- [ ] **Step 10: 커밋**

```bash
git add components/admin/gallery/EventForm.tsx lib/admin/menu-registry.ts locale/ko.json locale/en.json app/globals.css
git commit -m "feat(admin): 공연 폼에 종류(공연/학내 행사) 선택 + 메뉴를 '공연 · 행사 관리'로"
```

---

## Task 4: `/performances`에서 학내 행사 제외

**Files:**
- Modify: `app/performances/page.tsx`

**Interfaces:**
- Consumes: Task 1의 `EventFilters.kind`

> 학내 행사는 `is_signature`가 꺼져 있어 이미 쇼케이스에 안 뜨지만, **폴백 경로**(대표 공연 미지정 시 최근 공개 12건)로 새어 들어온다. 쿼리에서 막는다.

- [ ] **Step 1: 두 쿼리에 kind 필터 추가**

`app/performances/page.tsx`의 `PerformancesPage`:

```ts
export default async function PerformancesPage() {
  // 큐레이션된 대표 공연 우선, 없으면 최근 공개 공연으로 폴백
  // 학내 행사(kind='school')는 레퍼토리가 아니므로 두 경로 모두에서 제외한다
  const showcase = await getEvents({ showcase: true, published: true, limit: 50, kind: 'performance' });
  const curated = showcase.events.length > 0;
  let events = showcase.events;
  if (!curated) {
    const fallback = await getEvents({ published: true, limit: 12, kind: 'performance' });
    events = fallback.events;
  }
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 오류 없음

- [ ] **Step 3: 화면 확인**

Task 3에서 만든 학내 행사가 공개 상태인 채로 `/performances`에 **나타나지 않는지** 확인한다. (대표 공연이 지정돼 있지 않다면 폴백 그리드에 뜨지 않아야 한다.)

- [ ] **Step 4: 커밋**

```bash
git add app/performances/page.tsx
git commit -m "fix(performances): 레퍼토리에서 학내 행사 제외"
```

---

## Task 5: `/timeline` 종류 뱃지 + 필터

**Files:**
- Modify: `components/timeline/EventTimeline.tsx`, `locale/ko.json`, `locale/en.json`, `app/globals.css`

**Interfaces:**
- Consumes: Task 1의 `EventKind`, `Event.kind`

- [ ] **Step 1: 카드에 종류 뱃지 추가**

`components/timeline/EventTimeline.tsx`의 `TimelineEventCard` — 메타 영역의 카테고리 뱃지 **앞**에 종류 뱃지를 넣는다. 학내 행사일 때만 표시한다(공연이 대다수라 전부에 붙이면 소음이 된다):

```tsx
        <div className="timeline-event-card-meta">
          <span className="timeline-event-card-date">
            {formatEventDateIntl(event.event_date, locale)}
          </span>
          {event.kind === 'school' && (
            <span className="timeline-event-card-kind">
              {messages['timeline.kind.school'] || '학내 행사'}
            </span>
          )}
          {categoryName && (
            <span className="timeline-event-card-category">{categoryName}</span>
          )}
        </div>
```

- [ ] **Step 2: 종류 필터 상태 추가**

같은 파일의 `EventTimeline` 컴포넌트 — `sortOrder` state 아래에 추가:

```tsx
  // 종류 필터: all = 전체(기본), performance = 공연, school = 학내 행사
  const [kindFilter, setKindFilter] = useState<'all' | 'performance' | 'school'>('all');

  const visibleEvents = useMemo(
    () => (kindFilter === 'all' ? events : events.filter((e) => e.kind === kindFilter)),
    [events, kindFilter]
  );
```

그리고 **연도 그룹핑(`yearGroups`)이 `events` 대신 `visibleEvents`를 쓰도록** 바꾼다. `useMemo` 의존성 배열의 `events`도 `visibleEvents`로 교체한다.

> 필터가 걸려도 기존 "기록 없음" 빈 상태(`pages.timeline.empty`)가 그대로 동작한다.

- [ ] **Step 3: 필터 토글 UI 추가**

정렬 토글이 있는 컨트롤 영역에 같은 패턴으로 나란히 추가한다:

```tsx
        <div className="timeline-filter" role="group" aria-label={messages['timeline.kind.label'] || '종류'}>
          {(['all', 'performance', 'school'] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={`timeline-filter-btn${kindFilter === k ? ' is-active' : ''}`}
              aria-pressed={kindFilter === k}
              onClick={() => setKindFilter(k)}
            >
              {k === 'all'
                ? messages['timeline.kind.all'] || '전체'
                : k === 'performance'
                  ? messages['timeline.kind.performance'] || '공연'
                  : messages['timeline.kind.school'] || '학내 행사'}
            </button>
          ))}
        </div>
```

- [ ] **Step 4: locale 키 추가**

`locale/ko.json`에 `pages.timeline.sort.desc` 근처에 추가:

```json
  "timeline.kind.label": "종류",
  "timeline.kind.all": "전체",
  "timeline.kind.performance": "공연",
  "timeline.kind.school": "학내 행사",
```

`locale/en.json`의 같은 위치에:

```json
  "timeline.kind.label": "Type",
  "timeline.kind.all": "All",
  "timeline.kind.performance": "Performances",
  "timeline.kind.school": "School Events",
```

- [ ] **Step 5: 스타일 추가**

`app/globals.css`의 `.timeline-*` 블록에 추가:

```css
.timeline-event-card-kind {
  display: inline-block;
  padding: 0.16rem 0.55rem;
  border: 1px solid rgba(212, 160, 23, 0.45);
  border-radius: 999px;
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  color: var(--accent-color);
  white-space: nowrap;
}

.timeline-filter {
  display: inline-flex;
  gap: 0.3rem;
  padding: 0.25rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
}

.timeline-filter-btn {
  padding: 0.35rem 0.85rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 255, 255, 0.65);
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}

.timeline-filter-btn:hover {
  color: rgba(255, 255, 255, 0.9);
}

.timeline-filter-btn.is-active {
  background: rgba(212, 160, 23, 0.18);
  color: var(--accent-color);
}
```

> ~~공개 사이트는 항상 다크이므로 여기서는 리터럴 흰색을 써도 된다(콘솔 규칙과 다르다).~~
> **(2026-08-07 무효)** 공개 사이트에도 테마가 생겼다 — 리터럴 흰색 대신
> `rgba(var(--fg-rgb), α)`를 쓸 것. 사진 위라 리터럴이 정답이면 theme-exempt 주석을 달 것.

- [ ] **Step 6: 타입체크·린트·화면 확인**

Run: `npx tsc --noEmit && npm run lint`

`/timeline`에서:
- 학내 행사 카드에 금색 "학내 행사" 뱃지가 보이는지
- 필터를 "공연"으로 바꾸면 학내 행사가 사라지고, "학내 행사"로 바꾸면 그것만 남는지
- 정렬 토글과 함께 써도 깨지지 않는지

- [ ] **Step 7: 커밋**

```bash
git add components/timeline/EventTimeline.tsx locale/ko.json locale/en.json app/globals.css
git commit -m "feat(timeline): 학내 행사 뱃지 + 종류 필터"
```

---

## Task 6: `/gallery` 종류 필터

**Files:**
- Modify: `app/gallery/page.tsx`, `components/gallery/GalleryFilter.tsx`, `locale/ko.json`, `locale/en.json`

**Interfaces:**
- Consumes: Task 1의 `EventFilters.kind`, Task 5에서 추가한 `timeline.kind.*` 키를 재사용한다(중복 키를 새로 만들지 않는다).

- [ ] **Step 1: 페이지에서 kind 쿼리 파라미터 처리**

`app/gallery/page.tsx`:

1. `PageProps`의 `searchParams` 타입에 `kind?: string;` 추가
2. `GalleryContent`의 props에 `kind?: string` 추가
3. `shouldShowPhotoStream` 조건에 kind를 포함 — 필터가 걸리면 사진 스트림을 숨기는 기존 규칙과 일치시킨다:

```ts
  const shouldShowPhotoStream = !year && !category && !search && !kind;
```

4. `getEvents` 호출에 추가:

```ts
      kind: kind === 'performance' || kind === 'school' ? kind : undefined,
```

5. `<GalleryContent ... />` 호출에 `kind={params.kind}` 추가

- [ ] **Step 2: 필터 UI에 종류 셀렉트 추가**

`components/gallery/GalleryFilter.tsx` — `currentCategory` 아래에 상태를 읽고:

```ts
  const currentKind = searchParams.get('kind') || '';
```

`hasActiveFilters`에 포함:

```ts
  const hasActiveFilters = currentYear || currentCategory || currentSearch || currentKind;
```

카테고리 필터 그룹(`{/* Category Filter */}` 블록) **바로 다음**, 검색 입력 앞에 삽입한다. 마크업은 기존 연도·카테고리 그룹과 동일한 구조다:

```tsx
        {/* Kind Filter */}
        <div className="gallery-filter-group">
          <IntlObject keycode="gallery.filter.kind" returnType="label" className="gallery-filter-label" />
          <select
            id="kind-filter"
            className="gallery-filter-select"
            value={currentKind}
            onChange={(e) => updateFilters('kind', e.target.value)}
          >
            <option value="">{messages['common.all'] || 'All'}</option>
            <option value="performance">{messages['timeline.kind.performance'] || '공연'}</option>
            <option value="school">{messages['timeline.kind.school'] || '학내 행사'}</option>
          </select>
        </div>
```

> 빈 값 라벨은 기존 셀렉트와 똑같이 `messages['common.all']`을 쓴다(연도·카테고리와 표현을 맞춘다).

- [ ] **Step 3: 필터 라벨 locale 키 추가**

`locale/ko.json` — `"gallery.filter.category"` 옆에:

```json
  "gallery.filter.kind": "종류",
```

`locale/en.json` — 같은 자리에:

```json
  "gallery.filter.kind": "Type",
```

- [ ] **Step 4: 타입체크·린트·화면 확인**

Run: `npx tsc --noEmit && npm run lint`

`/gallery`에서 종류 셀렉트가 보이고, "학내 행사" 선택 시 URL이 `?kind=school`이 되며 해당 이벤트만 남는지 확인. "필터 초기화"가 kind도 지우는지 확인(`clearFilters`는 `/gallery`로 이동하므로 자동으로 지워진다).

- [ ] **Step 5: 커밋**

```bash
git add app/gallery/page.tsx components/gallery/GalleryFilter.tsx locale/ko.json locale/en.json
git commit -m "feat(gallery): 종류(공연/학내 행사) 필터 추가"
```

---

## Task 7: 홈 "최근 발자취" 섹션 (핵심)

**Files:**
- Create: `components/home/RecentJourney.tsx`
- Modify: `lib/d1/gallery.ts`, `app/page.tsx`, `locale/ko.json`, `locale/en.json`, `app/globals.css`

**Interfaces:**
- Consumes: Task 1의 `EventKind`, `EventWithCategory`
- Produces: `getRecentPastEvents(limit: number): Promise<EventWithCategory[]>`

> 현재 홈은 `events`를 한 건도 조회하지 않는다. 이 섹션이 사이트의 축적된 활동과 홈을 잇는 유일한 다리다. **광고가 아니라 기록**이라는 톤을 지킬 것 — 홍보 카피·CTA 버튼·"신청하세요" 류 문구를 넣지 않는다.

- [ ] **Step 1: 쿼리 함수 추가**

`lib/d1/gallery.ts`의 `getEvents` 아래(`getEventsOnDate` 앞)에 추가:

```ts
/**
 * 홈 "최근 발자취" — 이미 지난 공개 행사 최근 N건.
 * 예정된 행사를 섞으면 '발자취'라는 이름과 어긋나므로 오늘 이전만 가져온다.
 * (date('now')는 UTC 기준 — 당일 경계에서 하루 차이가 날 수 있으나 발자취 목록에서는 무해하다)
 */
export async function getRecentPastEvents(limit = 3): Promise<EventWithCategory[]> {
  return queryD1<EventWithCategory>(
    `SELECT e.*,
            c.name_ko AS category_name_ko,
            c.name_en AS category_name_en,
            c.slug AS category_slug,
            (SELECT image_url FROM event_images WHERE event_id = e.id ORDER BY sort_order ASC LIMIT 1) AS first_image_url
     FROM events e
     LEFT JOIN event_categories c ON e.category_id = c.id
     WHERE e.is_published = 1 AND e.event_date <= date('now')
     ORDER BY e.event_date DESC, e.id DESC
     LIMIT ?`,
    [limit]
  );
}
```

`lib/d1/index.ts`는 `export { ... } from './gallery';` 형태의 이름 나열이다. `getEventsOnDate` 아래(약 35행)에 한 줄 추가한다:

```ts
  getRecentPastEvents,
```

이 재수출을 빠뜨리면 `@/lib/d1`에서 import할 때 타입 오류가 난다.

- [ ] **Step 2: 섹션 컴포넌트 생성**

`components/home/RecentJourney.tsx` (신규):

```tsx
/**
 * RecentJourney — 홈 "최근 발자취"
 *
 * 지난 공개 행사 3건을 시간순으로 보여주고 타임라인으로 잇는다.
 * 광고가 아니라 기록이다: 홍보 카피·CTA 없이 날짜·종류·제목만 둔다.
 * 표시할 기록이 없으면 섹션 자체를 렌더하지 않는다.
 */

import Link from 'next/link';
import { getRecentPastEvents } from '@/lib/d1';
import IntlObject from '@/components/common/IntlObject';
import ScrollReveal from '@/components/common/ScrollReveal';
import RecentJourneyCard from './RecentJourneyCard';

export default async function RecentJourney() {
  const events = await getRecentPastEvents(3);
  if (events.length === 0) return null;

  return (
    <section className="journey-section" aria-labelledby="journey-title">
      <div className="container">
        <div className="journey-head">
          <IntlObject keycode="home.journey.eyebrow" className="journey-eyebrow" />
          <h2 id="journey-title" className="journey-title">
            <IntlObject keycode="home.journey.title" />
          </h2>
        </div>

        <div className="journey-grid">
          {events.map((event, i) => (
            <RecentJourneyCard key={event.id} event={event} index={i} />
          ))}
        </div>

        <Link href="/timeline" className="journey-more">
          <IntlObject keycode="home.journey.more" />
          <span aria-hidden="true"> →</span>
        </Link>
      </div>

      {/* .reveal 요소를 관찰하는 옵저버 — 형제로 한 번 배치한다 */}
      <ScrollReveal />
    </section>
  );
}
```

> **확인된 사항:** `IntlObject`의 props는 `keycode`·`returnType`·`className`뿐이며 **`id`를 받지 않는다.** 그래서 `<h2 id=...>`로 직접 감싸고 안에 `IntlObject`를 넣는다 — `components/Mission.tsx:26-28`이 쓰는 것과 같은 패턴이다.

- [ ] **Step 3: 카드 컴포넌트 생성**

카드는 로케일에 따라 제목이 바뀌므로 클라이언트 컴포넌트다.
`components/home/RecentJourneyCard.tsx` (신규):

```tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { EventWithCategory } from '@/types/gallery';
import { formatEventDateIntl } from '@/types/gallery';
import { useLanguage } from '@/contexts/LanguageContext';

export default function RecentJourneyCard({
  event,
  index,
}: {
  event: EventWithCategory;
  index: number;
}) {
  const { locale, messages } = useLanguage();
  const title = locale === 'ko' ? event.title_ko : event.title_en || event.title_ko;
  const imageUrl = event.thumbnail_url || event.poster_url || event.first_image_url;
  const kindLabel =
    event.kind === 'school'
      ? messages['timeline.kind.school'] || '학내 행사'
      : messages['timeline.kind.performance'] || '공연';

  return (
    <Link
      href={`/gallery/${event.year}/${event.slug}`}
      className="journey-card reveal reveal--up"
      style={{ '--reveal-delay': `${index * 80}ms` } as React.CSSProperties}
    >
      <div className="journey-card-image">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="journey-card-img"
          />
        ) : (
          <div className="journey-card-placeholder" aria-hidden="true" />
        )}
      </div>
      <div className="journey-card-body">
        <div className="journey-card-meta">
          <span className="journey-card-date">
            {formatEventDateIntl(event.event_date, locale)}
          </span>
          <span className="journey-card-kind">{kindLabel}</span>
        </div>
        <h3 className="journey-card-title">{title}</h3>
      </div>
    </Link>
  );
}
```

> Task 5에서 추가한 `timeline.kind.*` 키를 재사용한다. 카드에는 공연·학내 행사 **양쪽 다** 라벨을 붙인다 — 홈에서는 둘이 섞여 있어 구분이 정보가 된다(타임라인에서는 학내 행사만 붙였다).

- [ ] **Step 4: `ScrollReveal` 배치 확인**

**확인된 패턴:** `ScrollReveal`은 자식을 감싸는 래퍼가 아니라, `.reveal` 클래스를 가진 요소들과 **형제로 한 번 렌더하는 옵저버 컴포넌트**다 (`components/timeline/EventTimeline.tsx:178`, `components/media/NewsList.tsx:93`). Step 2의 코드가 이미 이 형태를 따르고 있으므로 그대로 두면 된다.

주의: 옵저버는 마운트 시점의 `.reveal` 요소만 관찰한다. 이 섹션은 카드가 동적으로 늘지 않으므로 문제없다.

- [ ] **Step 5: 홈에 섹션 삽입**

`app/page.tsx`:

```tsx
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import Mission from '@/components/Mission';
import RecentJourney from '@/components/home/RecentJourney';
import Categories from '@/components/Categories';
import Traditional from '@/components/Traditional';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Mission />
        <RecentJourney />
        <Categories />
        <Traditional />
      </main>
      <Footer />
    </>
  );
}
```

> `RecentJourney`가 async 서버 컴포넌트이므로 `Home`은 그대로 두어도 된다(자식이 알아서 await한다).

- [ ] **Step 6: locale 키 추가**

`locale/ko.json`:

```json
  "home.journey.eyebrow": "발자취",
  "home.journey.title": "최근의 기록",
  "home.journey.more": "타임라인 전체 보기",
```

`locale/en.json`:

```json
  "home.journey.eyebrow": "OUR JOURNEY",
  "home.journey.title": "Recent Records",
  "home.journey.more": "View the full timeline",
```

- [ ] **Step 7: 스타일 추가**

`app/globals.css`에 추가(홈 섹션 스타일 근처):

```css
/* 홈 — 최근 발자취 */
.journey-section {
  padding: clamp(3.5rem, 8vw, 6rem) 0;
}

.journey-head {
  margin-bottom: clamp(1.5rem, 4vw, 2.5rem);
}

.journey-eyebrow {
  display: block;
  font-size: 0.8rem;
  letter-spacing: 0.18em;
  color: var(--accent-color);
  margin-bottom: 0.6rem;
}

.journey-title {
  font-family: var(--font-serif, 'Noto Serif KR', serif);
  font-size: clamp(1.6rem, 4vw, 2.4rem);
  font-weight: 400;
}

.journey-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: clamp(1rem, 2.5vw, 1.75rem);
}

.journey-card {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  transition: border-color 0.25s ease, transform 0.25s ease;
}

.journey-card:hover {
  border-color: rgba(212, 160, 23, 0.5);
  transform: translateY(-3px);
}

.journey-card-image {
  position: relative;
  aspect-ratio: 4 / 3;
  background: rgba(255, 255, 255, 0.04);
}

.journey-card-img {
  object-fit: cover;
}

.journey-card-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
}

.journey-card-body {
  padding: 1rem 1.1rem 1.25rem;
}

.journey-card-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}

.journey-card-date {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.6);
}

.journey-card-kind {
  padding: 0.14rem 0.5rem;
  border: 1px solid rgba(212, 160, 23, 0.4);
  border-radius: 999px;
  font-size: 0.7rem;
  color: var(--accent-color);
  white-space: nowrap;
}

.journey-card-title {
  font-size: 1.05rem;
  font-weight: 400;
  line-height: 1.45;
}

.journey-more {
  display: inline-block;
  margin-top: clamp(1.25rem, 3vw, 2rem);
  color: rgba(255, 255, 255, 0.75);
  text-decoration: none;
  font-size: 0.92rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.25);
  padding-bottom: 0.2rem;
  transition: color 0.2s ease, border-color 0.2s ease;
}

.journey-more:hover {
  color: var(--accent-color);
  border-color: var(--accent-color);
}

@media (max-width: 900px) {
  .journey-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 8: 타입체크·린트**

Run: `npx tsc --noEmit && npm run lint`
Expected: 오류 없음

- [ ] **Step 9: 화면 확인**

Run: `npm run dev` → `http://localhost:3000`

- Mission 아래에 "최근 발자취" 섹션이 보이는지
- 카드가 최대 3장이고, 날짜가 최신순인지
- **예정된(미래 날짜) 행사가 섞이지 않는지**
- 카드에 종류 라벨(공연/학내 행사)이 붙는지
- "타임라인 전체 보기"가 `/timeline`으로 가는지
- 모바일 폭(≤900px)에서 1열로 떨어지는지
- 스크롤 시 등장 애니메이션이 동작하는지

빈 상태 확인: 공개 이벤트가 0건이 되도록 임시로 `getRecentPastEvents`의 WHERE에 `AND 0`를 붙여 섹션이 통째로 사라지는지 본 뒤 **되돌린다.**

- [ ] **Step 10: 커밋**

```bash
git add components/home/ app/page.tsx lib/d1/gallery.ts lib/d1/index.ts locale/ko.json locale/en.json app/globals.css
git commit -m "feat(home): '최근 발자취' 섹션 — 지난 공연·행사 3건을 타임라인으로 잇기"
```

---

## Task 8: 학내 행사 상세에 참여 인원 표시

**Files:**
- Modify: `app/gallery/[year]/[slug]/page.tsx`, `locale/ko.json`, `locale/en.json`, `app/globals.css`

**Interfaces:**
- Consumes: 기존 `getCheckinCountsByEvent(eventIds: number[]): Promise<Map<number, number>>` (`lib/d1/checkins.ts:140`), Task 1의 `Event.kind`

> **설계 근거(설계 문서 6장):** 수료증이라는 사실은 카피가 아니라 기록으로 전달한다. 아이들 이름·얼굴 대신 **참여 인원 숫자**만 노출하면 개인정보 위험 없이 "실제로 이만큼의 아이들이 과정을 마쳤다"는 증거가 된다.

- [ ] **Step 1: 상세 페이지에서 참여 인원 조회**

`app/gallery/[year]/[slug]/page.tsx` — import에 추가:

```ts
import { getCheckinCountsByEvent } from '@/lib/d1';
```

캘린더 링크를 만드는 부분 근처(`const calLinks = ...` 아래)에 추가:

```ts
  // 학내 행사에 한해 참여 인원을 집계한다 — 이름은 노출하지 않는다(미성년자 개인정보).
  let participantCount = 0;
  if (event.kind === 'school') {
    const counts = await getCheckinCountsByEvent([event.id]);
    participantCount = counts.get(event.id) ?? 0;
  }
```

`getCheckinCountsByEvent`가 `@/lib/d1` 배럴에서 재수출되는지 확인한다
(Run: `grep -n "getCheckinCountsByEvent" lib/d1/index.ts`). 없으면 배럴에 추가한다.

- [ ] **Step 2: 메타 영역에 표시**

같은 파일의 `gallery-detail-meta` 블록에 카테고리 뱃지 다음으로 추가:

```tsx
          <div className="gallery-detail-meta">
            <span className="gallery-detail-year">{event.year}</span>
            {event.kind === 'school' && (
              <span className="gallery-detail-kind">학내 행사</span>
            )}
            {event.category && (
              <span className="gallery-detail-category">
                {event.category.name_ko}
              </span>
            )}
          </div>
```

날짜(`gallery-detail-date`) 아래에 인원을 넣는다. **0명이면 렌더하지 않는다** — 체크인을 아직 안 붙인 행사에 "참여 0명"이 뜨면 오히려 역효과다:

```tsx
          {event.kind === 'school' && participantCount > 0 && (
            <p className="gallery-detail-participants">
              참여 {participantCount}명
            </p>
          )}
```

> 이 페이지는 메타 영역을 한국어로 고정해 렌더하고 있다(`event.category.name_ko`를 직접 쓴다). 위 문구도 같은 방식으로 한국어 고정이며, 페이지 전체의 다국어화는 별도 작업이다.

- [ ] **Step 3: 스타일 추가**

`app/globals.css`의 `.gallery-detail-*` 블록에 추가:

```css
.gallery-detail-kind {
  padding: 0.2rem 0.6rem;
  border: 1px solid rgba(212, 160, 23, 0.45);
  border-radius: 999px;
  font-size: 0.78rem;
  color: var(--accent-color);
}

.gallery-detail-participants {
  margin-top: 0.35rem;
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.7);
}
```

- [ ] **Step 4: 타입체크·린트·화면 확인**

Run: `npx tsc --noEmit && npm run lint`

학내 행사 상세에서:
- "학내 행사" 뱃지가 연도 옆에 보이는지
- 체크인이 없으면 인원 줄이 **아예 안 나오는지**
- 체크인을 1건 붙이면 "참여 1명"이 뜨는지
- 공연(`kind='performance'`) 상세에는 둘 다 안 보이는지

- [ ] **Step 5: 커밋**

```bash
git add app/gallery/\[year\]/\[slug\]/page.tsx app/globals.css
git commit -m "feat(gallery): 학내 행사 상세에 종류 뱃지와 참여 인원 표시"
```

---

## Task 9: 마무리 — 권한 개방과 문서

**Files:**
- Modify: `docs/operations/school-events-design.md`

- [ ] **Step 1: 선생님 메뉴 권한 개방(운영 작업)**

관리자 계정으로 `/admin/permissions` 접속 → `gallery`(공연 · 행사 관리) 행의 **teacher** 체크 → 저장.

> Task 3에서 `defaultRoles`에 teacher를 넣었지만, **DB `menu_permissions`에 이미 행이 있으면 그 값이 우선**한다(`lib/admin/permissions.ts`의 판정 순서: admin 무조건 → requireRole → DB 행 → defaultRoles). 기존 시드에 gallery 행이 있으므로 화면에서 직접 켜야 한다.

- [ ] **Step 2: teacher 계정으로 실제 확인**

`teacher.test@ktdoc.org` / `Test1234!` 로 로그인해서:
- 사이드바에 "공연 · 행사 관리"가 보이는지
- 새 행사를 만들고 **저장이 되는지**(API 권한이 열렸는지 — 여기서 403이 나면 Task 2가 덜 된 것)
- 사진 업로드가 되는지
- 기본이 비공개(`is_published=0`)로 저장되는지

- [ ] **Step 3: 설계 문서 상태 갱신**

`docs/operations/school-events-design.md`의 헤더를 `상태: 구현 완료 (2026-XX-XX)`로 바꾸고, 실제 구현이 설계와 달라진 부분이 있으면 그 절을 수정한다.

- [ ] **Step 4: 전체 검증**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: 빌드 성공

- [ ] **Step 5: 커밋**

```bash
git add docs/operations/school-events-design.md
git commit -m "docs: 학내 행사 설계 문서 구현 완료로 갱신"
```

---

## 실제 콘텐츠 등록 (구현 후 운영 작업)

코드가 아니라 원장·선생님이 하는 일이다. 순서만 남긴다.

1. `/admin/gallery/new` → 종류 **학내 행사** → 제목 `2025–2026 수료식`, 날짜 `2026-07-25`, 장소 입력
2. 설명은 사실만: `"2025–2026 과정을 마친 원생들에게 수료증을 수여했습니다."`
3. 사진 업로드 — **얼굴이 크게 식별되는 개인 사진은 보류**, 단체·현장 사진 위주
4. 참여한 원생을 체크인으로 연결(`/admin/participation` 또는 `/admin/library/[id]`)
5. 행사 Q&A 1~2문항 등록(`/admin/faq`, 이 행사 선택)
6. 검토 후 **공개** 전환 → 홈 "최근 발자취" 맨 앞에 자동으로 올라온다
