/**
 * 원장 소개를 위지윅 한 덩어리로 옮긴다 (일회성 이관)
 *
 * 옛 구조는 문단 3칸 + 무대 6칸 + 수상 1칸이 코드에 박혀 있었다. 칸이 모자라자
 * 한 칸에 엔터로 여러 줄을 넣으신 상태로 D1에 쌓여 있고, HTML은 줄바꿈을 공백으로
 * 접으므로 **화면에서는 그 줄들이 한 줄로 이어져 보인다**. 옮기면서 다시 가른다.
 *
 * 하는 일:
 *   1. D1에서 about.director.* 를 읽는다(운영 콘솔에서 고치신 것이 여기 있다)
 *   2. 없는 키는 locale/*.json 번들 기본값으로 채운다
 *   3. 우겨 넣은 줄을 <li> 하나씩으로 가르고, 한 덩어리 HTML로 조립한다
 *   4. 정화기를 통과시켜 about.director.profile 로 D1에 넣는다
 *   5. 같은 값을 locale/ko.json·en.json 에도 적는다 — 그래야 첫 렌더(SSR)와
 *      D1이 붙은 뒤의 화면이 같다(다르면 페이지가 한 번 덜컥인다)
 *
 * 옛 키는 지우지 않는다. 그게 원본 백업이다.
 *
 * 실행:
 *   node --experimental-strip-types --env-file=.env.local scripts/migrateDirectorProfile.mjs [--dry]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { sanitizeRichText, splitCrammedLines } from '../lib/html/richText.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');
const TARGET = 'about.director.profile';

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const DB = process.env.D1_DATABASE_ID;

async function d1(sql, params = []) {
  if (!ACCOUNT || !TOKEN || !DB) {
    throw new Error('D1 설정이 없습니다 — --env-file=.env.local 로 실행하세요.');
  }
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${DB}/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    }
  );
  const json = await res.json();
  if (!json.success) throw new Error(`D1 오류: ${JSON.stringify(json.errors)}`);
  return json.result[0];
}

/** 글자를 HTML 안에 넣을 수 있게 — 이관 대상에 태그가 섞여 있을 수 있다 */
const esc = (s) =>
  String(s)
    .replace(/&(?!#\d+;|#x[0-9a-fA-F]+;|[a-zA-Z][a-zA-Z0-9]{1,31};)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/**
 * 한 언어의 소개 한 덩어리를 조립한다.
 * 순서는 지금 화면에 보이는 그대로다 — 이관은 내용을 바꾸는 자리가 아니다.
 */
function compose(pick) {
  const out = [];

  for (const key of ['bio.1', 'bio.2', 'bio.3']) {
    for (const para of splitCrammedLines(pick(`about.director.${key}`))) {
      out.push(`<p>${esc(para)}</p>`);
    }
  }

  const stageTitle = pick('about.director.stages.title');
  const stageLead = pick('about.director.stages.lead');
  const stages = [];
  for (let n = 1; n <= 6; n++) {
    // 한 칸에 여러 줄이 들어 있다 — 여기서 다시 가른다
    stages.push(...splitCrammedLines(pick(`about.director.stages.${n}`)));
  }
  if (stageTitle) out.push(`<h3>${esc(stageTitle)}</h3>`);
  if (stageLead) out.push(`<p>${esc(stageLead)}</p>`);
  if (stages.length) out.push(`<ul>${stages.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`);

  const awardTitle = pick('about.director.awards.title');
  const awards = splitCrammedLines(pick('about.director.awards.1'));
  if (awardTitle) out.push(`<h3>${esc(awardTitle)}</h3>`);
  if (awards.length) out.push(`<ul>${awards.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>`);

  return sanitizeRichText(out.join(''));
}

/* ── 읽기 ───────────────────────────────────────────────────────────── */

const koJsonPath = join(ROOT, 'locale/ko.json');
const enJsonPath = join(ROOT, 'locale/en.json');
const koJson = JSON.parse(readFileSync(koJsonPath, 'utf8'));
const enJson = JSON.parse(readFileSync(enJsonPath, 'utf8'));

const { results } = await d1(
  'SELECT keycode, ko, en FROM locale_content WHERE keycode LIKE ?',
  ['about.director.%']
);
const db = new Map(results.map((r) => [r.keycode, r]));

/** D1이 이기고, 없으면 번들 기본값 */
const pickKo = (k) => (db.get(k)?.ko || '').trim() || (koJson[k] || '').trim();
const pickEn = (k) => (db.get(k)?.en || '').trim() || (enJson[k] || '').trim();

const ko = compose(pickKo);
const en = compose(pickEn);

const countLi = (html) => (html.match(/<li>/g) || []).length;

console.log(`\n한국어 — 문단 ${(ko.match(/<p>/g) || []).length}개 · 목록 ${countLi(ko)}줄`);
console.log(ko.replace(/></g, '>\n<'));
console.log(`\nEnglish — ${(en.match(/<p>/g) || []).length} paragraphs · ${countLi(en)} list items`);
console.log(en.replace(/></g, '>\n<'));

if (DRY) {
  console.log('\n--dry — 아무것도 저장하지 않았습니다.');
  process.exit(0);
}

/* ── 쓰기 ───────────────────────────────────────────────────────────── */

const exists = (await d1('SELECT id FROM locale_content WHERE keycode = ?', [TARGET])).results.length > 0;

// 이관은 한 번만 하는 일이다. 이미 옮겨 놓은 뒤에 이 스크립트가 다시 돌면, 콘솔에서
// 쓰신 글이 **옛 칸에 든 옛 내용**으로 되돌아간다 — 그것도 조용히. 옛 키는 백업으로
// 남겨 두었기 때문에 되돌릴 재료가 항상 여기 있어서 더 위험하다.
if (exists && !process.argv.includes('--force')) {
  console.error(
    `\n${TARGET} 가 이미 있습니다 — 덮어쓰지 않았습니다.\n` +
      '이 스크립트는 옛 키(bio.1·stages.*·awards.*)로부터 다시 조립합니다. 지금 덮어쓰면\n' +
      '콘솔에서 고치신 내용이 이관 당시 상태로 되돌아갑니다.\n' +
      '정말 되돌리려면 --force 를, 결과만 보려면 --dry 를 붙이세요.'
  );
  process.exit(1);
}

if (exists) {
  await d1(`UPDATE locale_content SET ko = ?, en = ?, updated_at = datetime('now') WHERE keycode = ?`, [
    ko,
    en,
    TARGET,
  ]);
} else {
  await d1('INSERT INTO locale_content (keycode, ko, en) VALUES (?, ?, ?)', [TARGET, ko, en]);
}
console.log(`\nD1 ${TARGET} ${exists ? '갱신' : '생성'} 완료`);

// 번들 기본값도 같은 값으로. 키 순서는 옛 bio.1 자리에 끼워 넣어 이웃과 붙여 둔다.
function writeBundle(path, obj, value) {
  const next = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'about.director.bio.1') next[TARGET] = value;
    // 옛 키는 남긴다 — 이관 원본이자, 되돌릴 일이 생기면 여기가 출발점이다
    next[k] = v;
  }
  if (!next[TARGET]) next[TARGET] = value;
  writeFileSync(path, JSON.stringify(next, null, 2) + '\n', 'utf8');
}

writeBundle(koJsonPath, koJson, ko);
writeBundle(enJsonPath, enJson, en);
console.log('locale/ko.json · locale/en.json 갱신 완료');
