# 공개 사이트 라이트/다크 테마 전환 — 설계

- 날짜: 2026-08-07
- 기준 커밋: `5966a4a`
- 난제 작업 대장: [docs/operations/public-theme-hardcases.md](../../operations/public-theme-hardcases.md) (80건)

## 무엇을 만드는가

지금 공개 사이트는 **항상 다크**다(먹빛 `#0a0a0a` + 흰 글자 + 금색 포인트). 관리 콘솔(`/admin`)만
라이트(기본)/다크 전환이 된다. 이 작업은 **공개 사이트에도 같은 전환을 붙이고, 기본값을 라이트로** 만든다.

라이트는 흰 페이지가 아니라 **한지(韓紙)**다. 사이트 정체성인 "먹빛 + 금색 + 아이보리"를
`墨 ↔ 韓紙`의 반전으로 번역한다 — 같은 세계를 뒤집은 것이지 다른 사이트가 아니다.

## 확정된 결정

| 결정 | 값 | 근거 |
|---|---|---|
| 라이트의 성격 | 한지 라이트 (순백 아님) | 전통무용 정체성 보존. 관리 콘솔 라이트와 같은 계열이라 제품 전체가 한 몸 |
| 팔레트 | **관리 콘솔 팔레트 재사용** (`globals.css:15941~`) | 이미 대비 검증됨. 팔레트 정의가 한 곳으로 묶여 두 번 관리할 일이 없어짐 |
| 사진·영상 구역 | **라이트에서도 어두운 캔버스 유지** | 운영자가 사진을 직접 올린다 — 무엇이 올라와도 대비가 깨지지 않음. 난제 80건 중 21건이 이 결정만으로 소멸 |
| 기본값 | **무조건 라이트** (`site-theme === 'dark'`일 때만 다크) | 요청 사항. 기기 `prefers-color-scheme`은 무시(콘솔과 동일 정책) |
| 선호 저장 | 공개 `site-theme` / 콘솔 `admin-theme` **별도** | 기존 콘솔 동작 무손상. 두 화면의 성격이 다름(감상용 vs 업무용) |
| 금색 장식 | 같은 금색, **라이트에서 알파 상향**(.28 → .50) | 얇은 금선은 밝은 바탕에서 사라진다. 색을 바꾸면 금 배경 칩과 어긋남 |
| 1차 범위 | 공개 22개 라우트 + `(auth)` 3화면 + 관리자 편집 모드 UI | "전부 다 바꿔야" 요청 기준 |

## 규모 (실측)

| 항목 | 값 |
|---|---|
| `app/globals.css` | 16,353줄. 공개/공용 범위 **약 9,440줄(58%)**, 12개 구간에 분산 |
| 검토 대상 색 선언 | 약 690건 |
| └ 손댈 것 | **약 450건** (그중 기계적 치환 가능 **약 330건**) |
| └ 무변경 유지 | 금 배경·보더 ~150건, 사진 위 리터럴 ~90건 |
| 난제 (개별 판단 필요) | **80건** — 대장 문서 참조 |
| 공개 CSS의 채널 토큰 사용률 | 187건 중 **14건** — 사실상 미도입 상태 |
| TSX 하드코딩 색 | **6개 파일**뿐 (색이 CSS 한 곳에 모여 있는 것이 이 작업의 최대 행운) |
| 새로 만들 에셋 | **1건** (`dancheong.png` 소프트 알파 재추출) |
| 추정 | **5~7 작업일** |

### 실측이 조사보다 큰 항목 (직접 grep 검증)

| 항목 | 병렬 조사 보고 | 실측 |
|---|---|---|
| `color: var(--warm-ivory)` | 60 | **90** |
| `color: var(--bg-color)` (금 배경 위 의심) | 11 | **16** |
| `color: var(--soft-gold)` / `--accent-color` | — | **57 / 62** |
| `:root` 선언 | 2~3 | **4** |
| 난제 | 45 | **80** |

---

## A. 테마 배관

### A-1. FOUC는 발생하지 않는다 (검증됨)

