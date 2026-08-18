import type { Event, EventWithCategory } from '@/types/gallery';

/**
 * 연혁층/기록층 판정 — 이 규칙은 여기 한 곳에만 있다.
 *
 * 2026-08-17 원장님 메일로 받은 연혁 83건이 events 에 들어 있는데, 그중 사진이나
 * 설명이 붙은 것은 소수다. 나머지는 제목 한 줄뿐이라 상세 페이지를 열어도 볼 게 없다.
 * 그래서 두 종류로 나눠 그린다:
 *
 *   기록층 — 사진이나 설명이 있다 → 카드 + 상세 링크
 *   연혁층 — 제목뿐이다        → 한 줄 텍스트, 링크 없음
 *
 * 판정을 컬럼에 저장하지 않고 유도하는 이유: 나중에 사진이 도착해 붙는 순간
 * 그 항목이 저절로 기록층으로 올라간다. 운영자가 플래그를 따로 켤 일이 없다.
 */
type ChronicleInput = Pick<Event, 'description_ko' | 'description_en' | 'thumbnail_url' | 'poster_url'> &
  Partial<Pick<EventWithCategory, 'first_image_url'>>;

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/** 볼 것이 없는 연혁 한 줄인가 — true면 카드가 아니라 텍스트 줄로 그린다. */
export function isChronicle(event: ChronicleInput): boolean {
  const hasDescription = hasText(event.description_ko) || hasText(event.description_en);
  const hasImage =
    hasText(event.thumbnail_url) || hasText(event.poster_url) || hasText(event.first_image_url);
  return !hasDescription && !hasImage;
}

/** 상세 페이지로 보낼 수 있는가 — 연혁층은 링크를 만들지 않는다. */
export function hasDetailPage(event: ChronicleInput): boolean {
  return !isChronicle(event);
}

/**
 * 한 해의 항목을 기록층/연혁층으로 가른다.
 * 화면에서는 기록층 카드를 먼저, 연혁층 줄을 그 아래에 둔다 — 뒤섞으면 리듬이 깨진다.
 */
export function splitByLayer<T extends ChronicleInput>(events: T[]): { records: T[]; lines: T[] } {
  const records: T[] = [];
  const lines: T[] = [];
  for (const event of events) (isChronicle(event) ? lines : records).push(event);
  return { records, lines };
}

/**
 * 연혁 항목을 원문 순서로 정렬한다.
 *
 * 연혁은 연도만 알아 event_date 가 모두 YYYY-01-01 이다. 날짜로 정렬하면 원장님이
 * 정하신 원문 순서가 깨져 2008년 첫 줄이 '설립'이 아니라 케네디센터가 된다.
 * 시더가 slug 에 순번을 박아 두므로(chronicle-YYYY-NN) 그걸로 되돌린다.
 * 연혁이 아닌 항목은 slug 규칙이 없어 원래 순서를 그대로 둔다.
 */
export function sortChronicle<T extends { slug: string }>(events: T[]): T[] {
  return [...events].sort((a, b) => a.slug.localeCompare(b.slug));
}
