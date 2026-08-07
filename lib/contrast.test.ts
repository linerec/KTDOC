/**
 * lib/contrast.test.ts — 두 테마의 팔레트를 숫자로 잠근다.
 *
 * 색을 조정하면 이 테스트가 먼저 깨진다. 88개 화면을 매번 눈으로 보는 대신,
 * 팔레트 조합의 대비를 여기서 단언한다. 값은 globals.css의 :root와
 * html[data-site-theme='light'] 블록과 짝이다 — 함께 바꿀 것.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composite, contrastRatio, parseHex, relativeLuminance } from './contrast.ts';

const AA_TEXT = 4.5;
const AA_LARGE = 3;

/** globals.css :root (다크) */
const DARK = {
  bg: '#0a0a0a',
  bgDark: '#050505',
  text: '#ffffff',
  muted: '#888888',
  ivory: '#f6efe2',
  surface2: '#1a1a1a',
  goldText: '#e0b84f',
  accentText: '#d4a017',
  ground: '#090705',
};

/** globals.css html[data-site-theme='light'] (한지) */
const LIGHT = {
  bg: '#f6f1e6',
  bgDark: '#efe7d6',
  text: '#241b12',
  muted: '#6e6355',
  ivory: '#2c2114',
  surface2: '#e9e0cc',
  goldText: '#7d5f0b',
  accentText: '#7f5f0e',
  ground: '#f6f1e6',
};

/** 두 테마 공통 역할 토큰 */
const ROLE = {
  onAccent: '#14100b',
  onMedia: '#f6efe2',
  softGold: '#e0b84f',
  accentColor: '#d4a017',
  secondary: '#c4302b',
  deepRed: '#8f211d',
};

function check(label: string, fg: string, bg: string, min: number) {
  const ratio = contrastRatio(fg, bg);
  assert.ok(
    ratio >= min,
    `${label}: ${fg} on ${bg} = ${ratio.toFixed(2)}:1 (최소 ${min}:1)`
  );
}

test('계산기 자체 — 알려진 값과 맞는가', () => {
  assert.equal(contrastRatio('#ffffff', '#000000').toFixed(0), '21');
  assert.equal(contrastRatio('#ffffff', '#ffffff').toFixed(0), '1');
  assert.ok(Math.abs(relativeLuminance(parseHex('#ffffff')) - 1) < 1e-9);
  assert.ok(relativeLuminance(parseHex('#000000')) === 0);
  // 순서를 바꿔도 같다
  assert.equal(contrastRatio('#123456', '#abcdef'), contrastRatio('#abcdef', '#123456'));
});

test('다크 — 지면 위 텍스트', () => {
  check('본문', DARK.text, DARK.bg, AA_TEXT);
  check('보조 텍스트', DARK.muted, DARK.bg, AA_TEXT);
  check('아이보리 제목', DARK.ivory, DARK.bg, AA_TEXT);
  check('표면 위 본문', DARK.text, DARK.surface2, AA_TEXT);
  check('금색 텍스트', DARK.goldText, DARK.bg, AA_TEXT);
  check('강조 텍스트', DARK.accentText, DARK.bg, AA_LARGE);
  check('가장 깊은 지면 위 본문', DARK.text, DARK.ground, AA_TEXT);
});

test('라이트(한지) — 지면 위 텍스트', () => {
  check('본문', LIGHT.text, LIGHT.bg, AA_TEXT);
  check('보조 텍스트', LIGHT.muted, LIGHT.bg, AA_TEXT);
  check('아이보리(먹으로 뒤집힌) 제목', LIGHT.ivory, LIGHT.bg, AA_TEXT);
  check('표면 위 본문', LIGHT.text, LIGHT.surface2, AA_TEXT);
  check('금색 텍스트', LIGHT.goldText, LIGHT.bg, AA_TEXT);
  // 강조 금색은 작은 라벨(12px)에도 쓰이므로 본문 기준을 만족해야 한다 —
  // 브라우저 대비 스캔이 .timeline-event-card-date에서 4.49:1로 아슬하게 걸렸다.
  check('강조 텍스트', LIGHT.accentText, LIGHT.bg, AA_TEXT);
  check('가장 밝은 지면 위 본문', LIGHT.text, LIGHT.ground, AA_TEXT);
  check('푸터 지면 위 본문', LIGHT.text, LIGHT.bgDark, AA_TEXT);
});

test('금색 배경 위 글자는 두 테마에서 같은 색이어야 성립한다', () => {
  // --accent-color/--soft-gold는 라이트에서도 뒤집히지 않는다.
  // 그래서 그 위 글자(--on-accent)도 두 테마에서 같은 값이다.
  check('금 칩(soft-gold)', ROLE.onAccent, ROLE.softGold, AA_TEXT);
  check('금 버튼(accent-color)', ROLE.onAccent, ROLE.accentColor, AA_TEXT);

  // 반대로 지면 토큰을 전경으로 쓰면 라이트에서 무너진다 — 이게 --on-accent를 만든 이유다.
  assert.ok(
    contrastRatio(LIGHT.bg, ROLE.accentColor) < AA_TEXT,
    '금 배경 위 한지색 글자가 대비를 만족하면 --on-accent의 존재 이유가 사라진다'
  );
});

test('사진·영상 위 전경은 어두운 스크림과 짝이어야 한다', () => {
  // 사진 위 스크림은 rgba(8,5,4,0.65)~0.82. 최악(가장 옅은 스크림)을
  // 흰 사진 위에 합성해도 --on-media가 읽혀야 한다.
  const scrimOnWhite = composite('#080504', 0.65, '#ffffff');
  check('옅은 스크림 위 on-media', ROLE.onMedia, `#${[scrimOnWhite.r, scrimOnWhite.g, scrimOnWhite.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`, AA_LARGE);

  // 반대로 라이트 지면색을 사진 위에 쓰면 안 된다는 것도 확인한다
  const darkScrim = composite('#080504', 0.82, '#888888');
  const hex = `#${[darkScrim.r, darkScrim.g, darkScrim.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  assert.ok(
    contrastRatio(LIGHT.text, hex) < AA_TEXT,
    '어두운 스크림 위 먹 글자가 읽히면 다크 섬의 존재 이유가 사라진다'
  );
});

test('붉은 버튼 위 글자 — 라이트에서 --warm-ivory가 뒤집히면 사라진다', () => {
  // 이 프로젝트에서 가장 많이 반복된 함정. --on-media가 정답인 이유를 잠근다.
  check('붉은 그라디언트 위 on-media', ROLE.onMedia, ROLE.secondary, AA_LARGE);
  check('짙은 붉은색 위 on-media', ROLE.onMedia, ROLE.deepRed, AA_TEXT);

  assert.ok(
    contrastRatio(LIGHT.ivory, ROLE.secondary) < AA_LARGE,
    '붉은 배경 위 뒤집힌 아이보리(먹)가 읽히면 --on-media가 필요 없다는 뜻이다'
  );
});

test('라이트 섬(register-panel)은 두 테마에서 같은 대비를 갖는다', () => {
  // 로컬 토큰이라 테마와 무관하게 고정이다
  check('종이 카드 본문', '#241b12', '#f6efe2', AA_TEXT);
  check('종이 카드 보조', '#5a4a3a', '#f6efe2', AA_TEXT);
  check('종이 카드 금색 텍스트', '#7d5f0b', '#f6efe2', AA_TEXT);
});
