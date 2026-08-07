# 공개 사이트 라이트 테마 — 난제 작업 대장

> 설계: [2026-08-07 공개 사이트 라이트/다크 테마](../superpowers/specs/2026-08-07-public-site-light-dark-theme-design.md)
> 출처: globals.css 전수 조사(6분할 병렬) — 총 80건. 줄 번호는 조사 시점(main @5966a4a) 기준이라 작업이 진행되면 밀린다. 셀렉터로 찾을 것.

각 항목은 Phase 3~5에서 처리하고 체크한다. `[x]`가 곧 완료 증적이다.

## - [ ] L161 — `.ink-ambient__wash--gold / --ivory / --ember`

```css
background: radial-gradient(closest-side,
    rgba(212, 160, 23, 0.52),
    rgba(33, 19, 15, 0) 72%);
```

**왜 어려운가** — 어두운 바탕에서 '빛이 번지는' 발광 전제. 라이트 배경에서는 (a) 밝은 금/아이보리가 보이지 않고 (b) 페이드 종점이 투명 '먹색'이라 보간 중간이 탁한 갈색 테두리로 남는다. 아이보리 워시는 흰 종이 위에서 완전 소멸.

**해법** — 라이트 전용으로 색을 바꾼다 — 금은 rgba(180,130,20,0.10) 정도의 '스며든 물감', 아이보리 워시는 옅은 먹(rgba(33,19,15,0.06))으로 역할 반전. 페이드 종점은 같은 색의 α0으로 통일해 회색 밴딩 제거. --ink-peak도 테마별로 재조정.

## - [ ] L203 — `.ink-ambient__grain`

```css
opacity: 0.06;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,…feTurbulence…");
```

**왜 어려운가** — overlay 블렌드는 바탕 밝기에 따라 결과가 반전된다. 검은 종이 위에서는 섬유 질감으로 보이지만 밝은 바탕에서는 노이즈가 어둡게 튀어 지저분해진다. opacity 0.06도 OLED 블랙 기준으로 맞춰진 값.

**해법** — 라이트에서는 mix-blend-mode를 multiply로 바꾸고 opacity를 0.03~0.04로 낮추거나(종이 결 느낌), 아예 display:none으로 끄는 편이 안전하다. 테마별 블록에서 blend/opacity만 오버라이드.

## - [ ] L277 — `#main-header::before / ::after (+ .scrolled)`

```css
background-color: var(--header-bg-scrolled, rgba(10, 10, 10, 0.95));
…
background-color: var(--header-menu-bg-scrolled, rgba(10, 10, 10, 0.95));
```

**왜 어려운가** — 헤더 배경/메뉴 글자색이 관리자가 D1에 저장한 값(--header-bg-*, --header-nav-color-*)이고 CSS는 다크 폴백만 준다. 저장된 값은 '다크 사이트 기준'으로 고른 색이라, 공개 사이트가 라이트가 되면 관리자 설정이 그대로 살아나 흰 페이지 위에 검은 헤더가 붙거나 흰 글자가 날아간다. 최상단에서는 헤더가 투명이라 히어로 사진 위 대비 문제도 겹친다.

**해법** — 폴백만 토큰화해서는 부족하다 — 저장 스키마를 테마별 2세트로 확장하거나, 라이트에서는 관리자 지정 색을 무시하고 토큰 기본값을 쓰도록 우선순위를 정해야 한다. 전환 계획에서 데이터 마이그레이션이 필요한 유일한 항목.

## - [ ] L297 — `.header-waves (canvas — components/HeaderWaves.tsx)`

```css
.header-waves { position: absolute; inset: 0; … z-index: 0; }
```

**왜 어려운가** — 헤더의 선 인터랙션 색이 CSS가 아니라 JS 상수에 있다(HeaderWaves.tsx 40~44줄: color '224, 47, 50' / '240, 148, 26' / '27, 110, 182', alpha 0.24~0.3, 109~111줄에서 shadowColor 글로우). 오방색 선을 어두운 배경 위 발광으로 그리는 구조라 라이트에서는 흐릿하게 뜨고 글로우가 번진 얼룩이 된다.

**해법** — CSS 변수(--wave-alpha, --wave-glow)를 두고 JS가 getComputedStyle로 읽게 하거나, 컴포넌트가 테마 컨텍스트를 구독해 라이트에서는 alpha를 0.45~0.55로 올리고 shadowBlur를 0으로 낮추도록 수정. CSS 인벤토리만으로는 잡히지 않는 항목.

## - [ ] L571 — `#hero::before`

```css
background:
    radial-gradient(circle at 22% 24%, rgba(224,184,79,0.15), transparent 34%),
    linear-gradient(90deg, rgba(5,5,5,0.93) 0%, … rgba(5,5,5,0.82) 100%),
```

**왜 어려운가** — 히어로 배경 사진 위 텍스트 가독성을 만드는 3중 검정 스크림. 규칙3(사진 위 오버레이는 리터럴 유지)에 해당하지만, 라이트 페이지에서 화면 상단만 검게 남으면 페이지 전체와 이질적이다. 히어로 텍스트(아이보리)를 라이트로 뒤집을지 여부와 묶여 있는 결정.

**해법** — 두 갈래 중 택1: (A) 히어로는 두 테마 모두 다크 유지(스크림·텍스트 리터럴 고정) — 가장 안전하고 사진 대비도 지킨다. (B) 라이트 전용으로 스크림을 rgba(246,239,226,0.86) 계열 밝은 워시로 뒤집고 히어로 텍스트를 먹색으로 함께 전환. 절대 스크림만 부분 치환하지 말 것.

## - [ ] L583 — `#hero::after`

```css
height: 34%;
  background: linear-gradient(180deg, transparent 0%, #090705 86%);
```