조사 과정에서 "라이트를 기본으로 하면 캐시 구조상 깜빡임을 피할 수 없다"는 주장이 나왔으나 **사실이 아니다**.

`app/layout.tsx:145`의 부트 스크립트는 `<head>` 안 **동기 인라인 스크립트**라 첫 페인트 *이전*에 실행된다.
관리 콘솔이 지금 정확히 이 방식으로 라이트 기본을 깜빡임 없이 구현하고 있다(`if(a && t !== 'dark')`).
서버 HTML이 ISR(`app/page.tsx:16`, `revalidate = 300`)·서비스워커 캐시를 공유하는 것은 무관하다 —
**테마 결정이 페인트 전 클라이언트에서 끝나기 때문**이다.

유일한 실제 예외는 **JS 비활성 사용자**이고, `<noscript><style>`로 라이트 토큰을 강제해 해결한다.
(콘솔에는 없던 보완이다.)

### A-2. `lib/theme.ts` — 단일 소스

```
lib/theme.ts
  ├─ STORAGE_KEYS  { site: 'site-theme', admin: 'admin-theme' }
  ├─ THEME_ATTRS   { site: 'data-site-theme', admin: 'data-admin-theme' }
  ├─ THEME_COLORS  { light: '#f6f1e6', dark: '#0a0a0a' }
  ├─ resolveTheme(pathname, adminPref, sitePref) → { theme, attr, themeColor }
  └─ buildBootScript() → layout이 <head>에 주입할 인라인 문자열
```

`AdminThemeContext` · `SiteThemeContext` · `app/layout.tsx` 셋이 **이것만** 참조한다.
현재 `AdminThemeContext.tsx:37`의 `PUBLIC_THEME_COLOR = '#0a0a0a'` 상수는 제거한다 —
이 상수 때문에, 라이트 선호 사용자가 콘솔에서 공개 사이트로 나올 때마다(`SiteViewLink`가 같은 창에서 이동)
상태바만 먹빛으로 되돌아간다.

### A-3. 판정 규칙

| 경로 | 저장 키 | 판정 | 스탬프 |
|---|---|---|---|
| `/admin/*` | `admin-theme` | `≠ 'dark'` → 라이트 | `data-admin-theme="light"` |
| 그 외 전부 | `site-theme` | `≠ 'dark'` → 라이트 | `data-site-theme="light"` |

부트 스크립트는 **항상 하나의 속성만** 찍는다. `SiteThemeProvider`도 `usePathname()`으로
`/admin` 하위에서 no-op — 두 속성이 `<html>`에 공존하는 일이 없다.

이게 중요한 이유: `html[data-admin-theme='light']`와 `html[data-site-theme='light']`는
특이도가 동일(0,2,0)하고 **같은 토큰**(`--bg-color`, `--text-color`, `--fg-rgb`, `--surface-2`,
`--soft-gold-text`)을 뒤집는다. 공존하면 승자를 CSS 작성 순서가 정하는 취약 구조가 된다.
공존 자체를 막는 것이 유일하게 견고한 해법이다.

속성을 `data-theme` 하나로 통일하는 안은 채택하지 않는다 — `globals.css`의 admin 셀렉터
33곳(7059, 7527, 15941~16033) 전면 치환이 따라붙어 이번 공사 범위를 넘는다.

### A-4. 토글 배치

- 데스크톱: 헤더 우측 툴바의 `LanguageSwitcher` 옆 (`Header.tsx:267`)
- 모바일: 모바일 메뉴의 `mobile-language-switcher` 옆 (`Header.tsx:285`)
- `(auth)` 3화면: 헤더가 없으므로 `app/(auth)/layout.tsx`의 `LanguageSwitcher` 옆에 별도 배치

시각 언어는 `AdminThemeToggle`(세그먼트 + 해·달 아이콘 + 현재 테마 금색 점등)을 그대로 쓴다.
공용 컴포넌트로 승격하고 콘솔도 이것을 쓰게 한다.

