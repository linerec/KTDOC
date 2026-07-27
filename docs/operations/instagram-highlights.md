# 홈 인스타그램 하이라이트

작성일: 2026-07-27 · 상태: 설계 확정

## 1. 목적

인스타그램(@ktdoc_eunhee_ahn) 활동을 홈에서 보이게 하되, **레이아웃을 크게
차지하거나 동선을 방해하지 않는다.** 이 섹션의 역할은 콘텐츠 소비가 아니라
**인스타그램으로 유도**하는 것이다. 그래서 캡션 없이 사진만 깔고, 클릭하면
해당 게시물로, 아래에 계정 팔로우 링크를 둔다.

## 2. 왜 자동 피드가 아닌가

- Instagram **Basic Display API는 2024-12-04 완전 종료**됐다. 후속인
  Instagram API with Instagram Login(Graph 계열)은 **개인 계정을 지원하지 않는다** —
  비즈니스/크리에이터 계정 전환이 전제다.
- 프로 계정이어도 Meta 앱 등록 + 액세스 토큰이 필요하고 **토큰이 60일마다 만료**된다.
  갱신 크론이 실패하면 어느 날 조용히 피드가 빈다.
- 유튜브(`lib/youtube.ts`)처럼 API 키 하나로 끝나지 않는다.

→ **수동 큐레이션**을 택한다. 외부 스크립트 0, 토큰 0, 조용히 깨질 일 없음.
자동 반영이 정말 필요해지면 그때 Graph API를 얹는다(데이터 구조는 그대로 재사용 가능).

인스타 공식 임베드 위젯(blockquote + embed.js)도 제외한다 — 흰 배경의 큰 iframe이라
사이트의 어두운 톤과 충돌하고 "크게 차지하지 않게"라는 목적에 정면으로 어긋난다.

## 3. 데이터

`site_settings`의 **`social.instagram`** 키에 JSON 배열. 새 테이블·마이그레이션 없음.
항목이 3~6개로 고정이라 정렬·검색·페이지네이션이 필요 없다.

```ts
// lib/socialHighlights.ts (클라이언트 안전 — seoBusiness.ts와 같은 위치·역할)
export const SETTING_SOCIAL_INSTAGRAM = 'social.instagram';

export interface InstagramHighlight {
  /** 게시물 링크 (필수) */
  url: string;
  /** R2에 올린 사진 (필수) */
  imageUrl: string;
  imageR2Key: string;
  /** 접근성용 대체 텍스트(선택). 화면에는 표시하지 않는다 */
  alt: string;
}
```

**사진은 반드시 직접 업로드한다.** 인스타 CDN URL(`scontent...`)은 서명 파라미터가
붙어 있어 핫링크하면 며칠 뒤 깨진다. `/api/upload`로 R2 `social/` 폴더에 올려
우리가 소유한다.

**캡션은 두지 않는다.** 이 섹션은 유도가 목적이고, 캡션이 붙으면 시선이 머물러
오히려 인스타로 넘어가지 않는다. 대신 `alt`는 남긴다 — 사진이 유일한 콘텐츠인
링크라 스크린리더가 읽을 것이 필요하다. 비우면 "인스타그램 게시물 N"이 자동으로 붙는다.

## 4. 화면

**배치**: `Categories` 다음, `Traditional` 앞.

```
Hero(유튜브) → Mission → 최근 발자취 → Categories → [인스타] → Traditional
```

주요 진입 카드(수업·공연·타임라인·미디어)보다 아래에 둬서 동선을 방해하지 않는다.

**레이아웃**: 3열 정사각 썸네일 + 하단 팔로우 링크 한 줄.
**모바일에서도 3열을 유지한다** — 1열로 펴면 세로로 길어져 목적에 어긋난다.
인스타 그리드 특유의 리듬이라 이질감도 없다.

**표시 개수**: 앞에서 3장. 등록은 최대 6장까지 허용하고 순서를 바꿔 노출을 고른다.

**팔로우 링크**: `seo.business.instagram` 값을 쓴다(하드코딩 금지). SEO 패널에서
계정을 바꾸면 여기도 따라간다.

**빈 상태**: 등록 0건이면 섹션을 렌더하지 않는다. 단 **편집 모드에서는 0건이어도
섹션을 띄운다** — 그러지 않으면 첫 등록을 할 진입점이 사라진다.

## 5. 관리

새 관리 메뉴를 만들지 않는다. 이 프로젝트의 홈 섹션 설정 패턴을 그대로 따른다:
**공개 홈에서 편집 모드 켜기 → 섹션 좌하단 설정 버튼 → 모달**
(`HeroBackgroundManager`, `HeaderBackgroundEditor`와 동일).

- 편집 모드는 admin만 켤 수 있다(`components/Header.tsx`의 `isAdmin(session) && isEditMode`)
- 모달에서 항목 추가(사진 업로드 + 게시물 URL) · 삭제 · 순서 이동
- 저장은 `POST /api/admin/settings` — `ALLOWED_KEYS`에 `social.instagram`을 추가하고
  저장 후 `revalidatePath('/')`로 홈 ISR을 즉시 무효화한다

**URL 검증**: `instagram.com` 호스트의 http(s) URL만 허용한다. 잘못된 값이 들어가면
저장 시점에 막는다.

## 6. 컴포넌트

| 파일 | 역할 |
|---|---|
| `lib/socialHighlights.ts` | 타입·상수·파서·직렬화 (클라 안전) |
| `components/home/InstagramStrip.tsx` | 서버. 설정과 프로필 URL을 읽어 넘긴다 |
| `components/home/InstagramStripView.tsx` | 클라. 편집 모드 판단 + 카드 렌더 |
| `components/home/InstagramStripEditor.tsx` | 클라. 편집 모달(업로드·URL·순서) |

뷰를 클라이언트로 두는 이유: 빈 상태에서 편집 모드 여부에 따라 렌더가 갈리는데,
`isEditMode`는 클라이언트 상태(`BuilderContext`)라 서버가 알 수 없다.

## 7. 범위 밖

- Graph API 자동 동기화
- 캡션·좋아요 수·게시일 표시
- 인스타 외 다른 SNS(페이스북 등)
- 별도 소셜 관리 메뉴

## 8. 검증

- `npx tsc --noEmit` · `npm run lint` · `npm run build`
- 등록 0건일 때 섹션이 안 보이고, 편집 모드에서는 보이는지
- 3열이 모바일 폭에서도 유지되는지
- 게시물 링크가 새 탭으로 열리고 `rel="noopener noreferrer"`가 붙는지
- 저장 후 홈에 즉시 반영되는지(revalidatePath)
