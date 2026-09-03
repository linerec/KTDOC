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

## 이벤트 목록 조회 — 필터가 아니라 '관점'을 쓴다

이벤트(공연·학내 행사) 목록을 조회할 때 `getEvents({...})`로 필터를 **직접 조립하지
말고** `lib/d1/eventViews.ts`의 관점 함수를 쓴다:

- `publicPerformances()` — /performances. 학내 행사 제외, **예정 공연 포함**
- `publicArchive()` — /gallery. 종류는 방문자가 고르고, 이상한 값은 무시
- `allKindsChronological()` — /timeline·캘린더 피드. **종류를 섞는 것이 의도**
- `memberLibrary({ canSeeUnpublished })` — 회원 둘러보기·캘린더. 종류를 섞고,
  비공개 노출 판단이 여기 한 곳에 있다
- `adminAllEvents()` — 운영 화면. 게시·미게시 전부

**왜**: 필터를 화면마다 조립하다 조건이 빠져도 아무도 몰랐다. 실제로 상세 페이지의
이전/다음에 `kind` 조건이 없어서 공연을 보다 학내 행사로 넘어가는데 그 행사는 정작
/performances에는 없는 상태가 있었다. 관점 함수는 "누가 무엇을 보는 자리인가"를
이름으로 말하고 근거를 주석에 남긴다. 의도는 `eventViews.test.ts`가 잠근다.

여기 없는 관점이 필요하면 새 관점이므로 이 파일에 추가하고 근거를 적을 것.
개수만 필요한 통계 질의는 관점이 아니다(원시 필터 + 이유 주석).

## 수업 반복 일정 — "이 날 수업이 있나"는 한 함수만 답한다

수업 시간표는 **두 벌**로 저장된다. 사람이 읽는 자유 텍스트(`schedule_ko`/`en`)와
캘린더가 읽는 구조 데이터(`weekdays`·`week_ordinals`·시간·학기 기간·예외 날짜)다.
공개 `/classes`는 자유 텍스트를, 회원 캘린더·'내 수업' 카드는 구조 데이터를 읽는다.

**두 벌이 어긋나면 아무도 모른다.** 성인반·청소년 고급반은 격주(매월 둘째·넷째 주)인데
구조 데이터가 "매주 ○요일"밖에 표현하지 못해 캘린더에 없는 수업이 매달 4건씩 떴다.
운영진은 자유 텍스트에 "둘째·넷째 주"라고 고쳐 적었지만 캘린더는 그 글자를 읽지 않는다.
**사람이 아는 것을 시스템이 표현할 수 없으면, 사람은 메모에 적고 그 메모는 힘이 없다.**

규칙:

1. **판정은 `lib/programSchedule.ts`의 `classMeetsOn` 하나뿐이다.** 캘린더 전개
   (`expandClassesForMonth`)·편집 화면 미리보기(`classDatesInMonth`)가 전부 이걸 지난다.
   화면에서 요일을 다시 세지 말 것 — 두 벌이 되면 어긋나고, 어긋난 쪽은 늘 "수업 있음"
   쪽이다(없는 수업을 보고 학원에 오는 일이 실제로 있었다).
2. **주기는 '14일 간격'이 아니라 '몇 째 주'다**(`week_ordinals`, 1~5). 학원이 그렇게
   말하기 때문이다("2번째·4번째 일요일", "3주차·4주차"). 일요일이 다섯 번인 달에서
   14일 간격은 학원 달력과 어긋나기 시작한다. 주차는 `Math.floor((일-1)/7)+1`.
3. **예외는 날짜로 적는다**(`skip_dates`/`extra_dates`). "이번 달만 3·4주" = 둘째 주를
   빼고 셋째 주를 넣는 두 줄. 휴강·보강도 같은 장치다. `extra_dates`는 학기 기간 밖이어도
   살아 있다 — 사람이 직접 적은 날짜를 조용히 삼키지 않는다.
4. **`week_ordinals`를 건드리면 `lib/programText.ts`의 `formatClassSchedule`도 같이 본다.**
   여기가 뒤처지면 캘린더는 "9/12, 9/26"인데 카드는 "매주 토"라고 말한다 — 같은 병이
   자리만 옮긴 것이다. 의도는 `programSchedule.test.ts`·`programText.test.ts`가 잠근다.