**왜 어려운가** — 히어로 하단을 다음 섹션 배경색(#090705 계열)으로 이어 붙이는 '이음매' 그라디언트다. 아래 섹션 배경만 밝게 바꾸면 여기 하드코딩된 먹색이 남아 가로 띠 경계선이 생긴다.

**해법** — #090705를 var(--bg-color)(또는 새 --hero-seam 토큰)로 바꿔 섹션 배경과 항상 같은 값을 참조하게 한다. #hero의 background-color: #090705(564)도 동일 토큰으로.

## - [ ] L602 — `.hero-art-bg::before`

```css
background: … url('/assets/images/black_stroke.png') center / cover no-repeat;
  opacity: 0.28;
  mix-blend-mode: multiply;
```

**왜 어려운가** — 먹 스트로크 텍스처를 multiply로 얹는다. multiply는 밝은 바탕에서 그대로 어두워지므로, 라이트 배경에서는 은은한 질감이 아니라 시커먼 얼룩으로 나타난다. 위에 얹힌 금/붉은 radial의 의도도 뒤집힌다.

**해법** — 라이트에서는 mix-blend-mode: multiply를 유지하되 opacity를 0.08~0.12로 크게 낮추거나(종이에 번진 먹), screen 대신 soft-light로 바꿔 실측한다. 두 테마를 나란히 놓고 눈으로 확정해야 하는 자리.

## - [ ] L616 — `.hero-art-bg::after`

```css
background: linear-gradient(180deg,
      rgba(5,5,5,calc(0.18 * var(--hero-dim, 1))), …),
    radial-gradient(ellipse at 52% 48%, transparent 0%, rgba(5,5,5,calc(0.42 * var(--hero-dim,1))) 76%);
```

**왜 어려운가** — 관리자 톤 설정(--hero-dim)이 배율로 곱해지는 어둡기 레이어 + backdrop-filter. 색을 토큰화하면 관리자가 저장해 둔 dim 값의 의미(어둡게)가 라이트에서 '밝게'로 바뀌어 기존 설정이 전부 오작동한다.

**해법** — 라이트용은 별도 변수(--hero-wash, 기본 rgba(246,239,226,α))로 분리하고 --hero-dim은 강도 배율로만 계속 쓴다. 즉 색은 테마가 결정, 강도는 관리자가 결정으로 역할을 쪼갠다.

## - [ ] L637 — `.hero-art-tint`

```css
background: var(--hero-tint-color, #8f211d);
  opacity: var(--hero-tint-opacity, 0);
  mix-blend-mode: var(--hero-tint-blend, multiply);
```

**왜 어려운가** — 블렌드 모드까지 관리자 지정 변수다. 다크 기준으로 고른 색+블렌드 조합(예: screen)이 라이트에서는 정반대 결과를 낸다. CSS만으로는 안전한 자동 변환이 없다.

**해법** — 라이트 모드에서는 틴트 기본 blend를 multiply로 강제하고, 관리자 패널에 '라이트/다크 각각의 틴트'를 저장하도록 데이터 모델을 확장하는 것이 정공법. 최소 대응은 라이트에서 틴트 레이어를 opacity:0으로 비활성.

## - [ ] L655 — `.hero-art-frame`

```css
filter: grayscale(0.08) sepia(0.16) saturate(0.98) contrast(0.98) brightness(0.9);
```

**왜 어려운가** — 히어로 배경 사진을 어두운 화면에 앉히려고 brightness를 0.9로 눌러 둔 값. 라이트 페이지에서는 사진만 칙칙하게 가라앉아 보인다. --hero-img-opacity(0.58, 669줄)도 검은 바탕 위 '반쯤 스며든' 전제라 흰 바탕에서는 사진이 하얗게 날아간다.

**해법** — 라이트에서 brightness를 1.0~1.05로 되돌리고 --hero-img-opacity 기본값을 0.78~0.9로 올린다. 두 값 모두 테마 블록에서 오버라이드 가능한 토큰으로 승격.

## - [ ] L703 — `.hero-ink-wash .ink-blob--gold / --ivory`

```css
--ink-peak: 0.12;
  background: radial-gradient(closest-side, rgba(212,160,23,0.82), rgba(33,19,15,0) 72%);
```

**왜 어려운가** — 글로벌 잉크와 같은 발광 전제인데, z-index 1로 비네트 위·콘텐츠 아래에 끼워 넣은 레이어(688줄 주석)라 스크림 처리 방식을 바꾸면 이 레이어의 가시성도 함께 흔들린다. inkBreath 키프레임(731)의 peak/floor opacity도 검은 바탕 기준으로 조율됨.

**해법** — 히어로를 다크 고정으로 결정하면 손대지 않아도 된다. 라이트로 가면 색 반전(먹 번짐)과 --ink-peak 상향(0.12→0.18 수준)을 함께 실측. 키프레임은 공용이므로 값이 아니라 변수로만 조정할 것.

## - [ ] L785 — `.hero-logo-image`

```css
filter: invert(1);
  opacity: 0.86;
```

**왜 어려운가** — 검은 로고 자산을 invert로 흰 로고로 만들어 쓰고 있다. 라이트 배경에서는 흰 로고가 사라진다. 색 토큰 치환으로는 절대 해결되지 않는 필터 기반 자산 변형.

**해법** — 라이트에서는 filter: none으로 원본(검정) 로고를 그대로 노출. 단 히어로 배경이 사진이면 사진 위 대비를 따로 봐야 하므로, 히어로 다크 고정 정책과 함께 결정할 것.

## - [ ] L895 — `.btn-youtube img`

```css
filter: brightness(0) invert(1);
```

**왜 어려운가** — 아이콘을 강제로 흰색으로 칠하는 관용구. 이 버튼 배경이 붉은 그라디언트(878)라 실제로는 두 테마 모두 흰 아이콘이 맞다 — 무심코 토큰화하면 오히려 깨진다.

**해법** — 유지(리터럴 고정) 대상으로 명시적으로 주석을 달아 둘 것. 같은 관용구를 배경이 투명한 자리에 복사해 쓴 곳이 있는지만 별도로 확인.

## - [ ] L978 — `.video-card-info / .video-card-title / .video-card-overlay / .play-icon`

```css
background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
  … color: var(--white);
```

**왜 어려운가** — 유튜브 썸네일 위 스크림+흰 글자. 규칙3에 따라 리터럴 유지가 맞지만, 카드 표면(#1a1a1a, 923)과 보더(rgba(246,239,226,0.1), 924)는 반대로 라이트로 뒤집어야 한다 — 한 컴포넌트 안에서 '뒤집는 부분'과 '고정하는 부분'이 섞여 있어 일괄 치환이 위험한 대표 사례.

**해법** — 카드 껍데기(배경·보더·그림자)만 토큰화하고, 썸네일 위 레이어(overlay·info 그라디언트·title 흰색·play-icon)는 리터럴 그대로 둔다. var(--white)는 #fff 리터럴로 바꿔 토큰 반전 사고를 원천 차단.

## - [ ] L1191 — `.mission-media::after`

```css
background:
    linear-gradient(180deg, rgba(9,7,5,0.1), rgba(9,7,5,0.24)),
    linear-gradient(90deg, rgba(9,7,5,0.42), transparent 58%);
```

**왜 어려운가** — 미션 사진 위 좌측 먹 스크림. 왼쪽 텍스트 컬럼과 사진의 경계를 만드는 장치인데, 라이트에서 사진 배경(#160f0b, 1184)이 밝아지면 스크림만 남아 사진 왼쪽이 검게 물든 것처럼 보인다.

**해법** — 사진 위 오버레이이므로 α를 절반 이하로 줄여 유지하거나(0.42→0.18), 라이트에서는 스크림 방향을 아이보리로 뒤집어 '종이에 얹은 사진'으로 재해석. 표면색(1184)과 함께 한 세트로 다뤄야 한다.

## - [ ] L1200 — `.mission-image`

```css
filter: saturate(0.94) contrast(1.03) brightness(0.95);
```

**왜 어려운가** — 다크 화면에 맞춰 사진을 살짝 눌러 둔 보정. 라이트 배경에서는 이유 없이 어두운 사진이 된다. 색 선언이 아니라 필터라 토큰 치환 대상에서 누락되기 쉽다.

**해법** — 라이트에서 brightness(1) contrast(1)로 되돌리는 오버라이드 한 줄. 같은 패턴을 hero-art-frame(661)과 함께 '이미지 톤 보정' 묶음으로 관리.

## - [ ] L1446 — `.category-card .image-object-content-overlay + .category-title`

```css
background: linear-gradient(to bottom, rgba(12,8,5,0.18) 0%, rgba(12,8,5,0.72) 100%);
  …
.category-title { color: var(--text-color); text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
```

**왜 어려운가** — 카드 사진 위 스크림은 리터럴로 유지해야 하는데, 그 위 제목이 var(--text-color)라 토큰을 뒤집는 순간 '어두운 사진 + 어두운 스크림 위 어두운 글자'가 되어 완전히 읽히지 않는다. 규칙3 위반이 실제로 발생하는 지점.

**해법** — .category-title의 color를 #fff 리터럴로 고정(text-shadow도 유지)하고 오버레이는 손대지 않는다. 같은 형태의 '사진 위 제목'이 다른 카드 컴포넌트에도 있는지 --text-color 사용처를 전수 점검할 것.

## - [ ] L1499 — `.traditional-vertical-text`

```css
color: rgba(224, 184, 79, 0.82);
  text-shadow: 0 1px 18px rgba(0, 0, 0, 0.56);
```

**왜 어려운가** — 금색을 α 0.82로 흐리게 쓴 세로쓰기 텍스트 + 검정 글로우. 밝은 배경에서는 금색 자체가 대비 미달(WCAG AA 불가)이고, 검정 글로우가 후광처럼 지저분하게 남는다.

**해법** — color를 var(--soft-gold-text)로 바꾸고 α를 1로 올린다. text-shadow는 라이트에서 none 또는 rgba(var(--bg-rgb),0.25)로 교체. 배경 이미지(dancheong.png)가 다크 전제 자산이라 라이트 배경과의 경계도 함께 확인 필요.

## - [ ] L1546 — `.footer-logo img (자산: /assets/logo/logo_white.png)`

```css
.footer-logo img {
  height: 40px;
  width: auto;
}
```

**왜 어려운가** — CSS에는 색이 없지만 Footer.tsx가 fallbackSrc="/assets/logo/logo_white.png"로 흰 로고를 박아 둔다(헤더 로고도 동일 계열). 라이트 배경에서 로고가 사라지는데 CSS 인벤토리만 보면 놓친다.

**해법** — 테마별 로고 자산 스위치가 필요하다. ImageObject에 라이트/다크 소스를 함께 주거나, 관리 콘솔의 '로고 변형 선택(화이트/일반)' 기능(3595줄대, 범위 밖)을 공개 사이트 테마와 연동하는 방향으로 설계.

## - [ ] L2696 — `.mobile-language-float`

```css
background:
      linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03)),
      rgba(9, 7, 5, 0.78);
  box-shadow: 0 16px 42px rgba(0, 0, 0, 0.34);
```

**왜 어려운가** — 흰 α 하이라이트 + 먹색 바탕 + backdrop-filter blur(16px)로 만든 유리질 플로팅 칩. 두 레이어의 역할(하이라이트/바탕)이 서로 반대라 각각을 채널 토큰으로 바꾸면 하이라이트와 바탕이 같은 방향으로 뒤집혀 형태가 사라진다.

**해법** — 레이어별로 다른 토큰을 쓴다 — 하이라이트는 rgba(var(--fg-rgb), α), 바탕은 rgba(var(--bg-rgb), 0.78), 그림자는 라이트에서 α를 0.34→0.14로 축소. 모바일 전용 요소라 실기기에서 확인 필요.

## - [ ] L3050 — `.mobile-language-switcher .lang-btn.active`

```css
background: var(--warm-ivory);
color: #090705;
```

**왜 어려운가** — 배경은 뒤집히는 토큰(--warm-ivory → #2c2114, 거의 검정)인데 글자는 하드코딩된 먹색(#090705)이다. 라이트에서 어두운 배경 + 어두운 글자 = 활성 언어 버튼이 통째로 사라진다. 한쪽만 토큰인 '반쪽 치환' 지뢰.

**해법** — 짝을 맞춘다: `background: var(--warm-ivory); color: var(--bg-color);` — 두 값이 항상 반대로 움직인다. 공개 모바일 메뉴 배경 자체가 라이트에서 어떤 색이 될지 먼저 정해야 최종 확정 가능.

## - [ ] L3107 — `.keycode-label / .keycode-label--intl`

```css
.keycode-label { background: rgba(0,0,0,0.75); backdrop-filter: blur(4px); color: #fff; }
.keycode-label--intl { top: -24px; background: rgba(212,160,23,0.9); color: #000; }
```

**왜 어려운가** — 같은 클래스가 두 문맥에 놓인다 — 기본형은 사진 위 배지(리터럴 유지가 정답, backdrop-filter까지 걸림)지만 --intl 변형은 top:-24px로 이미지 밖 페이지 배경 위에 뜬다. 한 규칙으로 처리할 수 없고, blur(4px)는 라이트 배경에서 검정 스크림과 겹쳐 탁한 사각형이 된다.

**해법** — 기본형은 리터럴 고정(치환 금지 주석), --intl 변형만 금색 배경 + var(--on-accent) 글자로 정리. backdrop-filter는 --intl에서 제거.

## - [ ] L3178 — `@keyframes heroArtCycle / heroArtCycleInitial / prefers-reduced-motion 보정`

```css
7% { opacity: var(--hero-img-opacity, 0.58); }
30% { opacity: calc(var(--hero-img-opacity, 0.58) * 0.9); }
```

**왜 어려운가** — 히어로 사진 크로스페이드가 '먹빛 배경 위 58% 불투명도'로 튜닝돼 있다. 종이 배경에서 58%는 사진이 하얗게 날아가 형체가 사라진다. 게다가 이 값은 관리자 톤 설정(D1)에서 주입되는 변수라 CSS에서 하드코딩으로 덮을 수 없고, 폴백만 바꾸면 관리자가 값을 저장한 순간 다시 깨진다.

**해법** — 폴백을 테마별로 분리(라이트 블록에서 `--hero-img-opacity: 0.82` 기본값 재정의)하고, 관리자 톤 설정에 라이트용 값을 별도 필드로 저장하도록 확장. CSS만으로는 완결 불가 — 데이터 스키마 변경이 따라와야 한다.

## - [ ] L3639 — `.image-object-uploading (+ span 3648)`

```css
background: rgba(0, 0, 0, 0.9);
… .image-object-uploading span { color: var(--text-color); }
```

**왜 어려운가** — 이미지 위 업로드 스크림. 배경은 리터럴 검정 90%인데 안내 글자는 토큰이라 라이트에서 먹색이 된다 → 검정 위 먹 글자. 라이트박스와 같은 유형이지만 편집 모드에서만 보여 눈에 안 띄고 지나치기 쉽다.

**해법** — 글자를 리터럴 #f6efe2로 고정하거나, 스크림을 rgba(var(--bg-rgb),0.9)로 채널화해 배경·글자가 함께 뒤집히게 한다(사진을 완전히 덮는 스크림이라 채널화도 허용 가능).

## - [ ] L3661 — `.gallery-page`

```css
background:
  linear-gradient(180deg, #120c09 0%, var(--deep-umber) 34%, var(--soft-umber) 100%);
```

**왜 어려운가** — 갤러리 목록 페이지의 전면 배경이 먹빛 그라디언트다. --deep-umber/--soft-umber는 금색 배경 위 먹 글자로도 쓰이는 팔레트라 전역 플립이 불가능하고(하단 라이트 블록이 .admin-domain을 셀렉터별로 보정한 이유가 정확히 이것), #120c09는 하드코딩 hex다. 토큰 치환으로는 손댈 수 없다.

**해법** — 기존 선례를 그대로 따른다 — 라이트 블록에 `.gallery-page`용 종이 그라디언트를 셀렉터별로 추가(예: linear-gradient(180deg,#f9f4e9,#f1e9d9,#f6f1e6)). 또는 --page-wash-top/mid/bottom 3개 토큰을 새로 만들어 :root(먹)/라이트(종이) 양쪽에 정의.

## - [ ] L3669 — `.gallery-hero`

```css
background:
  linear-gradient(180deg, rgba(8, 5, 4, 0.65), rgba(8, 5, 4, 0.18)),
  radial-gradient(circle at 50% 20%, rgba(224, 184, 79, 0.12), transparent 36%);
```

**왜 어려운가** — 두 겹이 서로 반대 방향으로 깨진다. 위층은 '어둡게 눌러' 히어로를 가라앉히는 스크림이라 종이 위에서는 회색 얼룩이 되고, 아래층 금색 글로우(alpha 0.12)는 밝은 배경에서 완전히 사라진다. 알파를 유지한 채 색만 바꾸면 둘 다 실패.

**해법** — 라이트에서 스크림은 rgba(246,241,230,0.7)→투명(밝게 띄우는 방향으로 반전), 금 글로우는 alpha를 0.12→0.28 정도로 올리고 반경을 줄여 종이 위에서도 후광이 읽히게 재조정. 알파 재조정이 필수라 sed 불가.

## - [ ] L3823 — `금 배경 + color:var(--bg-color) 패턴 (2813, 2960, 3823, 3943)`

```css
.gallery-year-link.active {
  background: var(--accent-color);
  color: var(--bg-color);
}
```

**왜 어려운가** — --accent-color는 라이트에서도 금색을 유지하도록 설계됐는데(의도적), --bg-color는 종이색으로 뒤집힌다. 결과는 금색 배경 위 아이보리 글자 = 대비 붕괴. 범위 내 4곳(편집 토글 활성, 저장 버튼, 활성 연도 칩, featured 배지)에서 반복되며 파일 전체로는 더 많을 것.

**해법** — 고정 잉크 토큰 신설 — `--on-accent: #14100b`을 :root에 두고(라이트에서도 동일) 네 곳의 color를 var(--on-accent)로. 실제로 5390~ 구간 .admin-theme-btn.active가 이미 color:#14100b로 이 해법을 쓰고 있다.

## - [ ] L3836 — `.gallery-main`

```css
background:
  linear-gradient(180deg, rgba(239, 229, 211, 0.06), rgba(239, 229, 211, 0));
```

**왜 어려운가** — 아이보리를 6%만 얹어 본문 영역을 '살짝 들어올리는' 워시다. 종이 배경에서는 아이보리 위 아이보리 = 완전 무효. rgba(var(--ivory-rgb),α)로 바꾸면 라이트에서 먹색이 되는데 alpha 0.06으로는 여전히 보이지 않는다(방향은 맞지만 세기가 틀림).

**해법** — rgba(var(--ivory-rgb), 0.06)으로 채널화하되 라이트 블록에서 `.gallery-main { background: linear-gradient(180deg, rgba(36,27,18,0.035), transparent) }`처럼 알파를 따로 준다.

## - [ ] L3855 — `.gallery-loading-spinner`

```css
border: 3px solid rgba(255, 255, 255, 0.1);
border-top-color: var(--accent-color);
```

**왜 어려운가** — 트랙(흰 10%)과 헤드(금색)의 대비로 회전이 보이는 구조다. 종이 위에서 흰 트랙은 배경과 동화되어 링이 사라지고, 남은 금색 호만 떠다닌다. 하단 라이트 블록이 .admin-spinner-sm의 border-top-color를 따로 보정한 선례가 있다(같은 계열 문제).

**해법** — 트랙을 rgba(var(--fg-rgb),0.12)로 채널화. 단 라이트에서 먹 12%는 다크의 흰 10%보다 세게 보이므로 라이트 블록에서 0.08 정도로 낮추는 미세 조정 권장.

## - [ ] L3902 — `.gallery-event-card`

```css
background: rgba(246, 239, 226, 0.055);
border: 1px solid rgba(246, 239, 226, 0.13);
```

**왜 어려운가** — 카드의 형태 전체가 '먹 위 아이보리 5.5%'라는 극히 얕은 틴트로만 만들어져 있다. 채널 토큰으로 바꾸면 라이트에서 '종이 위 먹 5.5%'가 되는데 이 알파에서는 카드 경계가 뭉개지거나(보더 13%) 반대로 지저분해진다. 갤러리 격자의 핵심 시각 요소라 눈으로 재조정이 필요.

**해법** — rgba(var(--ivory-rgb),α)로 채널화하되 라이트 블록에서 `.gallery-event-card { background: #fbf7ed; border-color: rgba(36,27,18,0.10); }`처럼 불투명 종이 표면 + 실보더로 재해석(하단 라이트 블록의 .photo-drawer 처리 방식과 동일).

## - [ ] L4055 — `.gallery-photo-stream-card / -image`

```css
background: rgba(5, 5, 5, 0.34);
… .gallery-photo-stream-image { background: #111; }
```

**왜 어려운가** — 사진이 로드되기 전/투명 PNG 뒤에 비치는 '바닥'이다. 사진 위 오버레이는 아니지만 사진과 맞닿아 있어서, 종이색으로 바꾸면 세로형 사진의 레터박스가 흰 띠로 튀고 검정으로 두면 라이트 레이아웃에 검은 구멍이 뚫린다. 둘 중 어느 쪽도 자명하지 않다.

**해법** — var(--surface-2)로 통일(다크 #1a1a1a / 라이트 #e9e0cc)해 '들어올린 표면' 의미를 따르게 한다. 4070은 #111 → var(--surface-2). 실사진으로 레터박스 확인 후 확정.

## - [ ] L4103 — `.gallery-photo-stream-meta / meta strong / meta em`

```css
background: linear-gradient(180deg, transparent, rgba(5, 5, 5, 0.82));
… color: rgba(246, 239, 226, 0.86);
… color: rgba(246, 239, 226, 0.56);
```

**왜 어려운가** — 변환하면 안 되는 케이스(역함정). 사진 위 캡션이라 CLAUDE.md 규칙 3에 따라 리터럴을 유지해야 하는데, 값 형태(rgba(246,239,226,α))가 채널 토큰 치환 대상과 똑같이 생겼다. 일괄 치환하면 라이트에서 사진 위 캡션이 먹색이 되어 읽히지 않는다.

**해법** — 치환 금지 주석을 달아 고정(`/* 사진 위 오버레이 — 테마 무관 리터럴 */`). 4534(재생 아이콘 흰 글자), 4554(썸네일 제목 스크림), 4360/4402/4414(라이트박스 백드롭·네비)도 같은 취급.

## - [ ] L4189 — `.gallery-detail-kind`

```css
color: var(--soft-gold);
border: 1px solid rgba(224, 184, 79, 0.42);
```

**왜 어려운가** — 이미 토큰을 쓰고 있어서 '변환 완료'로 보이지만 --soft-gold는 배경용이라 라이트에서 뒤집히지 않는다(설계상 의도). 종이 위 밝은 금색 글자는 대비가 무너진다. 텍스트용 짝 토큰(--soft-gold-text)이 따로 있다는 걸 모르면 스캔에서 걸러지지 않는 조용한 실패.

**해법** — color: var(--soft-gold-text)로 교체(보더는 그대로 유지 — 배경·보더용 금색은 두 테마 모두 선명). 범위 밖에도 같은 오용이 있을 수 있으니 `color: var(--soft-gold)` / `color: var(--accent-color)` 전수 검색 권장.

## - [ ] L4317 — `.gallery-detail-images`

```css
background: rgba(0, 0, 0, 0.3);
```

**왜 어려운가** — 섹션을 '가라앉히는' 표현을 검정 30%로 구현했다. 종이 위에서 검정 30%는 중간 회색 판이 되어 페이지 리듬이 아니라 오염으로 읽힌다. 방향(어둡게)이 라이트에서는 반대(밝게/따뜻하게)가 되어야 하므로 알파 조정만으로 안 된다.

**해법** — 의미 토큰 신설 — `--section-recess: rgba(0,0,0,0.3)`(다크) / `rgba(76,57,32,0.05)` 또는 `#efe7d6`(라이트). 같은 표현이 다른 섹션에도 있을 테니 토큰화가 재사용된다.

## - [ ] L4360 — `.gallery-lightbox 내부 텍스트(4386, 4405, 4448, 4454)`

```css
.gallery-lightbox { background: rgba(0, 0, 0, 0.95); }
.gallery-lightbox-close { color: var(--text-color); }
.gallery-lightbox-counter { color: var(--text-muted); }
```

**왜 어려운가** — 백드롭은 리터럴 검정으로 남겨야 하는데 그 안의 닫기 버튼·화살표·캡션·카운터는 --text-color/--text-muted 토큰을 쓴다. 라이트로 뒤집는 순간 검정 위에 먹색 글자·아이콘이 되어 4개 컨트롤이 통째로 사라진다. 이 구간은 '토큰을 걷어내야' 고쳐지는 유일한 유형.

**해법** — .gallery-lightbox를 다크 섬으로 격리 — `.gallery-lightbox { --text-color: #f6efe2; --text-muted: rgba(246,239,226,0.62); color-scheme: dark; }` 를 선언해 하위가 자동으로 다크 값을 상속하게 한다(셀렉터를 4개 고치는 것보다 안전).

## - [ ] L4555 — `.gallery-video-thumb-title`

```css
background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
color: var(--text-color);
```

**왜 어려운가** — 라이트박스와 같은 토큰/리터럴 불일치가 썸네일 캡션에서 반복된다. 스크림은 사진 위라 검정 유지가 맞고, 글자는 토큰이라 뒤집힌다 → 검정 스크림 위 먹 글자.

**해법** — color를 리터럴 #fff(또는 rgba(246,239,226,0.92))로 고정. 4534의 재생 아이콘 color:white와 짝을 맞춰 '사진 위는 전부 리터럴' 원칙으로 통일.

## - [ ] L5551 — `:root (온보딩 전용 토큰 블록)`

```css
--glow-gold: 0 0 0 4px rgba(212, 160, 23, 0.1), 0 0 24px rgba(212, 160, 23, 0.22);
--done-green: #9ed99e;
```

**왜 어려운가** — 파일 중간에 두 번째 :root가 있어 공개 사이트에도 상속된다. --glow-gold는 어두운 배경 전제의 금색 글로우, --done-green(#9ed99e)은 다크 전용 파스텔이라 라이트 지면에서 대비가 무너진다. 다만 repo 전체 grep 결과 var() 소비처가 0건 — 지금 뒤집기 작업에 넣으면 죽은 코드를 두 테마 분량으로 유지하게 된다.

**해법** — 공개 테마 작업 전에 5551~5556 :root 블록을 통째로 삭제한다(4개 토큰 모두 미사용 확인). 되살릴 경우에만 라이트 대응값을 함께 정의할 것.

## - [ ] L7825 — `.students-page`

```css
background: linear-gradient(180deg, #120c09 0%, var(--deep-umber) 42%, #0a0a0a 100%);
```

**왜 어려운가** — 페이지 전체 지면을 먹빛 3-스톱 그라디언트로 하드코딩했다. #120c09·#0a0a0a는 토큰이 아니고, 중간 스톱 --deep-umber는 '금 배경 위 먹 글자'로도 쓰이는 ink 토큰이라 전역 플립이 불가능하다(관리 콘솔 라이트 블록도 같은 이유로 .admin-domain/.admin-onboard-head를 셀렉터별로 보정했다). 단순 치환 대상이 없어 라이트에서 종이 지면이 만들어지지 않는다.

**해법** — 페이지 지면 전용 토큰을 새로 만든다: :root { --page-ground: linear-gradient(180deg,#120c09 0%,var(--deep-umber) 42%,#0a0a0a 100%) } 후 라이트 블록에서 --page-ground를 종이 그라디언트(예: linear-gradient(180deg,#fbf7ed 0%,#f6f1e6 42%,#f1e9d9 100%))로 재정의. 관리 콘솔의 .admin-domain 보정과 동일한 '표면만 셀렉터/토큰으로 뒤집기' 전략.

## - [ ] L7838 — `.students-hero`

```css
background:
    linear-gradient(180deg, rgba(8, 5, 4, 0.65), rgba(8, 5, 4, 0.18)),
    radial-gradient(circle at 50% 20%, rgba(224, 184, 79, 0.12), transparent 36%);
```

**왜 어려운가** — 검정 스크림(rgba(8,5,4,·))을 위에 겹쳐 히어로를 어둡게 눌러 놓고, 그 위에 금색 라디얼 글로우를 얹는 2겹 구조다. 라이트 지면에서는 검정 스크림이 히어로만 시커멓게 만들고, 반대로 스크림을 지우면 금색 글로우(α 0.12)가 종이 위에서 탁한 얼룩으로 남는다. 사진 위 오버레이가 아니라 순수 장식이라 리터럴 유지도 답이 아니다.

**해법** — 스크림을 rgba(var(--bg-rgb), 0.65) → 0.18로 바꿔 지면색을 따라가게 하고, 금 글로우는 라이트에서 α를 낮추거나(0.12→0.06) 대비를 위해 어두운 금 rgba(158,116,16,·)로 뒤집는 --hero-glow 토큰으로 분리한다. 캘린더의 --cal-*-rgb 쌍 패턴이 참조.

## - [ ] L9898 — `.about-hero`

```css
background:
  radial-gradient(circle at 16% 22%, rgba(224,184,79,0.10), transparent 38%),
  linear-gradient(180deg, #17100d 0%, #271815 100%);
```

**왜 어려운가** — 사진 로드 전 폴백이자 페이드의 기준색. 금색 radial 글로우는 어두운 바탕에서만 '따뜻한 빛'으로 읽히고 밝은 종이 위에서는 누런 얼룩이 된다.

**해법** — 베이스 그라디언트는 위 지역 변수로 통합하고, 금 radial은 라이트에서 opacity를 낮추거나(0.10→0.04) 아예 제거하는 셀렉터 보정을 라이트 블록에 추가.

## - [ ] L9918 — `.about-hero-bg::before`

```css
background: linear-gradient(to bottom, #17100d 0%, #17100d 30%, transparent 100%);
```

**왜 어려운가** — 헤더 아래 사진 상단을 페이지 바탕색(#17100d)으로 녹여 헤더와 사진의 경계를 지우는 페이드. 색이 .about-hero의 배경 하드코드와 짝을 이루므로 한쪽만 바꾸면 이음매에 띠가 생긴다.

**해법** — #17100d를 --about-hero-base 같은 지역 변수로 승격해 .about-hero(9902)·::before·모바일 스크림이 같은 변수를 참조하게 만든 뒤, 라이트 스코프에서 변수 1개만 종이색으로 교체.

## - [ ] L9933 — `.about-hero-bg::after`

```css
background:
  linear-gradient(100deg, rgba(23,14,10,0.96) 0%, … rgba(23,14,10,0.0) 80%),
  linear-gradient(180deg, transparent 42%, rgba(21,16,13,0.92) 100%);
```

**왜 어려운가** — 타임스퀘어 공연 사진 위에 비대칭 대각 umber 스크림을 깔아 좌측 44%를 '읽을 수 있는 어두운 레일'로 만드는 구조. 라이트에서 이 스크림을 밝게 뒤집으면 밝은 사진 위 밝은 스크림이 되어 텍스트가 전부 사라지고, 그대로 두면 종이 톤 페이지에 검은 사각형이 박힌다. 반응형에서 같은 스크림이 10230(≤768)·10306(≤480)에 세로형으로 두 번 더 재정의돼 세 벌을 함께 고쳐야 한다.

**해법** — 사진 위 텍스트 레일은 '테마 무관 리터럴 유지'가 기본. 단 하단 페이드(두 번째 그라디언트)만 페이지 배경과 이어지는 값으로 분리해 --hero-fade-color 같은 변수로 빼고 라이트에서 종이색으로 뒤집는다. 레일 자체를 밝게 하려면 스크림 색을 rgba(var(--bg-rgb), α)로 바꾸고 .about-hero-korean/-founded/-content p 텍스트 색을 같은 블록에서 먹색으로 동시 전환 — 반드시 세 개 미디어쿼리를 한 세트로 처리.

## - [ ] L10018 — `.about-hero-korean`

```css
color: var(--accent-color);     /* #d4a017 — umber 레일 위 약 5.4:1 (AA) */
```

**왜 어려운가** — 배경용 금(--accent-color)을 텍스트로 쓴 사례. 라이트 블록은 배경용 금을 일부러 뒤집지 않으므로 종이 위에서 5.4:1이 2:1대로 떨어진다. 그러나 레일을 어둡게 유지하기로 결정하면 오히려 --accent-text(어두운 금)로 바꾸는 순간 대비가 깨진다 — 상위 레일 결정에 종속된 케이스.

**해법** — 레일 유지 시: 현행 유지 + 주석에 '리터럴 유지' 명시. 레일 종이화 시: var(--accent-text)로 교체하고 .about-director-title-ko(10094)·.feature-eyebrow(10412)·.feature-preview-index(10509)의 var(--soft-gold) 텍스트도 --soft-gold-text로 함께 교체.

## - [ ] L10028 — `.about-hero-founded`

```css
color: rgba(224, 184, 79, 0.82);
```

**왜 어려운가** — 금색을 α로 흐린 '보조 정보' 텍스트. 금색에는 채널 토큰이 없다(--fg-rgb/--ivory-rgb/--bg-rgb만 존재하고 --gold-rgb는 없음). --soft-gold-text는 단색이라 α를 실을 수 없어 기계적 치환이 불가능하며, 주석에 6.5:1이라는 실측 대비가 명시돼 있어 임의 변경 시 접근성 근거가 깨진다.

**해법** — 루트에 --soft-gold-rgb(다크 224,184,79 / 라이트 125,95,11)와 --accent-gold-rgb를 신설해 rgba(var(--soft-gold-rgb), 0.82) 형태로 전환. 이 토큰 하나로 파일 전역의 α-금색 텍스트가 함께 풀린다.

## - [ ] L10058 — `.about-director`

```css
border-top: 2px solid rgba(212,160,23,0.35);
background: radial-gradient(circle at 18% 0%, rgba(224,184,79,0.08), transparent 32%),
            linear-gradient(180deg, var(--ink-umber) 0%, #1e130f 100%);
color: var(--warm-ivory);
```

**왜 어려운가** — --ink-umber는 라이트 블록에서 뒤집히지 않는데 --warm-ivory는 뒤집힌다(#f6efe2→#2c2114). 즉 아무것도 안 해도 라이트에서 '먹색 배경 + 먹색 글자'가 되어 섹션 전체가 통째로 사라진다. 히어로 레일과 '하나의 따뜻한 재질'로 설계돼 있어 히어로와 분리해 결정할 수 없다.

**해법** — 섹션 표면을 종이로 뒤집는다면 background를 라이트 블록에서 linear-gradient(#f9f4e9,#f1e9d9)로 보정(이미 .photo-modal에 쓰인 패턴 재사용)하고 color는 var(--text-color)로. 먹 섹션을 유지한다면 color를 리터럴 #f6efe2로 고정해 토큰 플립을 차단.

## - [ ] L10106 — `.about-director-portrait`

```css
background: rgba(246,239,226,0.06);
border: 1px solid rgba(246,239,226,0.14);
box-shadow: 0 20px 50px rgba(0,0,0,0.28);
```

**왜 어려운가** — '먹 위에 아이보리 매트지 액자'라는 재질 표현. 아이보리 α를 --ivory-rgb로 치환하면 라이트에서 액자가 먹색 테두리가 되는데, 배경(위 케이스에서 종이로 갈지 먹으로 갈지 미정)에 따라 정답이 정반대다. 검정 box-shadow는 종이 위에서도 유효해 함께 바꾸면 오히려 손해.

**해법** — box-shadow는 그대로 두고 background/border만 --ivory-rgb 치환. 단 .about-director 표면 결정 후에 적용하고, 먹 섹션 유지 시에는 리터럴 유지.

## - [ ] L10364 — `.feature-hero (+ -classes/-community/-media 10370·10376·10382)`

```css
background:
  linear-gradient(90deg, rgba(5,5,5,0.98), rgba(5,5,5,0.66) 48%, rgba(5,5,5,0.92)),
  url('/assets/images/perform.png') center / cover no-repeat;
```

**왜 어려운가** — 공연·수업·커뮤니티·미디어 4개 공개 페이지가 공유하는 히어로. 배경사진을 98%까지 눌러 어둡게 만든 뒤 아이보리 대형 타이틀을 얹는 구조라, 라이트에서 스크림만 밝히면 사진 위 밝은 글자가 증발한다. shorthand(background)와 background-image 변형이 섞여 있어 한 곳만 고치면 변형 3개가 원본 사진을 잃는다.

**해법** — 스크림 색을 --hero-scrim(다크 5,5,5 / 라이트에서 필요 시 유지)으로 빼서 4개 규칙이 같은 변수를 쓰게 리팩터 후, 기본은 '사진 위 오버레이=리터럴 유지'로 두고 히어로 타이틀만 리터럴 아이보리로 고정한다(--warm-ivory 토큰 플립 차단).

## - [ ] L10387 — `.feature-hero::after`

```css
background:
  linear-gradient(180deg, rgba(5,5,5,0.3), #090705 100%),
  url('/assets/images/black_stroke.png') center / cover no-repeat;
opacity: 0.42;
```

**왜 어려운가** — 먹 붓질 텍스처 PNG(검은 획 + 투명 배경)를 42% 불투명도로 덧씌워 히어로 하단을 페이지 바탕(#090705)으로 잠그는 장식. 라이트에서는 (a) 하단 잠금색이 종이색이어야 하고 (b) 검은 먹 텍스처는 밝은 배경에서 지나치게 진한 얼룩이 된다 — 색 치환만으로는 둘 다 해결되지 않는다.

**해법** — 그라디언트와 텍스처를 두 개의 의사요소로 분리한 뒤, 잠금 그라디언트만 라이트에서 종이색으로 바꾸고 텍스처는 opacity를 0.42→0.12 수준으로 낮추거나 mix-blend-mode: multiply로 종이 위 먹 번짐처럼 재해석(한지 팔레트와 오히려 잘 맞음).

## - [ ] L10477 — `.feature-action-primary`

```css
color: var(--warm-ivory);
background: linear-gradient(135deg, var(--deep-red), var(--secondary-color));
border: 1px solid rgba(246,239,226,0.18);
```

**왜 어려운가** — 토큰 치환이 문제가 아니라 '이미 있는 토큰 플립이 해를 끼치는' 반대 방향 케이스. 배경은 고정 적색인데 --warm-ivory는 라이트에서 #2c2114(먹)로 뒤집혀 적색 버튼 위 먹 글자가 된다(대비 실패). 같은 함정이 .about-director(10063), .feature-title(10432), .feature-action-secondary(10484)에 반복된다.

**해법** — 고정 배경(적색·금색·사진) 위에 얹힌 전경은 var(--warm-ivory)를 쓰지 말고 리터럴 #f6efe2로 고정. 공개 라이트 도입 전에 이 구간의 var(--warm-ivory) 사용처를 '페이지 바탕 위'(플립 OK)와 '고정 배경 위'(리터럴 고정)로 분류하는 선행 작업 필요.

## - [ ] L10594 — `.section-edit-btn`

```css
color: #f6efe2;
background: rgba(9, 7, 5, 0.72);
border: 1px solid rgba(224, 184, 79, 0.55);
backdrop-filter: blur(6px);
```

**왜 어려운가** — 관리자 편집 모드 컨트롤이지만 렌더 위치가 공개 페이지의 헤더·히어로 사진 위다. 공개 라이트 도입 시 '공개 페이지니까 뒤집자'는 일괄 규칙을 적용하면 밝은 사진 위 밝은 알약이 되어 버튼이 사라진다. backdrop-filter까지 걸려 있어 배경 밝기에 따라 결과가 달라진다.

**해법** — 뒤집지 말 것. 라이트 도입 시 예외 목록에 명시하고(사진 위 오버레이 규칙 3항), 호버의 color:#fff(10626)도 리터럴 유지. 필요 시 border만 밝은 사진 대비를 위해 두께/불투명도를 올리는 정도로 보정.

## - [ ] L10987 — `:root (파일 중간 두 번째 선언)`

```css
:root {
  --hairline-gold: linear-gradient(90deg, rgba(224,184,79,0.08), var(--soft-gold), rgba(224,184,79,0.08));
  --ink-panel: rgba(246, 239, 226, 0.055);
}
```

**왜 어려운가** — 수업·프로그램·캠프 전 구간이 의존하는 표면 토큰이 파일 상단 :root가 아니라 10987행에 따로 선언돼 있다. 라이트 오버라이드 블록(15941~)이 상단 :root만 뒤집는다고 가정하면 이 토큰은 영원히 다크 값으로 남고, 어디서 새는지 추적이 어렵다(구조적 함정).

**해법** — --ink-panel을 상단 :root로 이동시키고 rgba(var(--ivory-rgb), 0.055)로 정의 — 그러면 라이트 플립이 자동 적용된다. --hairline-gold는 배경용 금이라 두 테마 공통으로 유지.

## - [ ] L11013 — `.btn-ink-primary (동일 패턴: .cal-sub-btn--primary 13193, .gallery-cal-btn--primary 13546)`

```css
background: linear-gradient(135deg, var(--deep-red), var(--secondary-color));
  color: var(--warm-ivory);
```

**왜 어려운가** — 배경은 플립하지 않는 붉은 그라디언트인데 전경만 --warm-ivory라서 라이트에서 먹색으로 뒤집힌다 → 붉은 배경 위 검붉은 글자. 같은 실수가 3곳에 복제돼 있고, .gallery-cal-btn--primary(13546)는 color를 재선언하지 않고 base(13533)의 아이보리를 상속하므로 grep으로도 잘 안 잡힌다.

**해법** — '컬러 서피스 위 전경' 역할 토큰을 새로 만든다: :root와 라이트 블록 양쪽에 --on-accent: #f6efe2를 동일 값으로 선언(=플립 안 함). 세 primary 변형의 color를 var(--on-accent)로 교체하고, 상속 케이스인 .gallery-cal-btn--primary에는 color를 명시적으로 재선언한다.

## - [ ] L11038 — `.dancheong-divider`

```css
background-image: linear-gradient(90deg, transparent, var(--accent-color), var(--secondary-color), var(--accent-color), transparent);
  opacity: 0.7;
```

**왜 어려운가** — '유일하게 허용된 모티프'라 공개 페이지 6~7곳(classes-trust, program-section-head, repertoire-head, performance-bridge, notfound)에 재사용된다. 색 토큰은 두 테마 공통이지만 1px + opacity 0.7이 어두운 배경 대비를 전제로 잡힌 값이라 종이 위에서는 금색 구간이 거의 보이지 않는다. 색을 바꾸면 브랜드 모티프가 깨지고, 안 바꾸면 사라진다.

**해법** — 색은 그대로 두고 두께·불투명도만 테마 축으로 뺀다. --divider-opacity(다크 0.7 / 라이트 1) + height를 라이트에서 1.5px로. 금 구간만 라이트에서 --soft-gold-text 쪽으로 살짝 어둡게 섞는 것도 가능하나, 배경용 금 유지 규칙과 충돌하므로 opacity 조정을 먼저 시도할 것.

## - [ ] L11142 — `.camp-spotlight-img / .program-detail-hero-img / .performance-hero-img`

```css
filter: saturate(0.94) contrast(1.03) brightness(0.92);   /* 11142 */
  filter: saturate(0.94) contrast(1.03) brightness(0.9);    /* 11444 */
  filter: saturate(0.92) contrast(1.05) brightness(0.86);   /* 11918 */
```

**왜 어려운가** — 색 선언이 아니라 이미지 필터라 토큰 치환 대상에 안 잡히는데, brightness를 0.86~0.92로 눌러 어두운 페이지와 사진의 밝기를 맞춘 다크 전용 튜닝이다. 종이 배경에서 히어로 사진만 계속 어둡게 눌리면 이질감이 크고, 그 위 스크림까지 겹치면 사진이 뭉개진다.

**해법** — 세 값을 --hero-img-filter 토큰 하나로 뽑고 라이트 블록에서 brightness를 1.0 근처(예: saturate(0.98) contrast(1.02) brightness(0.98))로 재정의한다. 스크림 알파도 같은 축으로 --hero-scrim-alpha를 두어 라이트에서 낮춘다.

## - [ ] L11149 — `.camp-spotlight-overlay vs .camp-spotlight--no-image`

```css
radial-gradient(120% 120% at 85% 20%, rgba(212, 160, 23, 0.14), transparent 55%),
    linear-gradient(180deg, rgba(9, 7, 5, 0.55) 0%, rgba(9, 7, 5, 0.2) 35%, rgba(9, 7, 5, 0.82) 100%);
```

**왜 어려운가** — 같은 컴포넌트가 사진이 있으면 '사진 위 스크림'(프로젝트 규칙상 리터럴 유지), 없으면 11152~11155의 --no-image 배경이 '페이지 배경'(플립 필수)이 된다. 한 셀렉터 그룹 안에서 유지/플립이 갈리는데다, 그 위 텍스트(11185 title=--warm-ivory, 11216 camp-fact-value=--warm-ivory, 11192 lede=rgba(246,239,226,.82))는 두 경우 모두 같은 값을 쓰고 있어 어느 쪽을 기준으로 잡아도 한쪽이 깨진다.

**해법** — 컴포넌트에서 이미지 유무를 이미 클래스로 구분하고 있으니 그 축을 색에도 적용한다. (1) .camp-spotlight-overlay와 그 위 텍스트는 전부 리터럴(흰/아이보리 #f6efe2, 금 #e0b84f)로 고정, (2) .camp-spotlight--no-image 아래에서만 배경을 --bg-color/--surface-2 계열로 플립하고 텍스트를 --text-color/--soft-gold-text로 되돌리는 후손 셀렉터를 추가한다. 같은 패턴을 .performance-hero(11920)·.program-detail-hero(11446)에도 그대로 적용.

## - [ ] L11326 — `.program-card-placeholder (동일: .performance-card-placeholder 12020, .notfound-eyebrow 12161, .myclass-card-noimg 13632)`

```css
color: rgba(224, 184, 79, 0.35);
```

**왜 어려운가** — 금색을 '알파 낮춘 텍스트'로 쓴 케이스. 프로젝트 규칙상 텍스트 금색은 --soft-gold-text로 가야 하는데 이 토큰은 단색 hex(#7d5f0b)라 알파 채널이 없다. rgba를 그대로 두면 종이 위에서 밝은 금 35%가 완전히 안 보이고, --soft-gold-text로 바꾸면 알파가 사라져 다크에서 너무 튄다.

**해법** — --soft-gold-text-rgb 채널 토큰을 추가한다(다크 224,184,79 / 라이트 125,95,11). 네 곳을 rgba(var(--soft-gold-text-rgb), α)로 교체하고 라이트에서는 알파를 조금 올린다(0.35 → 0.5).

## - [ ] L11327 — `.program-card-placeholder / .performance-card-placeholder (12021)`

```css
background:
    radial-gradient(120% 120% at 50% 0%, rgba(212, 160, 23, 0.08), transparent 60%),
    linear-gradient(160deg, var(--soft-umber), var(--ink-black));
```

**왜 어려운가** — 이름·위치(사진 자리, position:absolute inset:0)만 보면 '미디어 위 오버레이'로 분류돼 리터럴 유지 판정을 받기 쉽지만, 실제로는 사진이 없을 때만 나타나는 '표면'이라 플립 대상이다. 판정을 한 번 틀리면 라이트 카드 그리드 안에 검은 사각형이 그대로 남는다.

**해법** — 플레이스홀더 계열(.program-card-placeholder, .performance-card-placeholder, .myclass-card-noimg 배경)을 미디어 오버레이 목록에서 명시적으로 제외하고 var(--surface-2) 기반 그라디언트로 교체한다. 금색 radial 틴트는 알파만 라이트에서 0.08 → 0.14로 올린다.

## - [ ] L11341 — `.program-card-type / .program-card-type-camp`

```css
background: rgba(9, 7, 5, 0.6);
  border: 1px solid rgba(224, 184, 79, 0.5);
  color: var(--soft-gold);
  backdrop-filter: blur(4px);
```

**왜 어려운가** — 카드 썸네일 사진 '위에' 떠 있는 배지라 규칙상 리터럴 유지 대상인데, 글자색만 플립 토큰이다. 게다가 backdrop-filter: blur(4px)가 밑의 사진을 흐리는 방식이라 배경 알파를 낮추거나 색을 뒤집으면 배지 자체가 사라진다. 짝인 -camp 변형은 #f0c8a0라는 다크 전용 파스텔.

**해법** — 배지 전체를 미디어 오버레이로 확정한다: background/border는 현행 리터럴 유지, color를 var(--on-media-accent)(위 5번 하드케이스에서 만든 비플립 금)로 교체, #f0c8a0도 그대로 리터럴 유지. 라이트 블록에는 이 셀렉터에 대한 보정을 '넣지 않는다'는 주석을 함께 남길 것.

## - [ ] L11511 — `.program-facts-card { background: var(--ink-panel) }`

```css
background: var(--ink-panel);
  /* 정의: 10989줄, 파일 중간의 두 번째 :root 안 */
  /* --ink-panel: rgba(246, 239, 226, 0.055); */
```

**왜 어려운가** — --ink-panel은 파일 상단 토큰 블록이 아니라 CLASSES 섹션 앞의 별도 :root(10987~10990)에 선언된 리터럴 아이보리-알파 표면이다. 라이트 블록은 상단 토큰만 뒤집으므로 이 토큰은 손이 안 닿고, '토큰을 쓰고 있으니 안전하다'고 오판하기 쉽다. 같은 :root의 --hairline-gold도 동일 문제.

**해법** — 두 토큰을 상단 :root로 옮기고 --ink-panel을 rgba(var(--ivory-rgb), 0.055) 채널 형태로 바꾼다(그러면 라이트에서 먹 틴트 표면이 되어 자동 성립). --hairline-gold는 금색이라 유지해도 되지만 라이트에서 시인성이 떨어지므로 알파 0.08 → 0.2 정도로 올리는 라이트 보정을 함께 넣는다.

## - [ ] L11552 — `.register-panel / .register-field input / .register-consent label`

```css
background: var(--warm-ivory);
  color: var(--ink-black);
  box-shadow: 0 34px 88px rgba(0, 0, 0, 0.34);
```

**왜 어려운가** — 이 구간에서 유일하게 '의도적으로 반전된 라이트 카드'다(주석도 the one ivory moment). --warm-ivory는 라이트에서 #2c2114(먹)로 뒤집히는데 글자색 --ink-black은 안 뒤집혀서, 라이트 모드에선 어두운 카드 위 어두운 글자가 된다. 게다가 내부에 background:#fff(11606), 갈색 하드코딩 #5a4a3a(11567,11687)·#3a2e22(11594)·#4a3c2e(11642), rgba(9,7,5,.16) 보더(11607), 그 안에 다시 rgba(212,160,23,.18)+deep-red 성공 마크(11672~11675)까지 중첩돼 있다. 토큰 치환으로는 어느 방향으로도 성립하지 않는다.

**해법** — 이 패널을 '종이 카드' 전용 로컬 스코프로 재선언한다. 패널 루트에서 --warm-ivory/--ink-black을 쓰지 말고 --paper-surface/--paper-ink 같은 비플립 리터럴 지역 변수(다크·라이트 동일값 #f6efe2 / #241b12)를 선언하고 내부 선언들이 그것만 참조하게 바꾼다. 갈색 하드코딩 3종은 --paper-ink의 알파 단계(0.72/0.86)로 통일. 그림자는 rgba(76,57,32,α) 온기 그림자로(라이트 블록의 .admin-sheet 보정과 같은 방식).

## - [ ] L11699 — `.classes-loading-hero / .classes-loading-card + @keyframes skeletonShimmer`

```css
background: linear-gradient(110deg, var(--ink-umber), var(--soft-umber), var(--ink-umber));
  background-size: 200% 100%;
  animation: skeletonShimmer 1.4s ease-in-out infinite;
```

**왜 어려운가** — 애니메이션이 background-position을 움직이는 방식이라 '색'이 아니라 '그라디언트 전체'가 테마 자산이다. ink-umber↔soft-umber 대비(먹 위 살짝 밝은 먹)는 라이트에서 종이 위 어두운 덩어리가 되고, 단순 반전은 대비 방향이 뒤집혀 시머가 어색해진다.

**해법** — --skeleton-base / --skeleton-highlight 토큰 쌍을 만들고 그라디언트를 linear-gradient(110deg, var(--skeleton-base), var(--skeleton-highlight), var(--skeleton-base))로 재작성. 다크=#15100d/#2a1a14, 라이트=#e9e0cc/#f6f1e6(--surface-2/--bg-color 재사용 가능). 키프레임은 그대로 둔다.

## - [ ] L11850 — `.performances-hero (동일 리터럴: .timeline-hero 13765)`

```css
linear-gradient(180deg, rgba(8, 5, 4, 0.65), rgba(8, 5, 4, 0.18)),
    radial-gradient(circle at 50% 20%, rgba(224, 184, 79, 0.12), transparent 36%);
```

**왜 어려운가** — rgba(8,5,4,α)는 --ink-black(#090705)도 --bg-rgb(10,10,10)도 아닌 제3의 먹 리터럴이고, 같은 2줄이 timeline-hero(13764~13766)에 그대로 복제돼 있다. 파일 전체에 이 '표준 히어로 워시' 복제본이 더 있을 가능성이 높아 개별 치환하면 반드시 몇 개를 놓친다.

**해법** — --hero-wash 라는 합성 배경 토큰 하나로 승격시켜 두 곳(및 나머지 복제본)을 background: var(--hero-wash)로 통일한 뒤, 라이트 블록에서 토큰 하나만 종이 워시로 재정의한다. 치환 전에 rgba(8, 5, 4 로 전수 grep 필수.

## - [ ] L12026 — `.performance-card-scrim / .performance-card-caption`

```css
background: linear-gradient(180deg, rgba(9, 7, 5, 0) 35%, rgba(9, 7, 5, 0.82) 100%);
  /* 위에 얹히는 캡션: .performance-card-meta color:var(--soft-gold) 12045,
     .performance-card-title color:var(--warm-ivory) 12053 */
```

**왜 어려운가** — 규칙상 사진 위 스크림은 리터럴 검정을 유지해야 하는데, 그 스크림 위에 놓이는 캡션 텍스트가 플립 토큰(--warm-ivory, --soft-gold)이다. 스크림만 유지하면 라이트에서 검은 스크림 위 먹색 제목이 되어 완전히 사라진다. 호버 상태(12029~12031)에서 스크림이 더 짙어지는 것도 같이 고려해야 한다.

**해법** — '미디어 위 텍스트' 역할 토큰을 도입해 스크림과 캡션을 한 묶음으로 비플립 처리한다. --on-media: #f6efe2, --on-media-accent: #e0b84f 를 :root와 라이트 블록에 같은 값으로 선언하고, .performance-card-caption 이하 전부를 그 토큰으로 교체. 같은 처리가 필요한 곳: .performance-hero-title/meta(11946·11953), .program-card-type(11343).

## - [ ] L12110 — `.notfound::before`

```css
.notfound::before {
  position: fixed;
  background:
    radial-gradient(60% 55% at 50% 42%, rgba(9, 7, 5, 0.82), rgba(9, 7, 5, 0.5) 55%, rgba(9, 7, 5, 0) 100%);
```

**왜 어려운가** — 전역 먹(ink) 앰비언트 레이어(z-index:0) 위에 뷰포트 전체를 덮는 검정 비네트를 깔아 가독성을 만드는 구조다. 색만 반전하면 종이 위에 흰 비네트가 되어 아무 효과가 없고, 그대로 두면 라이트 모드에서 화면 중앙이 새까맣게 된다. 아래 글로벌 잉크 레이어가 라이트에서 어떻게 되는지에 종속돼 있어 단독으로 못 고친다.

**해법** — 글로벌 잉크 앰비언트 레이어의 라이트 대응을 먼저 정하고, 이 비네트는 rgba(var(--bg-rgb), α) 채널 토큰으로 바꾼다(다크=먹 비네트, 라이트=종이 비네트로 자동 전환). 대비가 부족하면 라이트에서만 --notfound-vignette-alpha를 낮추고 대신 .notfound-text의 대비를 올린다.

## - [ ] L12147 — `.notfound-code`

```css
color: var(--warm-ivory);
  text-shadow: 0 2px 40px rgba(224, 184, 79, 0.18);
```

**왜 어려운가** — 큰 숫자 뒤에 깔린 금색 글로우. 어두운 배경에서만 '빛'으로 읽히고, 종이 배경에서는 글자 주변이 누렇게 번진 얼룩이 된다. 색을 바꿔서 해결되는 게 아니라 효과 자체가 다크 전용이다.

**해법** — --code-glow 토큰으로 빼서 라이트에서는 none으로 끄거나, 아주 옅은 먹 그림자(0 2px 24px rgba(36,27,18,0.10))로 대체한다. 12150~12153의 .notfound-code b { color: var(--soft-gold) }는 --soft-gold-text로 함께 교체.

## - [ ] L12534 — `.dash-badge (동일 오타: 14549, 15231)`

```css
background: var(--color-secondary, #c4302b);
```

**왜 어려운가** — --color-secondary 는 파일 어디에도 정의돼 있지 않다(실제 토큰명은 --secondary-color). 항상 폴백 #c4302b로만 그려지고 있어서, 토큰 기반으로 라이트 대응을 넣는 어떤 작업도 이 세 곳에는 도달하지 못한다. 결과는 우연히 두 테마 모두 붉은 배지라 지금은 안 드러나지만, 브랜드 색을 바꾸는 순간 여기만 안 따라온다.

**해법** — 세 곳 모두 var(--secondary-color)로 정정한다(폴백 제거). 라이트 대응 작업과 별개로 지금 고쳐두는 편이 안전하고, 고친 뒤 붉은 배지 위 color:#fff(12535)는 비플립이 맞으므로 그대로 둔다.

## - [ ] L12855 — `.rsvp-desc (동일: .legal-section p 13098, .legal-section li 13113)`

```css
color: rgba(240, 234, 224, 0.85);
```

**왜 어려운가** — --ivory-rgb는 246,239,226인데 여기는 240,234,224라는 다른 아이보리 리터럴이다. rgba(246, 239, 226 만 찾아 치환하는 스크립트는 이 3곳(본문 장문 텍스트라 가장 눈에 띄는 자리)을 통째로 놓치고, 라이트에서 종이 위 흰 글자로 남는다.

**해법** — 치환 전에 rgba(2[34][0-9], 로 넓게 grep해 아이보리 변종을 전수 목록화한 뒤 전부 rgba(var(--ivory-rgb), α)로 통일한다. 알파는 0.85 → 라이트에서 0.82 정도로 유지해도 대비가 선다.

## - [ ] L13757 — `.timeline-page`

```css
background:
  linear-gradient(180deg, #120c09 0%, var(--deep-umber) 34%, var(--soft-umber) 100%);
```

**왜 어려운가** — 페이지 전면 먹 그라디언트. #120c09 리터럴 + --deep-umber/--soft-umber는 다크 전용 팔레트라 토큰만 뒤집어선 '종이' 느낌이 안 나온다. 라이트에선 세로 그라디언트 자체의 역할(위=짙게 가라앉음)이 반대가 되어야 한다.

**해법** — --page-wash-top/--page-wash-mid/--page-wash-bottom 같은 페이지 배경 토큰 3개를 :root(다크)와 라이트 블록에 각각 정의하고 여기선 토큰만 참조. 라이트 값은 admin light의 한지 팔레트(#f9f4e9→#f1e9d9 계열) 재사용.

## - [ ] L13765 — `.timeline-hero (동일 관용구: 14270 .glossary-hero, 15273 .media-hero)`

```css
background:
  linear-gradient(180deg, rgba(8, 5, 4, 0.65), rgba(8, 5, 4, 0.18)),
  radial-gradient(circle at 50% 20%, rgba(224, 184, 79, 0.12), transparent 36%);
```

**왜 어려운가** — 공개 히어로 3곳이 공유하는 '먹 스크림 + 금 후광' 관용구. rgba(8,5,4,α)를 rgba(var(--bg-rgb),α)로 바꾸면 라이트에서 크림이 크림 위에 깔려 스크림이 사라지고, 금 radial도 밝은 바탕에서 뿌옇게 번진다.

**해법** — 히어로 워시를 --hero-scrim(다크: rgba(8,5,4,α) / 라이트: rgba(36,27,18,0.06~0.02) 먹 틴트)와 --hero-halo(라이트에선 알파 0.12→0.20 상향 또는 secondary 계열로 교체) 두 토큰으로 추출해 3개 히어로가 공유.

## - [ ] L13895 — `.timeline-node span`

```css
box-shadow: 0 0 12px rgba(212, 160, 23, 0.55);
```

**왜 어려운가** — 어두운 바탕에서 '빛나는 점'으로 읽히는 금색 글로우. 밝은 종이 위에서는 발광이 아니라 노란 얼룩/번짐으로 보인다(가산 광원 가정이 깨짐).

**해법** — 라이트에선 글로우를 끄고 링으로 대체 — box-shadow: 0 0 0 3px rgba(212,160,23,0.28). 값은 --node-glow 토큰으로 분리.

## - [ ] L13993 — `.timeline-event-card-kind (동일 계열 6건: 14433, 14454, 14542, 14638, 14677, 14725)`

```css
color: var(--soft-gold);
```

**왜 어려운가** — 개별로는 쉬운 치환이지만, 공개 페이지 전반에 '금색을 텍스트로' 쓰는 자리가 7곳 흩어져 있고 배경용 금색과 같은 토큰을 공유한다. 한 곳이라도 놓치면 라이트에서 크림 위 밝은 금 = 판독 불가(WCAG 실패)로 남는다.

**해법** — 이 7곳을 var(--soft-gold-text)로 일괄 교체하고, 이후 grep으로 'color: var(--soft-gold)' / 'color: var(--accent-color)'가 공개 CSS에 남아 있지 않은지 회귀 검사(다만 --accent-color는 라이트에서도 유지 가능한지 대비 측정 후 결정).

## - [ ] L14120 — `.event-location-attribution`

```css
color: rgba(20, 20, 20, 0.75);
background: rgba(255, 255, 255, 0.82);
```

**왜 어려운가** — 지도 타일(이미지) 위에 얹히는 라벨. 사진·영상 오버레이 규칙과 동일하게 리터럴을 유지해야 하는데, rgba(255,255,255,α) 일괄 치환 스크립트가 가장 먼저 잡아먹을 자리다.

**해법** — 변환 금지. 해당 선언에 '지도 타일 위 — 테마 무관 리터럴' 주석을 달아 일괄 치환에서 제외.

## - [ ] L14257 — `.glossary-page`

```css
background: linear-gradient(180deg, #120c09 0%, var(--deep-umber) 42%, #0a0a0a 100%);
```

**왜 어려운가** — timeline-page와 같은 문제이면서 stop이 다르다(#0a0a0a로 끝남). 페이지마다 손으로 다른 먹 그라디언트를 갖고 있어 개별 대응하면 라이트에서 페이지 간 색이 어긋난다.

**해법** — 위 --page-wash-* 토큰 세트를 공용 유틸 클래스(.page-wash)로 승격하고 timeline/glossary/media가 모두 그 클래스를 쓰게 통합.

## - [ ] L14317 — `.glossary-search`

```css
background: linear-gradient(180deg, rgba(10, 8, 6, 0.96) 70%, rgba(10, 8, 6, 0));
```

**왜 어려운가** — sticky 검색바가 스크롤되는 콘텐츠를 가리기 위해 '페이지 배경색으로 페이드아웃'하는 패턴. 값이 --bg-color(#0a0a0a 계열)도 아니고 페이지 그라디언트 중간값을 눈대중으로 박아둔 것이라, 라이트 팔레트에선 어떤 토큰으로도 자동 대응되지 않는다.

**해법** — 페이지 배경 토큰이 생긴 뒤 rgba(var(--page-wash-mid-rgb), 0.96)로 참조하거나, 그라디언트 대신 background: var(--bg-color) + backdrop-filter: blur(8px)로 교체해 두 테마 모두에서 성립시킨다.

## - [ ] L14739 — `.song-refrain-tag (동일: 14946 .supply-badge-req)`

```css
color: #fff;
background: rgba(196, 48, 43, 0.7);
```

**왜 어려운가** — 반투명 빨강(α 0.7)이라 바탕색이 섞인다. 다크에선 어두워져 흰 글자 대비가 서지만, 크림 바탕에선 분홍빛으로 떠서 흰 글자가 읽히지 않는다.

**해법** — 불투명 색으로 고정: background: var(--color-secondary, #c4302b) (라이트에선 #a02520 계열로 살짝 낮춤) + color: #fff 유지. 알파 배지는 두 테마 공존이 불가능.

## - [ ] L15323 — `.media-main`

```css
background:
  linear-gradient(180deg, rgba(239, 229, 211, 0.06), rgba(239, 229, 211, 0));
```

**왜 어려운가** — 어두운 바탕을 위에서 살짝 '들어올리는' 아이보리 워시. 라이트에선 크림 위 크림이라 완전히 사라지고, --fg-rgb로 바꾸면 반대로 상단이 탁해진다(방향이 뒤집혀야 함).

**해법** — 라이트에서는 그라디언트를 제거하거나 rgba(var(--fg-rgb), 0.035)→0 방향으로 뒤집는 별도 선언. 워시를 --section-lift 토큰(다크: 아이보리 α / 라이트: 먹 α)으로 추출.

## - [ ] L15350 — `.media-filter-tab.is-active (동일: 15533 .media-load-more-btn:hover, 15654 .news-detail-link-btn)`

```css
color: var(--bg-color);
background: var(--accent-color);
```

**왜 어려운가** — '금 배경 위 배경색 글자' 관용구. --bg-color가 라이트에서 크림(#f6f1e6)으로 뒤집히면 금색 배경 위 크림 글자가 되어 글자가 사라진다. 금 배경은 두 테마 유지가 원칙이므로 전경만 따로 잡아야 한다. (관리 콘솔의 15715·15860에서 이미 같은 방식으로 깨져 있음 — 기존 버그의 증거.)

**해법** — 금 배경 칩의 전경을 리터럴 먹으로 고정: color: #1a1206 (이 파일의 .glossary-chip.is-active·.comment-badge가 쓰는 값과 통일). 또는 --on-gold 토큰을 만들어 두 테마 모두 #1a1206으로 고정.

## - [ ] L15380 — `.news-card-image (동일: 15626 .news-detail-image)`

```css
background: #1a1a1a;
```

**왜 어려운가** — 이미지 로딩 전/투명 PNG 뒤에 보이는 플레이스홀더. 라이트에서 카드 안에 검은 사각형이 번쩍인다(LCP 전 깜빡임). 반대로 --surface-2로 바꾸면 다크에서 카드보다 밝아져 사진 경계가 어색해진다.

**해법** — --media-placeholder 토큰 신설(다크 #1a1a1a / 라이트 #e9e0cc)로 참조. 13952 .timeline-event-card-image의 rgba(0,0,0,0.25)도 같은 토큰으로 통일.

## - [ ] L15424 — `.news-card-play`

```css
color: #fff;
background: rgba(8, 5, 4, 0.62);
border: 1px solid rgba(255, 255, 255, 0.35);
```

**왜 어려운가** — 썸네일 이미지 위 재생 버튼. 이미지 위 오버레이는 테마 무관 리터럴 유지 대상인데 rgba(255,255,255,0.35)가 일괄 치환 대상 패턴과 정확히 일치한다. 같은 함정이 15408 .news-card-badge에도 있다.

**해법** — 변환 금지 + '썸네일 위 오버레이 — 리터럴 유지' 주석. 치환 스크립트는 .news-card-play/.news-card-badge/.event-location-attribution을 제외 목록에 넣을 것.

## - [ ] L15606 — `.news-detail-video (동일: 14663 .song-video)`

```css
background: #000;
```

**왜 어려운가** — 유튜브 iframe 레터박스 바탕. 영상 프레임과 이어져야 하므로 두 테마 모두 검정이 정답이다 — 라이트 변환 시 '검정 배경 = 다크 잔재'로 오인해 바꾸기 쉬운 자리.

**해법** — 유지. '영상 레터박스 — 테마 무관' 주석만 추가.

