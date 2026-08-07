# 공개 사이트 라이트 테마 — 구조 결정과 작업 목록

> 설계: [2026-08-07 공개 사이트 라이트/다크 테마](../superpowers/specs/2026-08-07-public-site-light-dark-theme-design.md)
> 분류 대장(기계 판독용): [theme-token-ledger.json](./theme-token-ledger.json) — `npm run lint:theme`가 읽는다
> 난제 대장: [public-theme-hardcases.md](./public-theme-hardcases.md)

색 선언 201건을 판정하고, 그 판정을 적대적으로 감사한 결과 **구조적 근본 원인 하나**가 드러났다.
이 문서는 그 원인과, 거기서 따라 나오는 결정을 기록한다.

## 근본 원인 — 지면이 뒤집히지 않는다

`flip`(토큰이 뒤집히는 게 정답) 판정 상당수가 사실은 **조건부**였다. 조건은 하나로 같다:

> 그 요소가 올라앉은 **배경도 함께 뒤집혀야 한다.**

그런데 페이지 셸과 섹션 배경이 `--ink-black`·`--ink-umber`·`--deep-umber`·`--soft-umber`처럼
**뒤집히지 않는 고정 브랜드 먹 토큰**으로 칠해져 있다. 이 토큰들은 금색 배경 위 먹 글자로도
쓰여서 전역 플립이 불가능하다. 결과적으로 전경만 먹으로 뒤집히고 배경은 먹으로 남아
**섹션이 통째로 사라진다.**

감사가 지목한 사례: `.mission-section` · `.journey-section` · `#categories` · `.about-director` ·
`.classes-page` · `.performances-page` · `.program-card` · `.classes-hero` 등.

## 결정 1 — 지면(ground) 토큰을 신설한다

배경을 "브랜드 먹"이 아니라 **"지면"이라는 역할**로 다시 부른다. 역할 토큰이므로 테마를 따라간다.

| 토큰 | 다크 | 라이트 | 쓰는 곳 |
|---|---|---|---|
| `--ground` | `var(--ink-black)` | `#f6f1e6` | 페이지 셸 단색 배경 |
| `--ground-raised` | `var(--ink-umber)` | `#faf7f0` | 위로 들린 지면(그라디언트 시작) |
| `--ground-sunken` | `#120c09` | `#efe7d6` | 가라앉은 지면(그라디언트 끝) |
| `--surface` | `rgba(var(--ivory-rgb), .04)` | 동일 식 | 지면 위 카드·패널 |

`--ink-*` 토큰 자체는 **손대지 않는다.** 금 배경 위 먹 글자로 쓰이는 자리가 남아 있어야 하기 때문이다.
바꾸는 것은 "지면으로 쓰인 자리"뿐이다.

### 지면으로 전환할 곳

**페이지 셸(단색 `var(--ink-black)`)**
`.classes-page` · `.performances-page` · `.calendar-page` · `.rsvp-page` · `.legal-page` · `.program-detail`

**페이지 셸(먹 그라디언트)**
`.gallery-page` · `.gallery-detail-page` · `.students-page` · `.timeline-page` · `.glossary-page` · `.feature-preview-section`

**섹션 배경**
`.mission-section` · `.journey-section` · `#categories` · `.about-director` · `.gallery-main` · `.media-main`

**카드는 표면이다** — `.program-card` · `.journey-card` · `.performance-card` 등은 지면 위 표면이므로
`--surface`로 전환한다. 이러면 카드 안 텍스트의 `flip` 판정이 그대로 성립한다.

## 결정 2 — 히어로는 두 관용구로 끝난다

히어로 10개가 **딱 두 개의 반복 관용구**를 공유한다. 개별 대응 10건이 아니라 토큰 4개 문제다.

```css
/* 관용구 A — .gallery-hero .students-hero .timeline-hero .glossary-hero .media-hero .performances-hero */
background: var(--hero-veil), var(--hero-glow);
/* 관용구 B — .classes-hero .calendar-hero .rsvp-hero .legal-hero */
background: var(--hero-wash), var(--hero-ground);
```

| 토큰 | 다크 | 라이트 |
|---|---|---|
| `--hero-veil` | `linear-gradient(180deg, rgba(8,5,4,.65), rgba(8,5,4,.18))` | 한지 베일 |
| `--hero-glow` | `radial-gradient(circle at 50% 20%, rgba(224,184,79,.12), transparent 36%)` | 알파 상향 |
| `--hero-wash` | `radial-gradient(120% 90% at 50% 0%, rgba(212,160,23,.08), transparent 60%)` | 알파 상향 |
| `--hero-ground` | `linear-gradient(180deg, var(--ink-umber), var(--ink-black))` | 한지 그라디언트 |

## 결정 3 — 히어로는 사진형과 지면형 둘뿐이다

`scripts/lintTheme.mjs`가 두 레지스트리를 갖고, 히어로 루트가 **어디에도 없으면 실패**한다.
새 히어로를 만들면서 등록을 잊는 것이 이 공사의 유일한 장기 위험이기 때문이다.

- **사진형(다크 섬)** — `#hero` `.hero-art-bg` `.about-hero` `.feature-hero` `.performance-hero` `.program-detail-hero` `.gallery-lightbox` `.camp-spotlight`
- **지면형(플립)** — 위 10개 + `.classes-loading-hero`