⚠️ 헤더 툴바 폭(`--header-auth-w`, `Header.tsx:66-77`)이 늘어난다. ≤1100px 브레이크포인트 근처에서
메뉴 겹침을 반드시 확인할 것. 좁은 화면에서 라벨을 숨기는 기존 패턴(`globals.css:4917-4924`)을 재사용한다.

---

## B. 색 시스템 — 3층

```
1층  :root                          다크 값 (그대로 둔다. 관리 콘솔 6,900줄이 의존)
2층  html[data-site-theme='light']  토큰 플립 ~15줄 (콘솔 팔레트 재사용)
3층  역할 토큰                       "뒤집히면 안 되는" 색에 이름을 준다
```

### B-1. 2층 — 토큰 플립

`globals.css:15941~15959`(콘솔 라이트)의 값을 그대로 재사용한다.

```css
html[data-site-theme='light'] {
  color-scheme: light;
  --bg-color: #f6f1e6;
  --bg-dark: #eee7d7;
  --text-color: #241b12;
  --text-muted: #6e6355;
  --warm-ivory: #2c2114;
  --fg-rgb: 36, 27, 18;
  --ivory-rgb: 44, 33, 20;
  --bg-rgb: 246, 241, 230;
  --surface-2: #e9e0cc;
  --soft-gold-text: #7d5f0b;
  --accent-text: #8a6a10;
  /* 신규 */
  --ink-texture-opacity: 0.05;   /* 다크 0.28 */
  --hairline-alpha: 0.50;        /* 다크 0.28 */
}
```

### B-2. 3층 — 역할 토큰 (이 공사의 핵심)

지금 `--warm-ivory` 하나가 *페이지 바탕 위 글자*와 *고정 배경 위 글자*를 겸하고 있다.
그래서 90곳이 한 토큰에 묶여 있고, 토큰이 뒤집히는 순간 **아무 작업을 안 해도 60곳 이상이 동시에 깨진다.**

| 신설 토큰 | 값 | 용도 | 두 테마 |
|---|---|---|---|
| `--on-accent` | `#14100b` | 금 배경 위 글자 (16곳) | **동일** |
| `--on-media` | `#f6efe2` | 사진·영상 위 전경 | **동일** |
| `--soft-gold-rgb` / `--accent-gold-rgb` | `224,184,79` / `212,160,23` | 알파 실린 금색 텍스트 | 플립 |
| `--ink-texture-opacity` | .28 → .05 | `black_stroke` multiply 강도 | 플립 |
| `--hairline-alpha` | .28 → .50 | 얇은 금 장식 | 플립 |
| `--paper-surface` / `--paper-ink` | `#f6efe2` / `#241b12` | 라이트 섬(`register-panel`) | **동일** |

`--on-accent`는 이미 `.admin-theme-btn.active`가 쓰고 있는 해법이다 — 새 발명이 아니라 승격이다.

### B-3. `:root` 통합

현재 `:root` 선언이 **4개**다:

| 줄 | 정체 | 처리 |
|---|---|---|
| 1 | 본체 | 유지 |
| 94 | `@media (max-width: 1100px)` 내부 헤더 토큰 | 유지 (정당한 용법) |
| 5551 | 관리 온보딩 토큰 (`--glow-gold`, `--done-green` …) | **삭제** — `var()` 소비처 0건 |
| 10987 | `--hairline-gold`, `--ink-panel` | **상단 `:root`로 이동** |

10987행이 특히 위험하다. 수업·프로그램·캠프 전 구간(11042~11720)이 `--ink-panel`에 의존하는데,
라이트 블록이 상단 `:root`만 뒤집는다고 가정하면 이 토큰은 **영원히 다크 값으로 남는다** —
어디서 새는지 추적이 매우 어려운 구조적 함정이다.

이동과 함께 `--ink-panel: rgba(var(--ivory-rgb), 0.055)`로 채널화한다.
(`--hairline-gold`는 배경용 금이라 두 테마 공통 유지, 알파만 `--hairline-alpha`로 뺀다.)

---

