/**
 * 홈 인스타그램 하이라이트 — 타입·파서·직렬화
 *
 * 서버(설정 조회)와 클라이언트(편집 모달) 양쪽에서 쓰이므로 DB 모듈을 import하지 않는다.
 * (lib/seoBusiness.ts와 같은 역할·위치)
 *
 * 설계 배경은 docs/operations/instagram-highlights.md 참조.
 * 요약: Instagram Basic Display API가 2024-12 종료되고 후속 API는 프로 계정 + 60일마다
 * 만료되는 토큰을 요구하므로, 자동 피드 대신 수동 큐레이션을 택했다.
 */

/** site_settings 키 */
export const SETTING_SOCIAL_INSTAGRAM = 'social.instagram';

/** 홈에 실제로 노출하는 장수 */
export const INSTAGRAM_VISIBLE_COUNT = 3;

/** 등록 가능한 최대 장수 — 순서를 바꿔 앞 3장을 고른다 */
export const INSTAGRAM_MAX_ITEMS = 6;

export interface InstagramHighlight {
  /** 게시물 링크 */
  url: string;
  /** R2에 올린 사진 URL (인스타 CDN 핫링크는 서명 만료로 깨진다) */
  imageUrl: string;
  /** R2 객체 키 — 삭제·교체 시 사용 */
  imageR2Key: string;
  /** 접근성용 대체 텍스트. 화면에는 표시하지 않으며, 비우면 자동 라벨이 붙는다 */
  alt: string;
}

/** instagram.com 호스트의 http(s) URL만 허용 */
export function isValidInstagramUrl(value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    return u.hostname === 'instagram.com' || u.hostname.endsWith('.instagram.com');
  } catch {
    return false;
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * 저장된 JSON을 항목 배열로 해석한다.
 * 형식이 깨졌거나 필수 값(url·imageUrl)이 없는 항목은 조용히 버린다 —
 * 홈이 설정 하나 때문에 깨지지 않는 것이 우선이다.
 */
export function parseInstagramHighlights(raw: string | null | undefined): InstagramHighlight[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];

  const items: InstagramHighlight[] = [];
  for (const entry of data) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const url = asString(e.url);
    const imageUrl = asString(e.imageUrl);
    if (!url || !imageUrl || !isValidInstagramUrl(url)) continue;
    items.push({
      url,
      imageUrl,
      imageR2Key: asString(e.imageR2Key),
      alt: asString(e.alt),
    });
    if (items.length >= INSTAGRAM_MAX_ITEMS) break;
  }
  return items;
}

/** 저장용 직렬화 — 빈 배열이면 null(설정 삭제)로 정규화한다 */
export function serializeInstagramHighlights(items: InstagramHighlight[]): string | null {
  const cleaned = items
    .filter((i) => i.url && i.imageUrl && isValidInstagramUrl(i.url))
    .slice(0, INSTAGRAM_MAX_ITEMS)
    .map((i) => ({
      url: i.url.trim(),
      imageUrl: i.imageUrl.trim(),
      imageR2Key: i.imageR2Key.trim(),
      alt: i.alt.trim(),
    }));
  return cleaned.length > 0 ? JSON.stringify(cleaned) : null;
}

/** 대체 텍스트 — 관리자가 비워두면 순번으로 자동 생성 */
export function highlightAltText(item: InstagramHighlight, index: number): string {
  return item.alt || `인스타그램 게시물 ${index + 1}`;
}
