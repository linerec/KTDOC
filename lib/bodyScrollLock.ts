/**
 * 배경 스크롤 잠금 — 켜고 끄는 두 함수가 아니라, **되돌리기 함수 하나**를 준다.
 *
 * 왜: 라이트박스가 열릴 때 `document.body.style.overflow = 'hidden'`을 직접 쓰고
 * 닫는 함수에서만 되돌리면, 닫지 않고 떠나는 경로가 남는다 — 브라우저 뒤로가기,
 * 사진 위에서 누른 링크, 라우팅. 컴포넌트는 언마운트되는데 body는 잠긴 채라
 * **다음 페이지의 스크롤이 죽고 스크롤바가 사라진다**.
 * (실측: /timeline → 카드 → 사진 열기 → 뒤로가기 → 목록이 스크롤되지 않음)
 *
 * 되돌리기 함수만 내보내면 호출부는 그것을 useEffect의 정리 함수에 그대로 묶게
 * 되고, 정리 함수는 언마운트에도 불린다. 즉 "닫지 않고 떠나는 경로"가 사라진다:
 *
 *   useEffect(() => {
 *     if (!open) return;
 *     return lockBodyScroll();
 *   }, [open]);
 *
 * 이전 값을 기억했다가 되돌리므로 중첩(라이트박스 위의 모달)도 순서대로 풀린다.
 */

/** document.body 대역 — 이 모듈이 만지는 표면은 style.overflow 하나뿐이다 */
type ScrollLockTarget = { style: { overflow: string } };

/**
 * 배경 스크롤을 잠그고, 잠그기 직전 상태로 되돌리는 함수를 반환한다.
 * 반환값을 버리지 말 것 — 버리면 되돌릴 방법이 없다.
 */
export function lockBodyScroll(target?: ScrollLockTarget): () => void {
  const body: ScrollLockTarget = target ?? document.body;
  const previous = body.style.overflow;
  body.style.overflow = 'hidden';

  let released = false;
  return () => {
    // 정리 함수는 두 번 불릴 수 있다(React StrictMode, 중복 호출).
    // 두 번째 호출까지 값을 쓰면 그 사이 다른 곳이 건 잠금을 풀어 버린다.
    if (released) return;
    released = true;
    body.style.overflow = previous;
  };
}