## C. 섬(Island) — 하위 선언을 안 고치고 영역을 반대 테마로 유지

### C-1. 다크 섬

사진이 주인공인 영역은 라이트에서도 먹빛 캔버스를 유지한다.

```css
.hero-art-bg, .about-hero, .feature-hero, .performance-hero,
.program-detail-hero, .gallery-lightbox, .camp-spotlight:has(img),
.students-hero, .timeline-hero, .glossary-hero, .media-hero, .gallery-hero {
  --text-color: #f6efe2;
  --text-muted: rgba(246, 239, 226, 0.62);
  --warm-ivory: #f6efe2;
  --fg-rgb: 255, 255, 255;
  --ivory-rgb: 246, 239, 226;
  --bg-rgb: 10, 10, 10;
  --surface-2: #1a1a1a;
  --soft-gold-text: var(--soft-gold);
  --accent-text: var(--accent-color);
  color-scheme: dark;
}
```

이 한 블록이 난제 80건 중 **21건**(사진 위 스크림 14 + 블렌드·필터 7)을 소멸시킨다.
하위 선언을 한 줄도 안 고치고 스크림·텍스트·금색이 통째로 다크로 유지되기 때문이다.

**헤더**는 최상단(투명, 히어로 위)에서 다크 섬을 상속하고 `.scrolled` 상태에서만 종이로 전환한다.

### C-2. 라이트 섬

`.register-panel`(11545~11690)은 주석에 *"the one ivory moment"*라고 적힌, **의도적으로 반전된
아이보리 카드**다. `background: var(--warm-ivory); color: var(--ink-black)` 구조라
`--warm-ivory`만 뒤집히고 `--ink-black`은 안 뒤집혀서, **아무 작업을 안 해도 라이트에서
어두운 카드 위 어두운 글자**가 된다.

```css
.register-panel { --paper-surface: #f6efe2; --paper-ink: #241b12; }  /* 두 테마 동일 */
```

내부 갈색 하드코딩(`#5a4a3a` / `#3a2e22` / `#4a3c2e`)은 `--paper-ink`의 알파 단계(0.72 / 0.86)로
통일하고, 그림자는 `rgba(76,57,32,α)` 온기 그림자로 바꾼다(콘솔 라이트의 `.admin-sheet` 보정과 같은 방식).

다크 섬의 정확한 반대 개념이며 같은 메커니즘으로 구현된다.

---

## D. 실행 순서

| Phase | 내용 | 완료 기준 |
|---|---|---|
| **0. 정지 작업** | 죽은 코드 삭제, `:root` 4→2개 통합, `--ink-panel` 이동·채널화 | 빌드 통과 + **다크 화면 시각 변화 0** |
| **1. 배관** | `lib/theme.ts` + `SiteThemeContext` + `ThemeToggle` + 부트 스크립트 4분기 + `<noscript>` | 토글이 `data-site-theme`를 찍음. **색은 아직 안 바뀜** |
| **2. 분류 대장** | `--warm-ivory` 90 / `--bg-color` 16 / 금색 119곳 전수 분류, 역할 토큰 교체, 린트 작성 | `npm run lint:theme` 통과 |
| **3. 플립 + 치환** | 라이트 토큰 블록 신설, 리터럴 ~330건 채널 토큰화 | **라우트 단위 커밋** |
| **4. 섬 격리** | 다크 섬 12종 + 라이트 섬 1종 | 히어로·라이트박스 두 테마 정상 |
| **5. 난제** | 대장 80건 중 잔여 ~55건 | 대장 전 항목 `[x]` |
| **6. 에셋** | `dancheong.png` 재추출, 로고 변형 통일 | — |
| **7. 테스트·QA** | 단위 테스트 2종 + 브라우저 대비 스캔 + 수동 체크리스트 | 88화면 WCAG 통과 |

**Phase 3의 라우트 순서는 난이도 역순**이다. 앞쪽에서 치환 규칙과 린트를 검증한 뒤 어려운 곳에 들어간다.

