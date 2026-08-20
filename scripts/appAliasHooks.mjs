/**
 * 스크립트에서 앱 모듈을 그대로 import 하기 위한 '@/' 해석기
 *
 * 운영 스크립트가 앱과 다른 코드로 같은 일을 하면 언젠가 반드시 갈라진다
 * (본문 문구가 하나만 바뀌는 식으로). 그래서 스크립트도 lib/*.ts를 직접
 * 부르게 하는데, Node는 tsconfig의 paths를 모른다 — 그 간극만 메운다.
 *
 * 사용: register('./appAliasHooks.mjs', import.meta.url) 을 먼저 부르고
 *       그 뒤에 await import()로 앱 모듈을 불러온다(정적 import는 호이스팅돼
 *       등록보다 먼저 해석되므로 안 된다).
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Node ESM은 확장자를 붙여 주지 않는다. tsconfig가 허용하는 순서대로 찾는다. */
function withExtension(base) {
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mjs`,
    `${base}.js`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ];
  return candidates.find((p) => existsSync(p) && !p.endsWith('/')) ?? base;
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const resolved = withExtension(join(root, specifier.slice(2)));
    return next(pathToFileURL(resolved).href, context);
  }
  // TS 소스끼리는 확장자 없이 서로를 부른다('./client'). 번들러는 붙여 주지만
  // Node ESM은 안 붙인다 — 앱 모듈을 직접 부르는 이상 여기서도 메워야 한다.
  if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
    const base = join(dirname(fileURLToPath(context.parentURL)), specifier);
    const resolved = withExtension(base);
    if (resolved !== base) return next(pathToFileURL(resolved).href, context);
  }
  return next(specifier, context);
}
