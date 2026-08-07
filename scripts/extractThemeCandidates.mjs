/**
 * extractThemeCandidates.mjs — 라이트 테마 전환에서 '판단이 필요한' 색 선언을 뽑는다.
 *
 * 배경: --warm-ivory·--bg-color 같은 테마 토큰은 페이지 지면 위에서만 뒤집혀야 한다.
 * 고정된 바탕(금색 버튼, 붉은 그라디언트, 사진 스크림) 위에 놓인 전경에 같은 토큰이
 * 쓰이면, 토큰이 뒤집히는 순간 글자가 배경과 같은 색이 되어 사라진다.
 *
 * 이 스크립트는 그 판단에 필요한 문맥 — 셀렉터, 같은 블록의 background 선언,
 * 감싸는 @media, 파일 위치 — 을 각 사용처마다 모아 JSON으로 낸다. 판단 자체는
 * 사람(또는 에이전트)이 하고, 결과는 docs/operations/theme-token-ledger.json에 남는다.
 *
 * 사용: node scripts/extractThemeCandidates.mjs > /tmp/candidates.json
 */

import { readFileSync } from 'node:fs';

const CSS_PATH = new URL('../app/globals.css', import.meta.url);
const src = readFileSync(CSS_PATH, 'utf8');
const lines = src.split('\n');

/** 판단이 필요한 선언들. value는 정규식. */
const TARGETS = [
  { id: 'warm-ivory', re: /color:\s*var\(--warm-ivory\)/ },
  { id: 'bg-color', re: /color:\s*var\(--bg-color\)/ },
  { id: 'soft-gold', re: /color:\s*var\(--soft-gold\)/ },
  { id: 'accent-color', re: /color:\s*var\(--accent-color\)/ },
  { id: 'white-token', re: /color:\s*var\(--white\)/ },
  { id: 'ink-black', re: /color:\s*var\(--ink-black\)/ },
];

// admin 전용으로 볼 셀렉터 접두사. 나머지는 공개/공용으로 본다.
const ADMIN_PREFIXES = [
  'admin', 'cal-', 'library-', 'photo-drawer', 'photo-modal', 'event-picker',
  'location-picker', 'push-card', 'inbox', 'ai-', 'seo-', 'supply-', 'supplies-',
  'enroll', 'dash-', 'notify', 'perm-', 'qna-', 'faq-', 'member-', 'onboard',
];

/** 여러 줄 주석이 셀렉터 앞에 붙어 들어오는 것을 걷어낸다 */
function normalizeSelector(sel) {
  const i = sel.lastIndexOf('*/');
  const out = (i === -1 ? sel : sel.slice(i + 2)).trim();
  return out || sel.trim();
}

function scopeOf(selector) {
  const classes = selector.match(/\.[a-zA-Z0-9_-]+/g) ?? [];
  if (!classes.length) return 'unknown';
  const isAdmin = (c) => ADMIN_PREFIXES.some((p) => c.slice(1).startsWith(p));
  if (classes.every(isAdmin)) return 'admin';
  if (classes.some(isAdmin)) return 'mixed';
  return 'public';
}

/**
 * 중괄호를 세며 각 선언이 속한 규칙 블록과 감싸는 at-rule을 찾는다.
 * 전용 CSS 파서를 쓰지 않는 이유: 의존성을 늘리지 않고, 이 파일의 형식이
 * 일정해서(한 줄 한 선언, 셀렉터는 여는 중괄호 앞 줄들) 이 정도로 충분하다.
 */
function parse() {
  const rules = [];       // { selector, start, end, atRule, body[] }
  const stack = [];       // 여는 중괄호마다 { header, start, isAtRule }
  let pendingHeader = [];

  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    const line = raw.trim();
    if (!line || line.startsWith('/*') || line.startsWith('*')) {
      if (!line.includes('{')) return;
    }

    const opens = (raw.match(/\{/g) ?? []).length;
    const closes = (raw.match(/\}/g) ?? []).length;

    if (opens) {
      const header = [...pendingHeader, raw.split('{')[0]].join(' ').replace(/\s+/g, ' ').trim();
      stack.push({ header, start: lineNo, isAtRule: header.startsWith('@') });
      pendingHeader = [];
    } else if (!closes && line && !line.includes(':') && !line.startsWith('/*')) {
      // 여러 줄 셀렉터(쉼표로 이어지는 형태)
      pendingHeader.push(raw);
    }

    if (closes) {
      for (let c = 0; c < closes; c++) {
        const frame = stack.pop();
        if (frame && !frame.isAtRule) {
          rules.push({
            selector: normalizeSelector(frame.header),
            start: frame.start,
            end: lineNo,
            atRule: stack.filter((f) => f.isAtRule).map((f) => f.header).join(' > ') || null,
          });
        }
      }
    }
  });

  return rules;
}

const rules = parse();

function ruleAt(lineNo) {
  // 가장 안쪽(범위가 가장 좁은) 규칙
  let best = null;
  for (const r of rules) {
    if (lineNo > r.start && lineNo < r.end) {
      if (!best || r.end - r.start < best.end - best.start) best = r;
    }
  }
  return best;
}

const out = [];

lines.forEach((raw, i) => {
  const lineNo = i + 1;
  for (const t of TARGETS) {
    if (!t.re.test(raw)) continue;
    const rule = ruleAt(lineNo);
    if (!rule) {
      out.push({ token: t.id, line: lineNo, selector: '(규칙 밖)', decl: raw.trim() });
      continue;
    }
    const body = lines.slice(rule.start - 1, rule.end).map((l) => l.trim()).filter(Boolean);
    // 같은 블록에 배경이 있는가 — '고정 바탕 위 전경'을 가르는 1차 신호
    const bg = body.filter((l) => /^(background|background-color|background-image)\s*:/.test(l));
    out.push({
      token: t.id,
      line: lineNo,
      selector: rule.selector,
      scope: scopeOf(rule.selector),
      atRule: rule.atRule,
      decl: raw.trim(),
      ownBackground: bg,
      block: body,
    });
  }
});

const summary = {};
for (const o of out) {
  const k = `${o.token}/${o.scope ?? 'n/a'}`;
  summary[k] = (summary[k] ?? 0) + 1;
}

process.stdout.write(JSON.stringify({ total: out.length, summary, items: out }, null, 1));
