/**
 * lintTheme.mjs — 라이트/다크 테마가 조용히 깨지는 것을 막는 정적 검사
 *
 * 이 프로젝트의 색은 app/globals.css 한 곳에 모여 있고, 라이트 테마는
 * html[data-site-theme='light'] 블록이 토큰을 뒤집는 방식으로 동작한다.
 * 그래서 다음 두 가지가 **에러 없이 조용히** 깨진다:
 *
 *  1. 고정 배경(금색 칩, 붉은 버튼, 사진 스크림) 위 전경에 테마 토큰을 쓰면,
 *     토큰이 뒤집히는 순간 글자가 배경과 같은 색이 되어 사라진다.
 *  2. 새 히어로 페이지를 추가하면서 다크 섬 목록에 등록하지 않으면,
 *     라이트에서 밝은 사진 위에 먹색 글자가 얹혀 읽히지 않는다.
 *
 * 둘 다 빌드도 타입체크도 통과한다. 사람 눈으로 88개 화면을 매번 볼 수는 없으므로
 * 규칙으로 못박는다.
 *
 * 예외는 선언 줄이나 바로 윗줄에 다음 주석을 달아 등록한다:
 *   /* theme-exempt: 사유 *\/
 *
 * 사용:
 *   node scripts/lintTheme.mjs            위반이 있으면 exit 1
 *   node scripts/lintTheme.mjs --summary  개수만 보고 항상 exit 0 (작업 중 진행률 확인용)
 */

import { readFileSync, existsSync } from 'node:fs';

const CSS_PATH = new URL('../app/globals.css', import.meta.url);
const LEDGER_PATH = new URL('../docs/operations/theme-token-ledger.json', import.meta.url);

const summaryOnly = process.argv.includes('--summary');
const src = readFileSync(CSS_PATH, 'utf8');
const lines = src.split('\n');

/**
 * 히어로는 두 종류다. 새 히어로를 만들면 **반드시 둘 중 하나에 등록**해야 하고,
 * 어디에도 없으면 이 린트가 실패한다 — 등록을 잊어 라이트에서 조용히 깨지는 것을 막는다.
 *
 * 1) 사진 히어로 = 다크 섬. 배경이 실제 사진이라 라이트에서도 어두운 캔버스를 유지한다.
 *    운영자가 어떤 사진을 올릴지 알 수 없으므로 '어두운 스크림 + 밝은 글자'가 유일하게
 *    안전한 조합이다. 섬 루트에서 토큰을 로컬 재선언하므로 하위는 손대지 않는다.
 */
const DARK_ISLANDS = [
  '#hero',
  '.hero-art-bg',
  '.about-hero',
  '.feature-hero',
  '.performance-hero',
  '.program-detail-hero',
  '.event-detail-hero',
  '.gallery-lightbox',
  '.camp-spotlight',
];

/**
 * 2) 지면 히어로 = 사진 없이 먹 그라디언트만 깔린 타이틀 화면. 라이트에서는 한지로
 *    뒤집혀야 한다. 이들은 두 개의 반복 관용구를 공유하므로 개별 대응이 아니라
 *    --hero-veil/--hero-glow/--hero-ground/--hero-wash 토큰으로 한 번에 처리한다.
 */
const GROUND_HEROES = [
  '.gallery-hero',
  '.students-hero',
  '.timeline-hero',
  '.glossary-hero',
  '.media-hero',
  '.performances-hero',
  '.classes-hero',
  '.calendar-hero',
  '.rsvp-hero',
  '.legal-hero',
  '.classes-loading-hero',
  '.sibguide-hero',
];

/**
 * 사진 위에 **고정 어두운 스크림**을 깔고 그 위에 글자를 얹는 컴포넌트들.
 * 스크림이 자기 블록이 아니라 형제 규칙에 있으면 같은 블록 검사로는 잡히지 않아
 * 여기 명시한다. 이 접두사로 시작하는 셀렉터에서 테마 전경 토큰을 쓰면 실패한다
 * (사진 위는 var(--on-media)가 정답).
 *
 * 새 '사진 카드'를 만들면 여기 추가할 것 — 안 하면 라이트에서 캡션이 조용히 사라진다.
 */
const MEDIA_SCRIM_COMPONENTS = [
  '.category-',        // 홈 카테고리 카드 — .image-object-content-overlay가 스크림
];

