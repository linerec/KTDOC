/**
 * 둘러보기의 공연 카드 주소 — 알림을 누르면 그 공연 포스터 앞에 내려 준다
 *
 * 공연 알림은 예전에 공개 갤러리 상세(`/gallery/event/<id>`)로 갔다. 거기에는 참여
 * 버튼이 없고, 아직 비공개인 공연이면 페이지 자체가 없다. 알림을 받은 사람이 하려는
 * 일은 "간다/안 간다"를 누르는 것이라, 그 버튼이 붙은 둘러보기 카드로 보낸다.
 *
 * 카드의 id와 알림 주소가 두 벌이면 한쪽만 바뀌어 아무 데도 안 가는 링크가 된다 —
 * 둘 다 여기서 만든다.
 */

/** 둘러보기 카드·줄의 DOM id */
export function libraryCardId(eventId: number): string {
  return `event-${eventId}`;
}

/** 알림·링크가 여는 주소 — 둘러보기로 가서 그 공연 카드로 스크롤한다 */
export function libraryEventHref(eventId: number): string {
  return `/admin/library#${libraryCardId(eventId)}`;
}