5. **새 반복 규칙(예: 홀수 주, 마지막 주)이 필요하면 규칙 자체를 늘리기 전에 예외 날짜로
   되는지 본다.** 규칙이 늘수록 편집 화면에서 확인이 어려워지고, 확인이 어려우면 다시
   자유 텍스트에 적히기 시작한다.

## 신청서를 고칠 때 — '대신 입력'이 따라오는 곳과 아닌 곳

신청서(`/f/[slug]`)에는 **쌍둥이**가 있다. 운영진이 전화·카톡·종이로 받은 신청을
대신 넣는 `/admin/forms/[id]/responses/new` 다. 둘은 같은 스키마·같은 렌더러·같은
검증·같은 저장을 쓴다.

**따라서 문항을 고치는 일은 대개 대신 입력을 건드릴 필요가 없다.** 문항 추가·삭제,
선택지 CRUD, 조건부 노출, 필수 여부, 순서 — 전부 자동으로 반영된다. 그것이 이
구조의 값이다. "신청서를 고쳤으니 대신 입력도 고쳐야 하나"의 기본 답은 **아니오**다.

갈라지는 자리는 넷뿐이고, 각각 무엇이 지키는지가 다르다:

| 갈라지는 자리 | 무엇이 잡아 주나 |
|---|---|
| **코어 bind 추가**(`CORE_BIND_KEYS`) — 회원을 골랐을 때 새 칸을 채울지 | **타입**. `lib/forms/staffEntry.ts`의 `staffEntryPrefill`이 `Record<CoreBindKey, string>`이라 빌드가 막힌다 |
| **비워도 되는 문항**(대리 입력은 이메일을 봐준다) | **시험**. `isOptionalInStaffEntry` 하나를 화면·서버가 같이 본다. 어긋나면 `staffEntry.test.ts`가 실패 |
| **제출 이후 단계**(확인 메일·통지·자동 계산…) | **아무것도 못 잡는다.** 두 라우트 머리말의 '쌍둥이' 주석이 전부다 — 공개 제출에 단계를 더하면 반드시 대리 입력에도 필요한지 판단할 것 |
| **접수 게이트**(마감·로그인·임시 게시) | 없음. 대리 입력은 **일부러 통과**한다(마감 뒤 전화 신청이 실제로 온다). 새 게이트를 만들면 그때 정할 것 |

규칙:

1. **`app/api/forms/[slug]/submit`을 고쳤으면 `app/api/admin/forms/[id]/responses`를
   열어 보라.** 문항이 아니라 **단계**를 고쳤을 때다. 결론이 "대리 입력엔 필요 없다"
   여도 좋다 — 판단했다는 사실을 주석으로 남기면 다음 사람이 다시 고민하지 않는다.
2. **대리 입력만의 규칙은 `lib/forms/staffEntry.ts`에 둔다.** 화면과 서버 두 곳에
   같은 판단을 흩어 놓지 않는다. 흩어지면 "비워 두셔도 됩니다"라고 써 놓고 버튼이
   막는 화면이 된다(실제로 그랬다).
3. **회원 검색은 `lib/forms/memberSearch.ts` 하나뿐이다.** 상세의 연결과 대리 입력의
   고르기가 다른 집합을 보면 운영진은 어느 쪽을 믿을지 알 수 없다.
4. 신청서 관련 변경 뒤에는 `npm test`(스키마·대리 입력 계약)를 돌린다. 흐름 전체를
   보려면 `npm run test:forms` — **버리는 시험 신청서**를 세워 진짜 제출을 던지고
   끝에 지운다(운영 신청서는 건드리지 않는다).

## 파일 업로드 — 브라우저에서 R2로 직행한다 (Vercel을 지나지 않는다)

