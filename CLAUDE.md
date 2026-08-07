# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**KTDOC** - Korean Traditional Dance of Choomnoori website. Next.js 16 + React 19 + TypeScript application migrated from static HTML.

## Page Layout Standard (공개 페이지)

고정 헤더는 콘텐츠(로고·메뉴·safe-area)로 높이가 결정되는 유동 요소다. Header.tsx가
ResizeObserver로 실높이를 재서 문서 루트에 발행한다:

- `--header-offset`: 최상단(확장) 헤더 실높이 — 페이지 오프셋 기준
- `--header-h-scrolled`: 스크롤 후(축소) 실높이 — sticky·anchor 보정 기준
- 정적 폴백은 globals.css `:root`(데스크톱 206px/80px, ≤1100px 92px/70px)

규칙:
1. **상단 여백은 첫 섹션(히어로)이 소유한다.** `padding-top: var(--page-offset)`(히어로형)
   또는 `var(--page-offset-tight)`(상세·유틸 페이지). `main`에는 상단 padding을 주지 않는다.
2. **모바일 오프셋 오버라이드 금지.** 토큰이 브레이크포인트·실측으로 반응한다.
   페이지별 미디어쿼리에서는 하단 여백만 조정한다.
3. **iOS standalone(홈 화면 설치) 안전영역은 토큰에 포함돼 있다** — 헤더가
   `env(safe-area-inset-top)`을 패딩하고 실측값에 반영되므로 별도 처리 불필요.
   새 고정/플로팅 요소는 `--safe-top/bottom/left/right` 토큰으로 보정할 것.
4. **히어로 골격**: eyebrow(라벨) → h1 타이틀 → 설명 순서. gallery-hero
   (label/title/subtitle/description)가 캐노니컬 참조.

## i18n (다국어) — 관리 콘솔 포함 전역

앱 전체가 **클라이언트 사이드 번역** 방식이다(서버 로케일 감지 없음). SSR은 항상
한국어(기본)로 렌더되고, 하이드레이션 후 사용자 언어(`localStorage['lang']`, ko/en)로
바뀐다. 메시지는 `locale/ko.json`·`locale/en.json`(번들 기본값) 위에 D1 오버라이드
(`/api/locale`)를 얹은 플랫 key→string 맵이다. 전역 소스는 `contexts/LanguageContext`.

번역 텍스트를 쓰는 두 가지 방법:
- **서버 컴포넌트**: `<IntlObject keycode="..." />` (편집 모달 내장, 마크업 래퍼 생성)
- **클라이언트 컴포넌트**: `const t = useT()` (`lib/i18n/useT.ts`) →
  `t(keycode, fallback?, params?)`. 순수 문자열 반환이라 라벨·aria-label 등
  래퍼를 붙이면 안 되는 자리에 적합.

키코드 네임스페이스(도메인별):
- 관리 콘솔은 `admin.*` — 네비 `admin.nav.<menuKey>`, 섹션 헤더
  `admin.navGroup.<groupKey>`, 셸 크롬 `admin.shell.*`.

규칙:
1. **항상 fallback을 넘긴다.** `t('admin.x.y', '한국어 기본값')`. 키가 아직 locale
   파일에 없어도 화면이 키코드로 깨지지 않는다(페이지별 점진 이관의 안전망).
2. **ko/en 키 세트를 맞춘다.** locale 파일에 키를 추가할 땐 두 파일 모두에.
   한국어 값은 코드의 fallback과 동일하게 두어 한국어 화면이 변하지 않게 한다.
3. **메뉴 라벨은 레지스트리(`lib/admin/menu-registry.ts`)의 `label`이 폴백**이고,
   키코드는 `getMenuLabelKey`/`getGroupLabelKey`로 파생된다. 새 메뉴 추가 시 라벨은
   레지스트리에만 쓰고, 번역은 `admin.nav.<key>`를 두 locale 파일에 추가하면 된다.
4. **콘솔 내 언어 전환**은 사이드바 하단 `<LanguageSwitcher/>`. public 사이트와
   같은 `lang` 선호를 공유한다(콘솔에서 바꾸면 공개 사이트도 함께 바뀜).

세부 페이지 본문 텍스트의 다국어화는 필요 시 페이지별로 위 규칙에 따라 진행한다.

## 공개 사이트 테마 (라이트 기본 / 다크 전환)

공개 사이트는 **한지(라이트)가 기본**이고 헤더·모바일 칩·로그인 화면의 토글로 다크 전환이
가능하다. 선호는 `localStorage['site-theme']`에 저장되며 **저장값이 정확히 'dark'일 때만**
다크다. 관리 콘솔 선호(`admin-theme`)와는 **완전히 별개**다.

