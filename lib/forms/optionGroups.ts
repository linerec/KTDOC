/**
 * lib/forms/optionGroups.ts — 함께 고를 수 없는 선택지 짝
 *
 * 삼고무와 오고무는 같은 시간(2:15~3:00)의 다른 수업이라 한 사람이 둘 다 들을 수 없다.
 * 그런 관계가 앞으로도 생긴다(난타 1드럼/3드럼이 이미 그렇다).
 *
 * **그래서 코드는 어떤 과목이 무엇인지 모른다.** 선택지에 붙은 `exclusiveGroup` 이름표가
 * 같은지만 본다. 새 배타 관계는 편집기에서 이름 하나를 적으면 생긴다 — 배포가 필요 없다.
 *
 * 세 화면이 이 판정을 공유한다:
 *   - 공개 신청서·대신 입력(FormField) — 짝을 눌리지 않게 막는다
 *   - 서버 검증(schema.validateAnswers) — 화면을 우회한 제출을 거른다
 *   - 편집기(OptionTable) — 이름을 적는 자리
 *
 * **이미 저장된 응답은 소급 무효가 되지 않는다.** 규칙이 생기기 전에 둘 다 고른 응답이
 * 실재한다(#117). 검증은 새 제출에만 걸리고, 옛 응답은 `exclusiveConflicts` 로 운영자에게
 * 보이기만 한다 — 지우는 것이 아니라 알리는 것이 맞다.
 *
 * ※ node --test 가 @/ 별칭을 풀지 못하므로 import 는 상대 경로 + .ts 로.
 */

import type { FormOption } from '../../types/forms.ts';

/** 살아 있는 선택지 중 그룹 이름이 있는 것만. 빈 문자열은 그룹이 아니다(편집기에서 지운 자리). */
function grouped(options: FormOption[]): { option: FormOption; group: string }[] {
  const out: { option: FormOption; group: string }[] = [];
  for (const o of options) {
    if (o.retired) continue;
    const group = o.exclusiveGroup?.trim();
    if (group) out.push({ option: o, group });
  }
  return out;
}

/**
 * 지금 고른 것들 때문에 **고를 수 없게 된** 선택지 → 막고 있는 선택지.
 *
 * 고른 것 자신은 절대 막지 않는다 — 막으면 해제할 길이 사라져 신청자가 갇힌다.
 * 한 그룹에서 이미 둘 이상 골라 있는 옛 응답이라면 먼저 나온 쪽을 막는 쪽으로 적는다
 * (어느 쪽을 적어도 화면은 "고른 것은 안 막는다"로 같게 동작한다).
 */
export function blockedByExclusive(
  options: FormOption[],
  picked: string[]
): Map<string, string> {
  const live = grouped(options);
  const pickedSet = new Set(picked);

  /** 그룹 → 그 그룹에서 이미 골라 둔 첫 선택지 */
  const holder = new Map<string, string>();
  for (const { option, group } of live) {
    if (pickedSet.has(option.key) && !holder.has(group)) holder.set(group, option.key);
  }

  const blocked = new Map<string, string>();
  for (const { option, group } of live) {
    const by = holder.get(group);
    if (!by) continue;
    if (option.key === by) continue;
    if (pickedSet.has(option.key)) continue; // 옛 응답이 둘 다 골라 둔 경우 — 해제할 수 있어야 한다
    blocked.set(option.key, by);
  }
  return blocked;
}

/**
 * 규칙을 깨고 함께 골라 둔 짝들. 그룹마다 한 묶음이고, 없으면 빈 배열이다.
 *
 * 검증은 이것이 비어 있기를 요구한다. 운영 화면은 이것을 **경고로** 쓴다 —
 * 규칙이 생기기 전에 들어온 응답은 지우지 않고 표시만 한다.
 */
export function exclusiveConflicts(options: FormOption[], picked: string[]): string[][] {
  const pickedSet = new Set(picked);
  const byGroup = new Map<string, string[]>();

  for (const { option, group } of grouped(options)) {
    if (!pickedSet.has(option.key)) continue;
    const list = byGroup.get(group) ?? [];
    list.push(option.key);
    byGroup.set(group, list);
  }

  return [...byGroup.values()].filter((keys) => keys.length > 1);
}

/** 이 문항에서 실제로 쓰이고 있는 그룹 이름들(처음 나온 순서). 편집기의 제안 목록. */
export function exclusiveGroupNames(options: FormOption[]): string[] {
  const seen: string[] = [];
  for (const { group } of grouped(options)) {
    if (!seen.includes(group)) seen.push(group);
  }
  return seen;
}