1. 문서형 — `/privacy` `/terms` `/glossary` `/calendar`
2. 폼·목록형 — `/rsvp/[id]` `/students` `(auth)` 3화면 `/media` `/media/[id]`
3. 카드 그리드 — `/gallery` `/gallery/[year]/[slug]` `/gallery/event/[id]` `/classes` `/classes/[slug]` `/timeline` `/community` `/app`
4. 히어로형 — `/` `/about` `/performances` `/performances/[slug]`

---

## E. 테스트 계획

이 저장소에 **실제로 있는 도구만** 쓴다: `node --test`(`npm test`), `eslint`, `next build`, Playwright MCP.
Storybook · Chromatic · Playwright 테스트 러너는 **도입하지 않는다** — 이 규모의 변경 하나를 위해
러너와 스냅샷 기준선을 세우는 비용이 얻는 것보다 크고, 아래 3·4번이 같은 역할을 한다.

### E-1. 자동 — 단위 테스트 (신규 2파일, `npm test`)

**`lib/theme.test.ts`** — `resolveTheme()` 진리표 18케이스 (경로 2 × 콘솔 선호 3 × 사이트 선호 3).

잡는 회귀:
- 콘솔에서 공개로 나올 때 상태바가 먹빛으로 되돌아감 (`PUBLIC_THEME_COLOR` 상수 부활)
- `/admin`에서 `data-site-theme`가 함께 찍힘 (속성 공존)
- 저장값 없음 → 라이트 (기본값 규칙)
- 저장값 `'dark'`만 다크, 그 외 문자열(`''`, `'DARK'`, 쓰레기값)은 라이트

**`lib/theme/contrast.test.ts`** — WCAG 상대휘도 계산기 + 팔레트 조합 매트릭스.

- 본문 텍스트 ≥ 4.5:1, 큰 글자·UI 컴포넌트 ≥ 3:1
- 두 테마 전부 × 역할 토큰 전 조합 (`--on-accent` on 금, `--on-media` on 스크림, 본문 on 지면, 뮤트 on 지면, 금 텍스트 on 지면 …)
- **팔레트 값을 바꾸면 이 테스트가 먼저 깨진다** — 팔레트가 코드로 잠긴다

### E-2. 자동 — CSS 린트 (`scripts/lintTheme.mjs`, `npm run lint:theme`)

정규식 기반 정적 검사. 각 규칙은 제외 대장(`/* theme-exempt: 사유 */` 주석)을 존중한다.

| 규칙 | 잡는 것 |
|---|---|
| `:root` 선언은 최상단 1개 + 미디어쿼리 내부만 | 10987행류 재발 |
| 공개 구간에 `rgba(255,255,255` / 다크 표면 hex 직접 사용 금지 | 채널 토큰 미사용 |
| `color: var(--soft-gold\|--accent-color)` 공개 구간 금지 | 종이 위 밝은 금 = 판독 불가 |
| `color: var(--bg-color)` 금지 → `--on-accent` | 금 배경 위 글자 소멸 (16곳) |
| `color: var(--warm-ivory)` 는 분류 대장 등재 셀렉터만 허용 | **90곳 중 하나라도 누락되면 실패** |
| `*-hero` / `*-art-bg` 셀렉터가 다크 섬 목록에 등재됐는지 대조 | **새 히어로 페이지 추가 시 조용히 깨지는 것** |

마지막 규칙이 이 공사의 유일한 장기 안전장치다. 다크 섬은 셀렉터 목록이라 등록을 잊으면
아무 에러 없이 라이트에서 사진 위 글자가 사라진다.

### E-3. 반자동 — 브라우저 대비 스캔 (Playwright MCP)

공개 22개 라우트 × 2테마 × 2폭(390px / 1440px) = **88화면**.

각 화면에서 `browser_evaluate`로 전 텍스트 노드를 순회하며 실효 전경·배경을 합성 계산하고
WCAG 미달 요소를 셀렉터·좌표와 함께 반환하는 스니펫을 돌린다. **육안이 아니라 측정이다.**
스크린샷도 함께 남겨 대장에 첨부한다.

