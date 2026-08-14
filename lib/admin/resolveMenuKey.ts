/**
 * pathname → menu_key 매핑 (세그먼트 경계 longest-match)
 *
 * 문자 prefix가 아닌 "경로 세그먼트" 단위로 비교하므로
 * /admin/members-export 가 /admin/members(members) 로 오매핑되지 않는다.
 * 동적 자식(/admin/programs/[id])은 부모(programs) 키를 상속한다.
 * 미매핑 → null (호출부에서 fail-closed 처리: admin만 허용).
 *
 * DB 의존성 없음 — 미들웨어·서버 레이아웃·클라이언트가 공유한다.
 */

// node --test가 별칭(@/)을 풀지 못하므로 상대 경로로 쓴다 — 이 파일은 시험 대상이다.
import { MENU_REGISTRY } from './menu-registry.ts';
import type { MenuKey } from '../../types/permissions.ts';

export function resolveMenuKey(pathname: string | null | undefined): MenuKey | null {
  if (!pathname) return null;
  const segs = pathname.split('/').filter(Boolean); // '/admin/gallery/photos' → ['admin','gallery','photos']
  if (segs.length === 0) return null;

  let best: { key: MenuKey; len: number } | null = null;

  for (const node of MENU_REGISTRY) {
    const nodeSegs = node.href.split('/').filter(Boolean);

    if (node.exact) {
      // 정확히 일치할 때만(예: home = '/admin')
      if (segs.length === nodeSegs.length && nodeSegs.every((s, i) => s === segs[i])) {
        if (!best || nodeSegs.length > best.len) best = { key: node.key, len: nodeSegs.length };
      }
      continue;
    }

    // node 경로가 pathname의 prefix(세그먼트 단위)인가?
    if (nodeSegs.length > segs.length) continue;
    const isPrefix = nodeSegs.every((s, i) => s === segs[i]);
    if (isPrefix && (!best || nodeSegs.length > best.len)) {
      best = { key: node.key, len: nodeSegs.length };
    }
  }

  return best ? best.key : null;
}
