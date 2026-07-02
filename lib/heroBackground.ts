/**
 * Hero 배경 톤·필터 설정 헬퍼
 *
 * 홈 히어로 배경 슬라이드쇼 위에 얹히는 화면 톤(이미지 밝기·어둡기·색 틴트)을
 * 관리자가 조절할 수 있게 한다. 설정이 없으면 null → globals.css의 var() 기본값
 * (현재 디자인 그대로)이 적용된다.
 *
 * 서버(Hero)와 클라이언트(HeroBackgroundManager) 양쪽에서 쓰는 순수 변환 함수만 둔다.
 * headerBackground.ts와 같은 패턴.
 */

/** 틴트 합성 방식 — CSS mix-blend-mode 값 그대로 저장한다 */
export type HeroTintBlend = 'multiply' | 'soft-light' | 'color' | 'normal';

export interface HeroOverlay {
  /** 이미지 노출 불투명도 0.1~1. 높을수록 사진이 밝고 선명하게 드러난다 */
  imageOpacity: number;
  /** 어둡기 배율 0~2. 1 = 기본 CSS 강도, 0 = 어둡기 제거, 2 = 두 배로 어둡게 */
  dim: number;
  /** 틴트(톤) 색상 #rrggbb */
  tintColor: string;
  /** 틴트 강도 0~0.8 (0 = 틴트 없음) */
  tintStrength: number;
  /** 틴트 합성 방식 */
  tintBlend: HeroTintBlend;
}

/**
 * 설정이 없을 때 편집 UI를 초기화하기 위한 기본값.
 * globals.css의 현재 동작과 동일하게 맞춘다(이미지 0.58, 어둡기 1배, 틴트 없음).
 */
export const DEFAULT_HERO_OVERLAY: HeroOverlay = {
  imageOpacity: 0.58,
  dim: 1,
  tintColor: '#8f211d',
  tintStrength: 0,
  tintBlend: 'multiply',
};

/** 편집 UI의 틴트 합성 방식 선택지 */
export const HERO_TINT_BLENDS: { value: HeroTintBlend; label: string }[] = [
  { value: 'multiply', label: '깊게 물들이기' },
  { value: 'soft-light', label: '은은하게 스미기' },
  { value: 'color', label: '색조 바꾸기' },
  { value: 'normal', label: '단색 덮기' },
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeBlend(raw: unknown, fallback: HeroTintBlend): HeroTintBlend {
  return raw === 'multiply' || raw === 'soft-light' || raw === 'color' || raw === 'normal'
    ? raw
    : fallback;
}

/**
 * 저장된 JSON 문자열을 HeroOverlay로 파싱한다.
 * 값이 없거나 유효하지 않으면 null(= 기본 CSS 동작 유지).
 */
export function parseHeroOverlay(value: string | null | undefined): HeroOverlay | null {
  if (!value) return null;
  try {
    const obj = JSON.parse(value) as Record<string, unknown>;
    if (!obj || typeof obj !== 'object') return null;
    const d = DEFAULT_HERO_OVERLAY;
    return {
      imageOpacity: clamp(obj.imageOpacity, 0.1, 1, d.imageOpacity),
      dim: clamp(obj.dim, 0, 2, d.dim),
      tintColor:
        typeof obj.tintColor === 'string' && HEX_RE.test(obj.tintColor)
          ? obj.tintColor.toLowerCase()
          : d.tintColor,
      tintStrength: clamp(obj.tintStrength, 0, 0.8, d.tintStrength),
      tintBlend: normalizeBlend(obj.tintBlend, d.tintBlend),
    };
  } catch {
    return null;
  }
}

/** HeroOverlay를 저장용 JSON 문자열로 직렬화 */
export function serializeHeroOverlay(overlay: HeroOverlay): string {
  const d = DEFAULT_HERO_OVERLAY;
  return JSON.stringify({
    imageOpacity: clamp(overlay.imageOpacity, 0.1, 1, d.imageOpacity),
    dim: clamp(overlay.dim, 0, 2, d.dim),
    tintColor: HEX_RE.test(overlay.tintColor) ? overlay.tintColor.toLowerCase() : d.tintColor,
    tintStrength: clamp(overlay.tintStrength, 0, 0.8, d.tintStrength),
    tintBlend: normalizeBlend(overlay.tintBlend, d.tintBlend),
  });
}

/** 히어로 섹션에 주입할 CSS 변수 이름 목록(실시간 미리보기의 변수 제거에도 사용) */
export const HERO_OVERLAY_CSS_VARS = [
  '--hero-img-opacity',
  '--hero-dim',
  '--hero-tint-color',
  '--hero-tint-opacity',
  '--hero-tint-blend',
] as const;

/**
 * HeroOverlay → #hero에 주입할 CSS 변수 객체.
 * null이면 빈 객체를 반환하여 globals.css의 var() fallback(기본 동작)이 적용되게 한다.
 */
export function toHeroCssVars(overlay: HeroOverlay | null): Record<string, string> {
  if (!overlay) return {};
  return {
    '--hero-img-opacity': String(overlay.imageOpacity),
    '--hero-dim': String(overlay.dim),
    '--hero-tint-color': overlay.tintColor,
    '--hero-tint-opacity': String(overlay.tintStrength),
    '--hero-tint-blend': overlay.tintBlend,
  };
}