규칙·상수·DOM 반영의 단일 소스는 `lib/theme.ts`다. 부트 스크립트도 여기서 생성되므로
손으로 쓴 값과 어긋날 수 없다. 두 영역의 속성(`data-site-theme`/`data-admin-theme`)은
**절대 공존하지 않는다** — 특이도가 같고 같은 토큰을 뒤집기 때문에 공존하면 CSS 작성
순서가 승자를 정한다. `applyThemeToDocument()`가 한쪽을 찍을 때 반대쪽을 지운다.

**공개 사이트 CSS를 쓸 때 규칙**:

1. **색은 역할로 부른다.** 지면은 `var(--ground)`~`var(--ground-4)`(5단계), 표면은
   `var(--surface-2)`, 전경은 `var(--text-color)`/`var(--text-muted)`. 흰색·아이보리
   리터럴 대신 `rgba(var(--fg-rgb), α)`·`rgba(var(--ivory-rgb), α)`.
2. **뒤집히면 안 되는 전경에는 이름이 있다.** 금 배경 위 글자는 `var(--on-accent)`,
   사진·영상 위 전경은 `var(--on-media)`. 둘 다 두 테마에서 같은 값이다.
3. **금색은 역할로 구분**한다(콘솔과 동일). 텍스트는 `--soft-gold-text`/`--accent-text`,
   배경·보더는 `--soft-gold`/`--accent-color`.
4. **새 히어로를 만들면 반드시 등록한다.** 배경이 사진이면 다크 섬(라이트에서도 어두운
   캔버스 유지), 먹 그라디언트뿐이면 지면 히어로(한지로 뒤집힘). 등록처는
   `scripts/lintTheme.mjs`의 `DARK_ISLANDS`/`GROUND_HEROES`와 globals.css의 다크 섬
   블록이다. 어디에도 없으면 `npm run lint:theme`가 실패한다.
   지면 히어로는 `var(--hero-veil), var(--hero-glow)` 또는
   `var(--hero-wash), var(--hero-ground)` 두 관용구 중 하나를 쓴다.
5. **리터럴이 정답인 자리에는 이유를 남긴다** — `/* theme-exempt: 사유 */`.
6. 완료 전 `npm run lint:theme`(0건)와 `npm test`(대비 단언)를 돌리고,
   **두 테마 모두 눈으로 확인**한다. 판정 근거는
   `docs/operations/theme-token-ledger.json`과 `public-theme-decisions.md`에 있다.

## 관리 콘솔 테마 (라이트 기본 / 다크 전환) — 콘솔 한정

관리 콘솔도 **라이트가 기본값**이고, 상단바
세그먼트 토글(`AdminThemeToggle`)로 다크 전환이 가능하며, 선호는
`localStorage['admin-theme']`에 저장된다(저장값이 'dark'일 때만 다크).
전역 소스는 `contexts/AdminThemeContext`(콘솔 레이아웃에서만 마운트). 콘솔을 벗어나면
루트에 상주하는 `SiteThemeProvider`가 주인이 되어 `data-admin-theme`를 지우고 공개
선호와 상태바 색을 복원한다. FOUC 방지 부트 스크립트는 루트 layout의 `<head>`에 있는
**동기** 인라인 스크립트이며(`lib/theme.ts`가 생성), 경로로 두 영역을 가른다.

CSS 구조: `:root`는 다크 값, `globals.css` 하단 `html[data-admin-theme='light']`
블록이 토큰을 뒤집는다. **관리 콘솔 화면의 새 CSS를 쓸 때 규칙**:

1. 어두운 배경 위 흰/아이보리 전경은 `rgba(255,255,255,α)`를 직접 쓰지 말고
   `rgba(var(--fg-rgb), α)`·`rgba(var(--ivory-rgb), α)`로. 표면은 `var(--surface-2)`,
   반투명 스크림은 `rgba(var(--bg-rgb), α)`.
2. **금색은 역할로 구분**: 텍스트는 `var(--soft-gold-text)`/`var(--accent-text)`
   (라이트에서 어두운 금으로 뒤집혀 대비 확보), 배경·보더는 기존
   `var(--soft-gold)`/`var(--accent-color)` 그대로(두 테마 모두 선명 유지 —
   금 배경 + 먹 글자 칩이 그대로 성립).
3. **사진·영상 위 오버레이(라이트박스, 썸네일 배지 등)는 테마와 무관하게
   리터럴 색**(흰 글자·검정 스크림)을 유지한다 — 채널 토큰을 쓰면 라이트에서
   이미지 위 대비가 깨진다.
4. 다크 전용으로 튜닝된 고정색(파스텔 상태색, 어두운 hex 표면)을 쓰면
   라이트 블록에 셀렉터별 보정을 함께 추가할 것.
5. **관리 콘솔 UI를 만들거나 수정하면 완료 전에 두 테마 모두 확인한다**
   (상단바 토글로 전환하며 대비·가독성 점검). 별도 요청이 없어도 기본 루틴.

## Reference Files

- **legacy_backup/**: Original static HTML/CSS/JS before migration
- **docs/design/**: Design mockups and asset documentation
