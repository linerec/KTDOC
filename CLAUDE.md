# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**KTDOC** - Korean Traditional Dance of Choomnoori website. Next.js 16 + React 19 + TypeScript application migrated from static HTML.

## Development Commands

```bash
npm run dev        # Development server at localhost:3000
npm run build      # Production build
npm run start      # Production server
npm run lint       # ESLint
npx tsc --noEmit   # Type checking
```

## Architecture

### App Router Structure
- **app/layout.tsx**: Root layout with metadata, Google Fonts preconnect
- **app/page.tsx**: Home page composing section components
- **app/globals.css**: Design system (CSS custom properties, responsive styles)

### Component Organization
- **components/Header.tsx**: Client Component - fixed navigation with scroll detection, mobile menu toggle
- **components/Hero.tsx**: Two-column grid with image gallery, vertical Korean text
- **components/Categories.tsx**: 4-column grid of bilingual category cards
- **components/Traditional.tsx**: Architecture imagery placeholder with dancheong pattern
- **components/Footer.tsx**: Logo, social links (Instagram, YouTube)
- **components/Section.tsx**: Reusable section wrapper with typed props

### Asset Structure
```
public/assets/
├── logo/       # logo_white.png, logo_long.png, logo_default.png
└── images/     # perform.png, perform02.png, dancheong.png
```

## Design System

### Colors (CSS Custom Properties)
- `--color-primary`: #0a0a0a (dark background)
- `--color-secondary`: #c4302b (Korean red)
- `--color-accent`: #d4a017 (gold)

### Typography
- Headings: Noto Serif KR (Korean serif, weights 300/400/700)
- Body: Outfit (sans-serif, weights 300/400/600)

### Layout
- Container max-width: 1400px
- Header height: 100px (fixed position)
- Mobile-first responsive design

## Key Patterns

### Client vs Server Components
Only Header.tsx uses `'use client'` directive for scroll detection and menu state. All other components are Server Components.

### State Management
Component-level only (useState/useEffect in Header). No global state library.

### Styling
Plain CSS with custom properties - no CSS-in-JS. Global styles in globals.css, page-specific in page.module.css.

### Bilingual Content
Category cards use `titleKo` and `titleEn` properties for Korean/English display.

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

## Reference Files

- **legacy_backup/**: Original static HTML/CSS/JS before migration
- **docs/design/**: Design mockups and asset documentation
