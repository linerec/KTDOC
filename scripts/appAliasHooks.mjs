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

import { statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Node ESM은 확장자를 붙여 주지 않는다. tsconfig가 허용하는 순서대로 찾는다.
 *
 * **반드시 파일이어야 한다.** 같은 이름의 파일과 디렉터리가 나란히 있는 경우가
 * 있어서(lib/members.ts 와 lib/members/), 존재 여부만 보면 디렉터리를 골라
 * "Directory import is not supported"로 죽는다. 번들러는 파일을 고른다.
 */
function isFile(p) {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

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
  return candidates.find(isFile) ?? base;
}

/**
 * Next 전용 표식 모듈들. 앱에서는 "이 파일은 서버에서만 돈다"를 번들러에 알리는
 * 용도인데, Node로 직접 부르면 그냥 없는 패키지다. 스크립트는 애초에 서버이니
 * 빈 모듈로 바꿔 준다 — 이게 없으면 lib/mail/notify.ts 같은 모듈을 스크립트에서
 * 쓸 수 없어서, 같은 일을 하는 코드를 또 써야 한다(그러면 언젠가 갈라진다).
 */
const NEXT_MARKERS = new Set(['server-only', 'client-only']);
const EMPTY_MODULE = 'data:text/javascript,export{}';

/**
 * next/server 의 after() — 앱에서는 "응답을 보낸 뒤에 이어서 하라"는 뜻이다.
 * 스크립트에는 붙잡을 응답이 없으니 그 자리에서 실행하는 것이 같은 의미다.
 * (앱 코드는 after()가 요청 밖에서 던지는 것까지 이미 감안하고 있다.)
 */
const NEXT_SERVER_STUB =
  'data:text/javascript,' +
  encodeURIComponent('export const after = (fn) => { void fn(); };');

export async function resolve(specifier, context, next) {
  if (NEXT_MARKERS.has(specifier)) {
    return { url: EMPTY_MODULE, shortCircuit: true };
  }
  if (specifier === 'next/server') {
    return { url: NEXT_SERVER_STUB, shortCircuit: true };
  }
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