/** 관리 콘솔 전용 셀렉터 접두사 — 이번 규칙의 대상이 아니다. */
const ADMIN_PREFIXES = [
  'admin', 'cal-', 'library-', 'photo-drawer', 'photo-modal', 'event-picker',
  'location-picker', 'push-card', 'inbox', 'ai-', 'seo-', 'supply-', 'supplies-',
  'enroll', 'dash-', 'notify', 'perm-', 'qna-', 'faq-', 'member-', 'onboard',
  'myclass-', 'photo-inbox', 'push-', 'comment-', 'a2hs-',
];

/** 상태 클래스는 소속을 말해 주지 않으므로 판정에서 제외한다(.is-active, .active, .selected …) */
const STATE_CLASSES = /^\.(is-|has-)|^\.(active|selected|open|on|current|disabled|error|loading)$/;

const isAdminSelector = (sel) => {
  const classes = (sel.match(/\.[a-zA-Z0-9_-]+/g) ?? []).filter((c) => !STATE_CLASSES.test(c));
  if (!classes.length) return false;
  return classes.every((c) => ADMIN_PREFIXES.some((p) => c.slice(1).startsWith(p)));
};

/**
 * 다크 섬의 **후손** 셀렉터. CSS 셀렉터가 `.hero-lede`처럼 섬 루트를 포함하지 않아도
 * 마크업상 섬 안이면 리터럴이 정답이다(섬 루트가 토큰을 로컬 재선언하므로).
 * 접두사가 겹치는 편집기 모달(.hero-tone-*, .hero-bg-*, .hero-video-pick-*)은
 * portal로 body에 붙어 섬 밖이므로 여기 넣으면 안 된다.
 */
const ISLAND_DESCENDANTS = [
  '.hero-title', '.hero-lede', '.hero-since', '.hero-kicker', '.hero-ink-wash',
  '.hero-art-', '.hero-container', '.hero-content', '.hero-left', '.hero-right',
  '.hero-videos', '.btn-youtube', '.video-card', '.play-icon',
  '.about-hero-', '.feature-hero-', '.performance-hero-', '.program-detail-hero-',
  '.gallery-lightbox-', '.camp-spotlight-', '.camp-fact-',
  '.event-detail-hero-', '.event-detail-eyebrow', '.event-detail-back',
  '.event-detail-year', '.event-detail-kind', '.event-detail-category',
  '.event-detail-title', '.event-detail-when', '.event-detail-time', '.event-detail-venue',
];

const inDarkIsland = (sel) =>
  DARK_ISLANDS.some((d) => sel.includes(d)) || ISLAND_DESCENDANTS.some((d) => sel.includes(d));

/** 선언 줄 또는 바로 윗줄의 theme-exempt 주석 */
function isExempt(idx) {
  const here = lines[idx] ?? '';
  const above = lines[idx - 1] ?? '';
  return /theme-exempt:/.test(here) || /theme-exempt:/.test(above);
}

/* ── 셀렉터 추적 ────────────────────────────────────────────────────── */

function selectorsByLine() {
  const map = new Array(lines.length + 1).fill('');
  const stack = [];
  let pending = [];
  let inComment = false;
  // 여러 줄에 걸친 '값'(background: linear-gradient(\n …\n );)을 셀렉터로 오인하지 않도록
  // 선언이 아직 끝나지 않았는지 추적한다.
  let inDeclaration = false;

  lines.forEach((raw, i) => {
    // 여러 줄 주석을 셀렉터로 오인하지 않도록 주석을 먼저 걷어낸다.
    // (주석 안의 중괄호도 함께 사라져 스택이 어긋나지 않는다.)
    let line = raw;
    let stripped = '';
    let pos = 0;
    while (pos < line.length) {
      if (inComment) {
        const end = line.indexOf('*/', pos);
        if (end === -1) { pos = line.length; break; }
        inComment = false;
        pos = end + 2;
      } else {
        const start = line.indexOf('/*', pos);
        if (start === -1) { stripped += line.slice(pos); break; }
        stripped += line.slice(pos, start);
        inComment = true;
        pos = start + 2;
      }
    }

    const opens = (stripped.match(/\{/g) ?? []).length;
    const closes = (stripped.match(/\}/g) ?? []).length;

    if (opens) {
      const header = [...pending, stripped.split('{')[0]].join(' ').replace(/\s+/g, ' ').trim();
      stack.push(header);
      pending = [];
    } else if (!closes) {
      const t = stripped.trim();
      // 쉼표로 이어지는 여러 줄 셀렉터. 선언 중이면 그건 값의 연장이지 셀렉터가 아니다.
      if (t && !t.includes(':') && !inDeclaration) pending.push(stripped);
    }

    map[i] = stack.filter((s) => !s.startsWith('@')).join(' ');

    // 선언 상태 갱신: ';'로 끝나면 닫힌 것, ':'가 있는데 ';'가 없으면 이어지는 중.
    {
      const t = stripped.trim();
      if (t.includes(';')) inDeclaration = false;
      else if (t.includes(':') && !t.endsWith('{')) inDeclaration = true;
      if (opens || closes) inDeclaration = false;
    }

    if (closes) for (let c = 0; c < closes; c++) stack.pop();
  });

  return map;
}

