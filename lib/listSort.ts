/**
 * lib/listSort.ts — 공개 목록의 정렬 기준
 *
 * 왜 이 파일이 있나: 원장님이 지난 공연·캠프를 뒤늦게 올리면 "나중에 등록한 것이
 * 위"인 목록에서 옛것이 맨 위로 올라왔다(2026-09-09). 방문자에게 자연스러운 순서는
 * 개최일이고, "새로 올라온 것"을 보고 싶을 때만 등록순이 필요하다.
 *
 * 정렬 기준은 /classes·/performances가 같은 쿼리스트링(`?sort=`)으로 공유하고,
 * 해석은 여기 한 곳에서 한다. 잘못된 값은 기본(개최일)으로 떨어진다 — 이상한
 * 주소 때문에 빈 화면이나 500이 나면 안 된다.
 */

export const LIST_SORTS = ['date', 'created'] as const;
export type ListSort = (typeof LIST_SORTS)[number];

/** 기본값. 쿼리스트링에 없으면 이것이다 — URL에는 적지 않는다(정규 주소 유지). */
export const DEFAULT_LIST_SORT: ListSort = 'date';

/** 쿼리스트링 값 → 정렬 기준. 모르는 값·배열·빈 값은 기본으로. */
export function parseListSort(raw: string | string[] | undefined | null): ListSort {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === 'created' ? 'created' : DEFAULT_LIST_SORT;
}
