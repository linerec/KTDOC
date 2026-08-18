#!/usr/bin/env node
/**
 * 연혁 시더 (2008–2026)
 *
 * 원장님이 2026-08-17 메일로 보내신 연혁 PDF 두 개(국문·영문)를 옮겨 적은
 * docs/content/choomnoori/2026-08-17-춤누리-연혁.md 를 읽어 events 테이블에 넣는다.
 *
 * 이 항목들은 대부분 제목 한 줄뿐이다(사진·설명 없음). 그래서 화면에서는
 * 카드가 아니라 '연혁층' 한 줄로 그려지고 링크가 생기지 않는다 —
 * 판정 규칙은 lib/events/chronicle.ts 한 곳에 있다.
 * 나중에 사진이 붙으면 같은 규칙이 자동으로 '기록층'으로 승격시킨다.
 *
 * 날짜: 연혁 대부분은 연도만 안다. events.event_date 가 NOT NULL 이므로
 * 연도만 아는 항목은 YYYY-01-01, 월까지 아는 항목(2026년)은 YYYY-MM-01 로 둔다.
 * 연혁층은 날짜를 화면에 내보내지 않으므로 이 근사치가 노출되지 않는다.
 *
 * 멱등: slug UNIQUE + INSERT OR IGNORE — 재실행해도 중복 생성 없음.
 * 정리: DELETE FROM events WHERE slug LIKE 'chronicle-%'
 *
 * 사용: npm run seed:chronicle  (--dry-run 으로 미리보기)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnv(file) {
  let text;
  try {
    text = readFileSync(join(root, file), 'utf8');
  } catch {
    return;
  }
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    const value = m[2].trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnv('.env.local');

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const DB_ID = process.env.D1_DATABASE_ID;
const DRY_RUN = process.argv.includes('--dry-run');

if (!DRY_RUN && (!ACCOUNT_ID || !API_TOKEN || !DB_ID)) {
  console.error('D1 설정 누락: CLOUDFLARE_ACCOUNT_ID·CLOUDFLARE_API_TOKEN·D1_DATABASE_ID 확인.');
  process.exit(1);
}

async function d1(sql, params = []) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) {
    throw new Error(body?.errors?.[0]?.message || `D1 API error (${res.status})`);
  }
  return body.result[0];
}

// ── 원문 파싱 ────────────────────────────────────────────────────────────
const SOURCE = join(root, 'docs/content/choomnoori/2026-08-17-춤누리-연혁.md');

/** '## 국문 연혁' / '## English' 아래의 '### 2008' + '- 항목' 을 연도별로 모은다 */
function parseSection(text, heading) {
  const after = text.split(heading)[1];
  if (!after) throw new Error(`원문에서 '${heading}' 섹션을 찾지 못했습니다.`);
  const body = after.split('\n---\n')[0];
  const byYear = new Map();
  let year = null;
  for (const line of body.split('\n')) {
    const h = line.trim().match(/^### (\d{4})$/);
    if (h) {
      year = Number(h[1]);
      byYear.set(year, []);
      continue;
    }
    if (year && line.startsWith('- ')) byYear.get(year).push(line.slice(2).trim());
  }
  return byYear;
}

const KO_MONTHS = { '01': 1, '02': 2, '03': 3, '04': 4, '05': 5, '06': 6,
                    '07': 7, '08': 8, '09': 9, '10': 10, '11': 11, '12': 12 };

/**
 * '**02월** | 뉴욕 타임스퀘어…' 처럼 월이 앞에 붙은 항목에서 월과 제목을 분리한다.
 * 영문판은 '**February** | Official opening…' 형태다.
 */
function splitMonth(raw) {
  const m = raw.match(/^\*\*([^*]+)\*\*\s*\|\s*(.+)$/);
  if (!m) return { month: null, title: stripMarkdown(raw) };
  const label = m[1].trim();
  const ko = label.match(/^(\d{2})월$/);
  if (ko) return { month: KO_MONTHS[ko[1]], title: stripMarkdown(m[2]) };
  const en = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ].indexOf(label.toLowerCase());
  return { month: en >= 0 ? en + 1 : null, title: stripMarkdown(m[2]) };
}

function stripMarkdown(s) {
  return s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * 이미 events 에 실데이터로 들어 있는 행사와 겹치는 연혁 항목.
 * 연혁에도 적혀 있고 이벤트로도 등록돼 있어 그대로 넣으면 같은 행사가 두 번 나온다.
 * 연도 + 제목 조각으로 걸러낸다.
 */
const SKIP = [
  { year: 2026, contains: '레전드 글로벌 대축제' }, // events #53
  { year: 2026, contains: '광복절 기념행사 초청공연' }, // events #57
];

function isSkipped(year, titleKo) {
  return SKIP.some((s) => s.year === year && titleKo.includes(s.contains));
}

// ── 조립 ─────────────────────────────────────────────────────────────────
const text = readFileSync(SOURCE, 'utf8');
const ko = parseSection(text, '## 국문 연혁');
const en = parseSection(text, '## English');

const years = [...ko.keys()].sort((a, b) => a - b);
const rows = [];
const skipped = [];

for (const year of years) {
  const koItems = ko.get(year) || [];
  const enItems = en.get(year) || [];
  if (koItems.length !== enItems.length) {
    throw new Error(`${year}년 국문 ${koItems.length}건 / 영문 ${enItems.length}건 — 개수가 다릅니다.`);
  }
  koItems.forEach((rawKo, i) => {
    const k = splitMonth(rawKo);
    const e = splitMonth(enItems[i]);
    if (isSkipped(year, k.title)) {
      skipped.push(`${year} ${k.title}`);
      return;
    }
    const month = k.month ?? e.month ?? 1;
    rows.push({
      slug: `chronicle-${year}-${String(i + 1).padStart(2, '0')}`,
      year,
      date: `${year}-${String(month).padStart(2, '0')}-01`,
      ko: k.title,
      en: e.title,
    });
  });
}

console.log(`연혁 ${rows.length}건 준비 (원문 85건 − 기존 이벤트와 중복 ${skipped.length}건)`);
if (skipped.length) skipped.forEach((s) => console.log(`  건너뜀: ${s}`));

if (DRY_RUN) {
  for (const r of rows.slice(0, 5)) console.log(`  ${r.slug}  ${r.date}  ${r.ko}`);
  console.log(`  … 외 ${Math.max(0, rows.length - 5)}건`);
  process.exit(0);
}

// ── 투입 ─────────────────────────────────────────────────────────────────
let inserted = 0;
for (const r of rows) {
  const res = await d1(
    `INSERT OR IGNORE INTO events
       (slug, year, event_date, title_ko, title_en, kind, is_published, is_featured, view_count)
     VALUES (?, ?, ?, ?, ?, 'performance', 1, 0, 0)`,
    [r.slug, r.year, r.date, r.ko, r.en]
  );
  if (res.meta?.changes) inserted += 1;
}

console.log(`\n투입 완료 — 새로 넣음 ${inserted}건, 이미 있어 건너뜀 ${rows.length - inserted}건`);
const total = await d1('SELECT COUNT(*) AS n FROM events');
console.log(`events 총 ${total.results[0].n}건`);