const selOf = selectorsByLine();

/* ── 대장(ledger) ───────────────────────────────────────────────────── */

let ledger = null;
if (existsSync(LEDGER_PATH)) {
  ledger = JSON.parse(readFileSync(LEDGER_PATH, 'utf8'));
}
/** 대장에 'flip(그대로 둬도 됨)'으로 등재된 셀렉터 집합 */
const flipAllowed = new Set(
  (ledger?.items ?? []).filter((i) => i.verdict === 'flip').map((i) => i.selector)
);
const ledgerSelectors = new Set((ledger?.items ?? []).map((i) => i.selector));

/* ── 규칙 ───────────────────────────────────────────────────────────── */

const problems = [];
const add = (rule, line, message, selector) =>
  problems.push({ rule, line: line + 1, message, selector: selector || '(전역)' });

// 규칙 1 — :root 선언은 최상단 1개 + 미디어쿼리 내부만.
// 파일 중간의 :root는 라이트 오버라이드가 뒤집지 못해 영영 다크 값으로 남는다.
{
  let seenTopLevel = 0;
  lines.forEach((raw, i) => {
    if (!/^\s*:root\s*\{/.test(raw)) return;
    const indented = /^\s+/.test(raw); // 미디어쿼리 안이면 들여쓰기돼 있다
    if (indented) return;
    seenTopLevel += 1;
    if (seenTopLevel > 1) {
      add(
        'root-single',
        i,
        ':root 선언은 파일 최상단 1개만 허용한다. 여기 선언된 토큰은 라이트 오버라이드가 ' +
          '뒤집지 못해 영영 다크 값으로 남는다 — 최상단 :root로 옮길 것.'
      );
    }
  });
}

// 규칙 2 — 금색을 텍스트로 쓰지 말 것.
// --soft-gold/--accent-color는 '배경용'이라 라이트에서도 밝은 금을 유지한다.
// 한지 위 밝은 금 글자는 대비 미달(WCAG 실패)이다.
lines.forEach((raw, i) => {
  if (!/^\s*(color|-webkit-text-fill-color)\s*:\s*var\(--(soft-gold|accent-color)\)/.test(raw)) return;
  const sel = selOf[i];
  if (isAdminSelector(sel) || isExempt(i) || inDarkIsland(sel)) return;
  add(
    'gold-as-text',
    i,
    '금색을 텍스트로 쓰고 있다. 라이트(한지)에서 대비가 무너진다 — ' +
      'var(--soft-gold-text) / var(--accent-text)를 쓸 것.',
    sel
  );
});

// 규칙 3 — 금 배경 위 글자에 --bg-color를 쓰지 말 것.
// --bg-color는 라이트에서 한지색으로 뒤집히는데 금 배경은 그대로라 글자가 사라진다.
lines.forEach((raw, i) => {
  if (!/^\s*color\s*:\s*var\(--bg-color\)/.test(raw)) return;
  const sel = selOf[i];
  if (isAdminSelector(sel) || isExempt(i) || inDarkIsland(sel)) return;
  add(
    'bg-color-as-fg',
    i,
    '전경색으로 --bg-color를 쓰고 있다. 대개 금색 배경 위 글자이며, 라이트에서 ' +
      '금 배경 위 한지색 글자가 되어 사라진다 — var(--on-accent)를 쓸 것.',
    sel
  );
});

// 규칙 4 — --warm-ivory를 전경으로 쓰는 자리는 반드시 대장에 등재돼 있어야 한다.
// 이 토큰은 라이트에서 #2c2114(거의 먹)로 뒤집힌다. 지면 위면 정답이지만
// 규칙 4-1 — 같은 블록에 '고정된 어두운 배경'이 있는데 전경이 테마 토큰인 경우.
// 사진 위 캡션·배지가 자기 스크림을 직접 갖는 흔한 형태다. 스크림은 리터럴이라
// 뒤집히지 않는데 전경만 먹으로 뒤집혀 글자가 통째로 사라진다.
// (.category-title·.gallery-video-thumb-title이 실제로 이렇게 깨져 있었다.)
{
  // 블록의 시작·끝을 알아야 '같은 블록'을 볼 수 있다
  const blockOf = new Array(lines.length).fill(null);
  {
    const stack = [];
    lines.forEach((raw, i) => {
      const opens = (raw.match(/\{/g) ?? []).length;
      const closes = (raw.match(/\}/g) ?? []).length;
      if (opens) for (let o = 0; o < opens; o++) stack.push(i);
      blockOf[i] = stack.length ? stack[stack.length - 1] : null;
      if (closes) for (let c = 0; c < closes; c++) stack.pop();
    });
  }
  const blockEnd = (start) => {
    let depth = 0;
    for (let i = start; i < lines.length; i++) {
      depth += (lines[i].match(/\{/g) ?? []).length;
      depth -= (lines[i].match(/\}/g) ?? []).length;
      if (depth === 0) return i;
    }
    return lines.length - 1;
  };
  // 뒤집히지 않는 어두운 리터럴 — 먹 계열 rgba와 검정
  const DARK_LITERAL = /rgba\(\s*(0|[0-9]|1[0-9]|2[0-5])\s*,\s*(0|[0-9]|1[0-9])\s*,\s*(0|[0-9]|1[0-9])\s*,\s*0?\.[3-9]/;
  const THEME_FG = /^\s*color\s*:\s*var\(--(text-color|text-muted|warm-ivory|white)\)/;

  lines.forEach((raw, i) => {
    if (!THEME_FG.test(raw)) return;
    const sel = selOf[i];
    if (isAdminSelector(sel) || isExempt(i) || inDarkIsland(sel)) return;
    // (a) 스크림이 자기 블록에 있는 경우
    const start = blockOf[i];
    let sameBlockScrim = false;
    if (start !== null) {
      const body = lines.slice(start, blockEnd(start) + 1).join('\n');
      sameBlockScrim = /background(-image|-color)?\s*:/.test(body) && DARK_LITERAL.test(body);
    }
    // (b) 스크림이 형제 규칙에 있는 컴포넌트 — 레지스트리로 안다
    const inScrimComponent = MEDIA_SCRIM_COMPONENTS.some((p) => sel.includes(p));

    if (!sameBlockScrim && !inScrimComponent) return;
    add(
      'fixed-dark-bg-theme-fg',
      i,
      (sameBlockScrim
        ? '같은 블록에 뒤집히지 않는 어두운 배경(리터럴 스크림)이 있는데 전경은 테마 토큰이다. '
        : '사진 위 스크림 컴포넌트(MEDIA_SCRIM_COMPONENTS) 안인데 전경이 테마 토큰이다. ') +
        '라이트에서 어두운 배경 위 먹 글자가 되어 사라진다 — var(--on-media)를 쓰거나, ' +
        '배경도 함께 뒤집는 값으로 바꿀 것.',
      sel
    );
  });
}

// 고정 배경(붉은 버튼·금 칩·사진) 위면 글자가 사라진다. 판단을 코드가 아니라
// 대장이 갖게 하고, 미등재를 실패로 만든다.
lines.forEach((raw, i) => {
  if (!/^\s*color\s*:\s*var\(--warm-ivory\)/.test(raw)) return;
  const sel = selOf[i];
  if (isAdminSelector(sel) || isExempt(i) || inDarkIsland(sel)) return;
  if (!ledger) {
    add('ivory-unledgered', i, '분류 대장(docs/operations/theme-token-ledger.json)이 없다.', sel);
    return;
  }
  if (!ledgerSelectors.has(sel)) {
    add(
      'ivory-unledgered',
      i,
      '--warm-ivory를 전경으로 쓰는데 분류 대장에 없다. 이 요소가 페이지 지면 위인지 ' +
        '고정 배경 위인지 판정해 대장에 등재할 것 — 판정 없이 두면 라이트에서 조용히 사라진다.',
      sel
    );
  } else if (!flipAllowed.has(sel)) {
    add(
      'ivory-should-be-fixed',
      i,
      '대장이 이 자리를 고정 배경 위로 판정했다 — var(--on-accent)/var(--on-media)로 바꿀 것.',
      sel
    );
  }
});

// 규칙 5 — 공개 구간에서 흰색·아이보리 리터럴 대신 채널 토큰을 쓸 것.
// rgba(255,255,255,α)는 라이트에서 한지 위 흰색이 되어 사라진다.
// 단 사진·영상 위 오버레이는 리터럴이 정답이므로 theme-exempt로 등록한다.
lines.forEach((raw, i) => {
  if (!/rgba\(\s*255,\s*255,\s*255/.test(raw) && !/rgba\(\s*246,\s*239,\s*226/.test(raw)) return;
  const sel = selOf[i];
  if (isAdminSelector(sel) || isExempt(i)) return;
  if (inDarkIsland(sel)) return; // 다크 섬 내부는 리터럴이 정답
  add(
    'literal-light-color',
    i,
    '흰색·아이보리 리터럴을 직접 쓰고 있다. 라이트에서 한지 위 흰색이 되어 사라진다 — ' +
      'rgba(var(--fg-rgb), α) / rgba(var(--ivory-rgb), α)를 쓸 것. ' +
      '사진·영상 위 오버레이라 리터럴이 정답이면 /* theme-exempt: 사유 */ 주석을 달 것.',
    sel
  );
});

// 규칙 6 — 히어로류 셀렉터는 다크 섬 목록에 등재돼 있어야 한다.
// 이 프로젝트의 유일한 장기 안전장치다. 새 히어로 페이지를 추가하면서 등록을
// 잊으면 아무 에러 없이 라이트에서 사진 위 글자가 사라진다.
{
  const heroSelectors = new Set();
  lines.forEach((raw, i) => {
    if (!/\{\s*$/.test(raw)) return;
    const header = raw.split('{')[0];
    const matches = header.match(/\.[a-zA-Z0-9_-]*hero[a-zA-Z0-9_-]*/g) ?? [];
    for (const m of matches) {
      // 히어로 '내부' 요소(.about-hero-title 등)가 아니라 히어로 루트만 본다
      const isRoot = /^\.[a-z]+(-[a-z]+)*-hero$/.test(m) || m === '.hero-art-bg';
      if (isRoot) heroSelectors.add(`${m}|${i}`);
    }
  });
  for (const entry of heroSelectors) {
    const [sel, idx] = entry.split('|');
    if (isAdminSelector(sel)) continue;
    const inIsland = DARK_ISLANDS.includes(sel);
    const inGround = GROUND_HEROES.includes(sel);
    if (inIsland && inGround) {
      add('hero-double-registered', Number(idx), `히어로 '${sel}'가 두 목록에 모두 있다.`, sel);
    } else if (!inIsland && !inGround) {
      add(
        'hero-unregistered',
        Number(idx),
        `히어로 루트 '${sel}'가 어느 목록에도 없다. 배경이 사진이면 DARK_ISLANDS(라이트에서도 ` +
          `어두운 캔버스 유지), 먹 그라디언트뿐이면 GROUND_HEROES(한지로 뒤집힘)에 등록할 것. ` +
          `등록을 잊으면 아무 에러 없이 라이트에서 글자가 사라진다.`,
        sel
      );
    }
  }
}

/* ── 보고 ───────────────────────────────────────────────────────────── */

const byRule = {};
for (const p of problems) (byRule[p.rule] ??= []).push(p);

const RULE_TITLES = {
  'root-single': ':root 단일 선언',
  'gold-as-text': '금색을 텍스트로 사용',
  'bg-color-as-fg': '--bg-color를 전경으로 사용',
  'fixed-dark-bg-theme-fg': '고정 어두운 배경 위 테마 전경 (글자 소실)',
  'ivory-unledgered': '--warm-ivory 대장 미등재',
  'ivory-should-be-fixed': '--warm-ivory 고정 배경 위 (교체 필요)',
  'literal-light-color': '흰색·아이보리 리터럴',
  'hero-unregistered': '히어로 미등록 (다크 섬/지면 중 택1)',
  'hero-double-registered': '히어로 이중 등록',
};

if (!problems.length) {
  console.log('테마 린트 통과 — 위반 없음');
  process.exit(0);
}

console.log(`\n테마 린트: ${problems.length}건\n`);
for (const [rule, items] of Object.entries(byRule)) {
  console.log(`■ ${RULE_TITLES[rule] ?? rule} — ${items.length}건`);
  if (!summaryOnly) {
    for (const p of items.slice(0, 500)) {
      console.log(`  globals.css:${p.line}  ${p.selector}`);
      console.log(`    ${p.message}`);
    }
    if (items.length > 40) console.log(`  … 외 ${items.length - 500}건`);
  }
  console.log('');
}

process.exit(summaryOnly ? 0 : 1);
