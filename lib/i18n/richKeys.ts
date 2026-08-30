/**
 * richKeys — 어느 번역 키가 '긴 글'인가
 *
 * 대부분의 키는 버튼 이름·한 줄 안내다. 몇 개만이 문단과 목록이 든 본문이고, 그
 * 몇 개는 위지윅으로 쓰고 저장할 때 정화기를 지나야 한다.
 *
 * 이 목록을 **서버가 갖는 이유**: 무엇을 정리할지 화면이 정하면, 화면을 거치지 않는
 * 저장 경로(스크립트·다른 화면)에서 정리 없이 들어온다. 반대로 모든 키를 정리하면
 * 이미 `<br/>`·`<a class="...">`로 만들어 둔 짧은 문구들이 조용히 다른 모양이 된다
 * (locale 파일에 그런 값이 열댓 개 있다).
 *
 * 새 위지윅 자리를 만들 때 할 일은 두 가지다 — 화면에서 `<IntlObject rich …/>`를 쓰고,
 * 그 키코드를 여기 적는다.
 */

const RICH_KEYCODES = new Set<string>([
  // /about 원장 소개 — 소개글 + 주요 초청공연 + 수상이 한 덩어리
  'about.director.profile',
]);

export function isRichKeycode(keycode: string): boolean {
  return RICH_KEYCODES.has(keycode);
}

/** 시험·스크립트에서 목록 자체가 필요할 때 */
export function richKeycodes(): string[] {
  return [...RICH_KEYCODES];
}