### E-4. 수동 체크리스트 — 기계가 못 보는 것

- [ ] 히어로 배경을 **밝은 사진** / **어두운 사진**으로 각각 교체해 대비 유지 확인 (운영자가 언제든 바꾸는 값)
- [ ] 전환 순간 깜빡임: 하드 리로드 · SW 캐시 히트 · iOS standalone · JS 비활성
- [ ] 콘솔 ↔ 공개 왕복 시 상태바 색 (`SiteViewLink`가 같은 창에서 이동)
- [ ] 관리자 편집 모드 UI(`IntlObject` 모달 · `ImageObject` 편집기 · `.section-edit-btn`)가 라이트 공개 페이지 위에서 읽히는지
- [ ] 헤더 툴바 폭 증가로 ≤1100px 근처 메뉴 겹침
- [ ] 인쇄 미리보기

---

## F. 리스크

| # | 리스크 | 대응 |
|---|---|---|
| 1 | **`--warm-ivory` 90곳 자동 플립 사고** — 아무 작업 안 해도 붉은 버튼·먹 섹션 위 글자가 동시에 사라짐. `.gallery-cal-btn--primary`는 `color` 미재선언 상속이라 grep에 안 잡힘 | Phase 2 분류 대장을 **치환보다 먼저**. 린트가 미등재를 실패 처리 |
| 2 | **D1 저장 헤더 배경이 인라인 style로 CSS를 이김** (`layout.tsx:173`) | 최상단 헤더는 다크 섬이라 무해. 남는 건 **축소 헤더 하나** → 1차는 "라이트에서 헤더는 관리자 지정색 무시" 명시 정책 + 관리 패널에 안내 문구. D1 스키마는 건드리지 않는다(롤백 불가 항목 회피) |
| 3 | **`HeaderWaves` 캔버스는 CSS로 못 고침** — 색이 JS 상수(`HeaderWaves.tsx:40-53`) + `shadowBlur` 글로우 | alpha·shadowBlur만 CSS 변수화. **콘솔 사이드바가 이미 라이트라 지금 실물이 선례** — 코드 전에 `/admin`을 열어 확인할 것 |
| 4 | **이진 알파 에셋의 계단 경계** — `black_stroke.png`·`dancheong.png`가 안티에일리어싱 없이 0/255 | 텍스처는 `--ink-texture-opacity` 0.05로 낮추면 안 보임. `dancheong.png`만 재추출 필요 (D1 keycode 교체라 **코드 변경 0**) |
| 5 | **속성 공존 시 특이도 동률** | A-3의 상호 배타 스탬프. 린트가 아니라 **구조로** 막는다 |
| 6 | **`--color-secondary` 오타** (12534, 14549, 15231) — 정의되지 않은 토큰이라 항상 폴백 `#c4302b`로만 그려짐 | Phase 2에서 `--secondary-color`로 교정. 지금은 무해하지만 토큰 기반 라이트 대응을 넣는 순간 반영이 안 된다 |
| 7 | **제2 아이보리 리터럴** `rgba(240,234,224,α)` 3곳(12855, 13098, 13113) — 본문 장문 텍스트인데 `rgba(246,239,226` 만 찾는 스크립트가 놓침 | 치환 스크립트의 패턴에 포함. 린트가 잔존을 검출 |

---

## G. 되돌리기

Phase 단위로 커밋하므로 어느 지점이든 `git revert`로 되돌릴 수 있다.
**D1 스키마를 건드리지 않는 것**이 이 설계의 안전판이다 — 데이터 마이그레이션이 없으므로
전체를 되돌려도 운영 데이터가 남지 않는다. (전면 라이트 안이었다면 헤더·히어로 톤 설정을
테마별 2세트로 확장해야 했고, 그건 되돌리기 어려운 유일한 항목이었다.)

기능 자체를 끄고 싶으면 부트 스크립트가 `site-theme`를 읽지 않게 하고 토글을 감추면
공개 사이트는 즉시 지금과 동일한 다크로 돌아간다.
