/**
 * childEntries — 학부모가 적어 낸 자녀 목록의 정규화
 *
 * 가입 폼·프로필 자녀 추가·신청서 내 가입이 모두 "자녀 이름 + 입학년도" 목록을
 * 받는다. 검증 규칙이 화면마다 갈리면 어느 한 곳으로 이상한 값이 새어 들어오므로
 * 여기 한 곳에 모은다. DB·프레임워크 의존이 없는 순수 모듈이다(테스트 대상).
 */

export interface ChildEntry {
  name: string;
  enrollmentYear: number | null;
}

/**
 * 한 번에 등록할 수 있는 자녀 수 상한.
 * 실수(붙여넣기 반복 등)와 장난 입력을 막는 안전판이지 정책이 아니다 —
 * 그 이상의 가족은 운영진이 회원 관리에서 이어 준다.
 */
export const MAX_CHILDREN = 6;

/**
 * 입학년도 선택지: 올해부터 과거 12년치 — 가입 폼·프로필 자녀 추가 공용.
 * 화면마다 따로 만들면 범위가 어긋나 "UI가 준 연도를 서버가 거부"하는 조합이 생긴다.
 */
export function enrollmentYearOptions(): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: 13 }, (_, i) => current - i);
}

/** 입학년도 파싱·검증 (1990 ~ 올해+1 사이의 정수만) */
export function parseEnrollmentYear(
  value: number | string | null | undefined
): number | null {
  if (value === undefined || value === null || value === '') return null;
  const year = Math.trunc(Number(value));
  if (!Number.isFinite(year)) return null;
  const maxYear = new Date().getFullYear() + 1;
  if (year < 1990 || year > maxYear) return null;
  return year;
}

/**
 * 자녀 입력 목록을 다듬는다: 이름 공백 정리, 빈 이름 제거,
 * 같은 이름+같은 입학년도 중복 제거, 상한 절단.
 */
export function normalizeChildEntries(raw: unknown): ChildEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: ChildEntry[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const name =
      typeof (item as { name?: unknown }).name === 'string'
        ? ((item as { name: string }).name).trim()
        : '';
    if (!name) continue;
    const enrollmentYear = parseEnrollmentYear(
      (item as { enrollmentYear?: number | string | null }).enrollmentYear
    );
    // 구분자는 이름에 나올 수 없는 문자(NUL 이스케이프) — 공백·기호는 이름에 나올 수 있다.
    const key = `${name}\u0000${enrollmentYear ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, enrollmentYear });
    if (out.length >= MAX_CHILDREN) break;
  }
  return out;
}