`.camp-spotlight`는 이미지 유무로 갈리던 것을 **컴포넌트 전체를 섬으로 승격**한다.
`--no-image` 변형도 고정 먹 배경이라 어차피 어두운 캔버스이고, 한 셀렉터 그룹 안에서
라벨만 뒤집혀 값과 어긋나는 사고를 막는다.

## 결정 4 — `--warm-ivory`와 `--white`를 정리한다

`--warm-ivory`가 *지면 위 글자*와 *고정 배경 위 글자*를 겸해서 90곳이 한 토큰에 묶여 있었다.
이제 역할로 쪼갠다. `--white`는 판단을 요구하는 토큰이므로 **폐기 방향**으로 간다 —
고정 배경 위 자리는 `--on-media`, 지면 위 자리는 `--text-color`.

`--bg-dark`도 플립 세트에 반드시 포함한다. `#main-footer`가 `background-color: var(--bg-dark)` +
`color: var(--text-color)` 조합이라, 하나만 뒤집히면 푸터가 통째로 사라진다.

## 작업 목록 — 감사가 찾아낸 확정 버그

`color`를 재선언하지 않고 base에서 상속만 받아 **grep으로는 잡히지 않던** 것들이 대부분이다.

- [ ] `.auth-btn-primary` (2082) — 붉은 배경 + `.auth-btn`의 `--text-color` 상속 → `--on-media`
- [ ] `.gallery-cal-btn--primary` (13561) — 붉은 그라디언트 + `--warm-ivory` 상속 → `--on-media`
- [ ] `.cal-sub-btn--primary` (13207) — 붉은 그라디언트 위 `--warm-ivory` → `--on-media`
- [ ] `.gallery-video-thumb-title` (4537) — 검정 스크림 위 `--text-color` → `--on-media`
- [ ] `.qna-a-mark` (15874) — 금 배경 위 `--bg-color` → `--on-accent`
- [ ] `.mobile-language-switcher .lang-btn.active` (3031) — 뒤집히는 배경 + 고정 먹 글자
- [ ] `.register-panel` (11566) — 라이트 섬으로 못박기(다크 섬의 거울상)
- [ ] `.timeline-node` (13897) — 한지 위 아이보리 13% 보더 소실 → 채널 토큰 + 알파 상향
- [ ] `#main-nav` (358·359) — 메뉴 바 구분선 흰색 리터럴 → 채널 토큰
- [ ] `#main-header.scrolled::before/::after` (297·301) — 고정 먹 폴백 → 지면 채널
- [ ] `.mobile-menu-btn` (1800·1802) — 고정 먹 알약 + 뒤집히는 3선
- [ ] `.notfound::before` (12131) — 뷰포트 전체 먹 비네트 → 지면 채널 또는 라이트에서 무력화
- [ ] `.ink-ambient__wash--ivory` / `__grain` (193·221) — 다크 전용 발광·블렌드
- [ ] `--white` 사용처 13곳 정리

---

## 남은 작업 (2026-08-07 기준)

구현이 끝나지 않은 것만 적는다. 위 '작업 목록'의 확정 버그는 모두 처리됐고
`npm run lint:theme`가 0건, `npm test` 32건이 통과한다.

- [ ] **`dancheong.png` 소프트 알파 재추출** — 팔레트 PNG(color type 3)라 알파가
  이진일 가능성이 높다. 밝은 바탕에서 계단 경계가 드러날 수 있는데, 이 저장소에는
  이미지 처리 의존성(sharp 등)이 없어 확인·재추출을 하지 못했다. 육안으로는 라이트
  홈에서 문제가 보이지 않았다 — 고해상도로 확인한 뒤 필요하면 교체할 것.
  D1 keycode `image.traditional.dancheong`로 갈아끼우면 되므로 코드 변경은 0.
- [ ] **관리자 패널 안내 문구** — 라이트에서는 Top Bar 지정색이 무시된다는 사실을
  `/admin`의 헤더 배경 편집기에 표기해야 한다(현재는 코드 주석에만 있다).
- [ ] **전수 QA** — 대비 스캔은 `/timeline`·`/gallery`에서 라이트 0건을 확인했다.
  나머지 20개 라우트 × 2테마 × 2폭은 아직 돌리지 않았다. 스캔 스니펫은
  커밋 메시지(9c20e8f)와 이 문서의 방법론을 따르면 재현할 수 있다.
- [ ] **(auth) 3화면 육안 확인** — 세션 쿠키가 httpOnly라 브라우저에서 로그아웃
  상태를 만들지 못해 로그인·가입 화면을 실물로 보지 못했다. CSS와 컴포넌트 배선은
  넣었으나 확인이 남았다.
- [ ] **모바일 폭(390px) 확인** — 헤더 툴바에 토글이 늘어 ≤1100px에서 메뉴 줄바꿈이
  생기지 않는지, 모바일 플로팅 칩이 넓어져 어색하지 않은지.

### 다크에서 발견된 기존 부채 (이번 작업의 회귀 아님)

대비 스캔이 다크에서도 미달을 보고하는데, 전부 이번에 건드리지 않은 값이다.
`.auth-user`(1.13:1)는 관리자가 D1에 지정한 밝은 헤더색 위 흰 글자이고,
`.timeline-sort-btn`·`.timeline-event-card-more`(3.37:1)와 `.timeline-year`(2.89:1)는
원래부터 있던 알파다. 별도 과제로 다룰 것.
