/**
 * lib/contrast.ts — WCAG 명도 대비 계산
 *
 * 팔레트를 바꿀 때 "느낌상 괜찮다"가 아니라 숫자로 확인하기 위한 것이다.
 * 공식은 WCAG 2.1의 상대 휘도(relative luminance)와 대비비 정의를 따른다.
 *
 * 기준:
 *  - 본문 텍스트          ≥ 4.5:1 (AA)
 *  - 큰 글자(18.66px+ bold, 24px+) ≥ 3:1 (AA Large)
 *  - UI 컴포넌트·그래픽 경계   ≥ 3:1
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function parseHex(hex: string): Rgb {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`색 형식이 아니다: ${hex}`);
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** WCAG 상대 휘도 */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** 두 색의 대비비(1~21). 순서는 무관하다. */
export function contrastRatio(a: string | Rgb, b: string | Rgb): number {
  const la = relativeLuminance(typeof a === 'string' ? parseHex(a) : a);
  const lb = relativeLuminance(typeof b === 'string' ? parseHex(b) : b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** 반투명 전경을 불투명 배경 위에 합성한 실효 색 */
export function composite(fg: string | Rgb, alpha: number, bg: string | Rgb): Rgb {
  const f = typeof fg === 'string' ? parseHex(fg) : fg;
  const b = typeof bg === 'string' ? parseHex(bg) : bg;
  const mix = (x: number, y: number) => Math.round(x * alpha + y * (1 - alpha));
  return { r: mix(f.r, b.r), g: mix(f.g, b.g), b: mix(f.b, b.b) };
}
