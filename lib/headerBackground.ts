/**
 * 헤더(Top Bar) 배경 설정 헬퍼
 *
 * 최상단(top)과 스크롤 후(scrolled) 두 상태를 각각 색상/투명도로 제어한다.
 * 설정이 없으면 null → globals.css의 기본값(최상단 투명, 스크롤 시 rgba(10,10,10,0.95))이 그대로 적용된다.
 *
 * 서버(layout)와 클라이언트(Header 편집 UI) 양쪽에서 쓰는 순수 변환 함수만 둔다.
 */

export interface HeaderBgState {
  /** #rrggbb 형식 16진 색상 */
  color: string;
  /** 0 ~ 1 투명도 (0 = 완전 투명, 1 = 불투명) */
  opacity: number;
}

/** 상단 로고 변형: 흰색(white) 또는 기본(default) */
export type HeaderLogoVariant = 'white' | 'default';

/** 최상단(top)·스크롤 후(scrolled) 두 상태로 각각 갖는 값 */
export interface HeaderStatePair<T> {
  /** 페이지 최상단(스크롤 전) 상태 */
  top: T;
  /** 스크롤하여 헤더가 고정된 상태 */
  scrolled: T;
}

export interface HeaderBackground {
  /** 페이지 최상단(스크롤 전) 배경 */
  top: HeaderBgState;
  /** 스크롤하여 헤더가 고정된 상태의 배경 */
  scrolled: HeaderBgState;
  /** 상단 로고 변형(흰색/기본). 최상단·스크롤 후 각각 지정 */
  logo: HeaderStatePair<HeaderLogoVariant>;
  /** 메뉴(네비게이션) 글자 색상(#rrggbb). 최상단·스크롤 후 각각 지정 */
  navColor: HeaderStatePair<string>;
}

/**
 * 설정이 없을 때 편집 UI를 초기화하기 위한 기본값.
 * globals.css의 현재 동작과 동일하게 맞춘다(최상단 투명, 스크롤 시 어두운 반투명, 흰색 로고, 흰색 메뉴 글자).
 */
export const DEFAULT_HEADER_BACKGROUND: HeaderBackground = {
  top: { color: '#0a0a0a', opacity: 0 },
  scrolled: { color: '#0a0a0a', opacity: 0.95 },
  logo: { top: 'white', scrolled: 'white' },
  navColor: { top: '#ffffff', scrolled: '#ffffff' },
};

/** 로고 변형별 에셋 정보(경로 및 원본 크기). next/image의 비율 계산에 사용한다. */
export interface HeaderLogoAsset {
  src: string;
  width: number;
  height: number;
}

export function headerLogoAsset(variant: HeaderLogoVariant): HeaderLogoAsset {
  return variant === 'default'
    ? { src: '/assets/logo/logo_default.png', width: 1536, height: 1024 }
    : { src: '/assets/logo/logo_white.png', width: 400, height: 242 };
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function clampOpacity(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function normalizeState(raw: unknown, fallback: HeaderBgState): HeaderBgState {
  if (!raw || typeof raw !== 'object') return { ...fallback };
  const obj = raw as Record<string, unknown>;
  const color =
    typeof obj.color === 'string' && HEX_RE.test(obj.color)
      ? obj.color.toLowerCase()
      : fallback.color;
  const opacity = obj.opacity == null ? fallback.opacity : clampOpacity(obj.opacity);
  return { color, opacity };
}

function normalizeLogo(raw: unknown, fallback: HeaderLogoVariant): HeaderLogoVariant {
  return raw === 'white' || raw === 'default' ? raw : fallback;
}

function normalizeNavColor(raw: unknown, fallback: string): string {
  return typeof raw === 'string' && HEX_RE.test(raw) ? raw.toLowerCase() : fallback;
}

/** 로고 쌍 정규화. 구버전(단일 변형 문자열)은 최상단·스크롤 후 양쪽에 동일 적용. */
function normalizeLogoPair(
  raw: unknown,
  fallback: HeaderStatePair<HeaderLogoVariant>
): HeaderStatePair<HeaderLogoVariant> {
  if (raw === 'white' || raw === 'default') return { top: raw, scrolled: raw };
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    return {
      top: normalizeLogo(obj.top, fallback.top),
      scrolled: normalizeLogo(obj.scrolled, fallback.scrolled),
    };
  }
  return { ...fallback };
}

/** 메뉴 글자색 쌍 정규화. 구버전(단일 hex 문자열)은 최상단·스크롤 후 양쪽에 동일 적용. */
function normalizeNavColorPair(
  raw: unknown,
  fallback: HeaderStatePair<string>
): HeaderStatePair<string> {
  if (typeof raw === 'string' && HEX_RE.test(raw)) {
    const color = raw.toLowerCase();
    return { top: color, scrolled: color };
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    return {
      top: normalizeNavColor(obj.top, fallback.top),
      scrolled: normalizeNavColor(obj.scrolled, fallback.scrolled),
    };
  }
  return { ...fallback };
}

/**
 * 저장된 JSON 문자열을 HeaderBackground로 파싱한다.
 * 값이 없거나 유효하지 않으면 null(= 기본 CSS 동작 유지).
 */
export function parseHeaderBackground(
  value: string | null | undefined
): HeaderBackground | null {
  if (!value) return null;
  try {
    const obj = JSON.parse(value) as Record<string, unknown>;
    if (!obj || typeof obj !== 'object') return null;
    return {
      top: normalizeState(obj.top, DEFAULT_HEADER_BACKGROUND.top),
      scrolled: normalizeState(obj.scrolled, DEFAULT_HEADER_BACKGROUND.scrolled),
      logo: normalizeLogoPair(obj.logo, DEFAULT_HEADER_BACKGROUND.logo),
      navColor: normalizeNavColorPair(obj.navColor, DEFAULT_HEADER_BACKGROUND.navColor),
    };
  } catch {
    return null;
  }
}

/** HeaderBackground를 저장용 JSON 문자열로 직렬화 */
export function serializeHeaderBackground(bg: HeaderBackground): string {
  return JSON.stringify({
    top: { color: bg.top.color, opacity: clampOpacity(bg.top.opacity) },
    scrolled: { color: bg.scrolled.color, opacity: clampOpacity(bg.scrolled.opacity) },
    logo: normalizeLogoPair(bg.logo, DEFAULT_HEADER_BACKGROUND.logo),
    navColor: normalizeNavColorPair(bg.navColor, DEFAULT_HEADER_BACKGROUND.navColor),
  });
}

/** hex(#rrggbb) + opacity → rgba(r, g, b, a) 문자열 */
export function toRgba(state: HeaderBgState): string {
  const hex = HEX_RE.test(state.color) ? state.color : '#000000';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${clampOpacity(state.opacity)})`;
}

/**
 * HeaderBackground → layout body에 주입할 CSS 변수 객체.
 * null이면 빈 객체를 반환하여 globals.css의 var() fallback(기본 동작)이 적용되게 한다.
 */
export function toHeaderCssVars(bg: HeaderBackground | null): Record<string, string> {
  if (!bg) return {};
  return {
    '--header-bg-top': toRgba(bg.top),
    '--header-bg-scrolled': toRgba(bg.scrolled),
    '--header-nav-color-top': bg.navColor.top,
    '--header-nav-color-scrolled': bg.navColor.scrolled,
  };
}