**Vercel 함수의 요청 본문 한도는 4.5MB이고, 유료 플랜도 같다.** 파일을 우리 API로
보내던 시절에는 폰 사진 한 장(5MB)이나 작은 사진 서너 장이 한 요청에 묶이는 것만으로
413이 났다. 올리는 분에게는 무엇을 어떻게 줄이라는지 알 수 없는 실패였다.
(근거: 프로덕션 실측 6MB→413·3MB→통과, https://vercel.com/docs/functions/limitations)

그래서 파일은 이제 세 걸음으로 움직이고, **화면에서는 아무것도 달라지지 않는다**:

1. `POST /api/uploads/sign` — 파일 이름·형식·크기만 보내고 서명된 주소를 받는다
2. 브라우저가 **R2로 직접 PUT** (우리 서버를 지나지 않는다 → 용량 제한 없음)
3. 원래 라우트에 티켓만 JSON으로 보내 마무리 — 서버가 실측 확인 후 표시용 정규화

관련 파일: `lib/uploadClient.ts`(화면 9곳의 단일 관문) · `lib/r2/uploadPolicy.ts`(어디에·
어떻게, 순수·시험 있음) · `lib/r2/uploadTargets.ts`(누가) · `lib/r2/directUpload.ts`(서명·
마무리) · `lib/r2/readUploads.ts`(라우트가 파일을 받는 입구) · `lib/r2/uploadTicket.ts`(허가증)

규칙:

1. **새 업로드 라우트를 만들면 `uploadPolicy.ts`와 `uploadTargets.ts`에 한 줄씩 추가한다.**
   등록되지 않은 주소에는 서명이 나가지 않는다(=업로드 자체가 불가). 권한 판정은
   **그 라우트의 첫 줄과 같은 함수**를 쓴다 — 두 벌이 되면 어긋나고, 어긋난 쪽은 늘
   열려 있는 쪽이다.
2. **라우트에서 `request.formData()`를 직접 뜯지 않는다.** `readUploads()`를 쓴다 —
   새 경로(티켓)와 옛 경로(multipart, 4.5MB 이하)를 같은 모양으로 돌려준다.
3. **폴더·키는 서버가 만든다.** 클라이언트가 경로를 정하면 남의 폴더에 쓸 수 있다.
4. **원본 보관은 정책이다.** 사진 보관함·공연 사진·학생 제출은 원본을 `originals/`에
   남기고 `gallery_photos.original_key`가 가리킨다(지울 때 둘 다 지운다 —
   `deletePhotoFully`). 뉴스 썸네일·프로필처럼 화면용 이미지는 표시본만 남긴다.
5. **표시용 정규화 규칙은 여전히 `processForUpload` 한 곳**이다(장변 2000·WebP·EXIF 제거).
   업로드 경로가 바뀌었을 뿐 "무엇을 서빙하는가"는 그대로다.
6. **버킷 CORS가 없으면 브라우저 업로드가 통째로 막힌다.** 도메인이 바뀌면
   `npm run r2:cors -- --apply`로 허용 출처를 갱신할 것.

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

## 배경 영상 (섹션 뒤에 까는 루프)

`public/assets/video/`에 mp4 + webm + 포스터 jpg 3종으로 둔다. 현재
`traditional-sky`(홈 하단 처마 뒤)와 `mission-hansam`(소개 미션)이 있다.
소재는 로컬 리그로 만든다 — 절차는 KBNWorks의 `site-background-video` 스킬.

1. **소스는 검은 바탕에 밝은 형상 한 벌**이고, 테마마다 블렌드가 뒤집힌다.
   다크는 `mix-blend-mode: screen`, 라이트는 `filter: grayscale(1) invert(1)`
   + `multiply`. screen은 검정을, multiply는 흰색을 투명으로 떨어뜨리므로
   그냥 나눠 쓰면 한쪽이 바탕째 날아간다 — invert가 그 사이를 잇는다.
2. **`grayscale`은 반드시 `invert` 앞에.** 따뜻한 아이보리를 그냥 뒤집으면
   보색인 청회색이 되어 한지와 충돌한다. 무채색으로 만든 뒤 뒤집어야
   multiply가 지면 색으로 다시 물들여 세피아 먹으로 앉는다.
   (소스를 아예 회색조로 인코딩하지는 말 것 — 다크에서 따뜻함을 잃는다.)
3. **blend·opacity는 `<video>`가 아니라 래퍼가 갖는다.** 그래야
   `prefers-reduced-motion`에서 영상을 걷어내고 포스터를 배경으로 깔아도
   합성이 같다. 동작 최소화는 일시정지가 아니라 정지 이미지 대체다.
4. **본문 위에 걸치면 opacity를 눈대중으로 정하지 않는다.** 카피 영역의
   대비를 재고, 교체 전 배경이 받던 점수보다 낮아지지 않게 한다(4.5:1은
   최저선일 뿐). 측정 스크립트는 `D:\ComfyUI\_h3\jobs\ktdoc\preview_mission.py`.
5. `autoplay loop muted playsinline` + `poster`. `muted`·`playsinline`이 없으면
   모바일이 자동재생을 거부한다. webm이 mp4보다 큰 경우가 있으니
   **`<source>` 첫 줄에 둘 중 작은 쪽**이 오게 확인한다.

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

## 공연 자료함 — 번호로 여는 자리는 키를 내보내지 않는다

공연장에서 음원을 트는 일을 USB에서 번호 하나로 바꾼 자리다(`ktdoc.org/473128`
+ 숫자 비밀번호). 관리는 `/admin/resources`(admin 전용), 공개 진입은 루트
동적 세그먼트 `app/[code]/page.tsx`다 — 여섯 자리 숫자가 아니면 즉시
`notFound()`라 기존 정적 경로는 영향이 없다.

**설계를 가른 사실 하나: 우리 R2 버킷은 공개다**(`pub-….r2.dev`). 키를 아는
사람은 비밀번호와 무관하게 영구히 받을 수 있다. 따라서 자료함 파일은:

1. **`r2_key`가 응답·HTML·번들에 실리는 자리가 하나도 없다.** 타입이 막는다 —
   공개로 내려가는 모양은 `ResourceItemPublic`이고 `toPublicItem`을 지나야 한다.
2. **서명된 R2 주소(presigned GET)도 쓰지 않는다.** 서명 주소 **안에 키가 들어
   있어서**, 한 번 캡처하면 공개 주소로 조립해 영원히 받는다 — 만료가 무의미하다.
3. 재생·다운로드는 `lib/resources/stream.ts`가 `Range`를 R2에 그대로 넘겨 중계한다
   (206을 돌려줘야 공연장에서 곡 중간으로 갈 수 있다).

규칙:

1. **"열어도 되는가"는 `lib/resources/gate.ts` 하나만 답한다.** 화면·재생·
   다운로드·메일이 전부 `resolvePublicGate`를 지난다. 잠금·만료·비활성·링크
   세대·허용 토글을 여기 밖에서 다시 판단하지 말 것 — 두 벌이 되면 어긋나고,
   어긋난 쪽은 늘 열려 있는 쪽이다(신청서에서 겪은 그대로).
2. **비밀번호는 해시가 아니라 가역 암호다**(`lib/resources/passcode.ts` 머리말에
   근거). 남에게 알려주려고 만든 출입 번호라 원장이 다시 확인해야 하고, 해시로
   두면 잊을 때마다 재설정 → 이미 알려준 현장 담당자가 전부 막힌다.
   **모양(길이·생성)은 `passcodeFormat.ts`에 따로 있다** — 화면이 쓰는데
   `node:crypto`는 브라우저에 없다(실제로 화면이 열리는 순간 죽었다).
3. **새 업로드 자리를 만들면 `uploadPolicy.ts`·`uploadTargets.ts`에 한 줄씩** —
   기존 규칙 그대로다. 자료함은 `allowedTypePrefixes`로 음원·PDF·이미지만 받는다
   (이 필드가 없는 정책은 종전과 같이 제한 없음).
4. **지울 때는 R2를 먼저, D1을 나중에.** 행을 먼저 지우면 키를 잃어 공개 버킷에
   고아 객체가 영원히 눕는다. 반대로 **접근 기록(`resource_access_log`)은 자료함을
   지워도 남긴다** — 기록의 목적이 "언제 누구에게 나갔나"에 답하는 것이라, 지운 뒤에
   문제가 드러나는 경우가 흔하다.
5. **잠긴 화면은 제목도, 비밀번호 자릿수도, 남은 시도도 말하지 않는다.** 번호만
   우연히 맞춘 사람에게 줄 정보가 없다. 꺼지거나 기간이 지난 자료함에는 키패드를
   아예 띄우지 않는다(맞는 번호를 든 사람이 자기 비밀번호를 의심하게 두지 않는다).
6. **이 페이지에는 사이트 헤더를 붙이지 않는다**(`/confirm`과 같은 방식). 따라서
   `--page-offset` 토큰도 쓰지 않는다 — 없는 헤더 자리를 비우면 무대 뒤 태블릿에서
   키패드가 화면 밖으로 밀린다.

메일로 보내는 것은 **파일이 아니라 링크**다(첨부는 15MB에서 막히는데 자료함은
100MB까지 받는다). 링크는 `link_epoch`를 담고 있어 관리 화면의 "받기 링크 모두
무효화"로 이미 나간 것까지 죽는다 — 번호·비밀번호는 그대로 살아 있다.

## Reference Files

- **legacy_backup/**: Original static HTML/CSS/JS before migration
- **docs/design/**: Design mockups and asset documentation
