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

## Reference Files

- **legacy_backup/**: Original static HTML/CSS/JS before migration
- **docs/design/**: Design mockups and asset documentation
