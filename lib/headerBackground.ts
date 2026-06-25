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

export interface HeaderBackground {
  /** 페이지 최상단(스크롤 전) 상태 */
  top: HeaderBgState;
  /** 스크롤하여 헤더가 고정된 상태 */
  scrolled: HeaderBgState;
}

/**
 * 설정이 없을 때 편집 UI를 초기화하기 위한 기본값.
 * globals.css의 현재 동작과 동일하게 맞춘다(최상단 투명, 스크롤 시 어두운 반투명).
 */
export const DEFAULT_HEADER_BACKGROUND: HeaderBackground = {
  top: { color: '#0a0a0a', opacity: 0 },
  scrolled: { color: '#0a0a0a', opacity: 0.95 },
};

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
  };
}
