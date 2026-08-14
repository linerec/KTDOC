/**
 * D1 바인딩 파라미터 청크 분할
 *
 * D1의 파라미터 상한은 100개다(실측: 100 OK, 101+ 거부). `IN (...)` 리스트에도
 * 같은 상한이 걸린다. 응답이 늘어야 터지는 종류의 사고라 눈으로는 못 잡는다 —
 * 그래서 90개로 여유를 두고 무조건 쪼갠다.
 *
 * 여러 행을 한 문장에 넣을 때는 **행당 파라미터 수로 나눈 값**을 size 로 준다.
 * 예: 컬럼 6개짜리 INSERT 라면 chunkParams(rows, 15) → 15행 × 6 = 90개.
 */
export function chunkParams<T>(values: T[], size = 90): T[][] {
  if (values.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}
