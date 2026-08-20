#!/usr/bin/env node
/**
 * 실패한 알림 메일 재발송
 *
 * 발송이 provider 쪽 사정으로 실패하면(도메인 미인증, 자격증명 만료 등)
 * mail_log에 'failed'로 남을 뿐 자동 재시도는 없다. 원인을 고친 뒤 그 사람들에게
 * 다시 보내는 것이 이 스크립트다. 관리 화면의 발송 내역은 읽기 전용이라
 * 여기 말고는 길이 없다.
 *
 * 본문·발송·로그를 앱과 같은 모듈로 처리한다. 문구를 여기 옮겨 적으면
 * 언젠가 앱과 갈라져서, 같은 사건인데 사람마다 다른 문장을 받게 된다.
 *
 * **기본은 미리보기다.** 실제 발송은 --send 를 붙여야 한다 —
 * 지나간 알림을 다시 보내는 일은 되돌릴 수 없다.
 *
 * 사용:
 *   node scripts/resendFailedMail.mjs --event member.approved
 *   node scripts/resendFailedMail.mjs --event member.approved --send
 *   node scripts/resendFailedMail.mjs --event member.approved --only a@b.com,c@d.com
 *
 * 안전장치
 * - 주소별로 한 통만 보낸다(같은 사람에게 실패가 여러 번 쌓여 있어도).
 * - 필수(essential) 이벤트가 아니면 **현재** 수신거부인 사람은 건너뛴다.
 *   실패 당시에는 수신 동의였어도 그 사이 껐을 수 있다.
 * - 한도를 넘기면 아예 보내지 않는다.
 */

import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ── 인자 ─────────────────────────────────────────────────────
const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? '') : '';
}
const EVENT_KEY = flag('event');
const DO_SEND = args.includes('--send');
const ONLY = flag('only')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

if (!EVENT_KEY) {
  console.error('\n✗ --event <키>가 필요합니다. 예: --event member.approved\n');
  process.exit(1);
}

// ── 환경 ─────────────────────────────────────────────────────
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
    const value = m[2].trim().replace(/^["']|["']$/g, '');
    if (!(m[1] in process.env)) process.env[m[1]] = value;
  }
}
loadEnv('.env.local');

/** 메일 본문의 링크는 공개 사이트를 가리켜야 한다(로컬 개발 주소가 아니라). */
const SITE_URL = process.env.MAIL_LINK_URL || 'https://ktdoc.org';
const TIME_ZONE = process.env.CALENDAR_TIMEZONE || 'America/New_York';

// ── 앱 모듈 (별칭 해석기를 먼저 등록한다) ─────────────────────
register('./appAliasHooks.mjs', import.meta.url);

const { renderMailBody } = await import('../lib/mail/templates/index.ts');
const { resolveMailConfig, sendMail } = await import('../lib/mail/mailer.ts');
const { mergeMailConfig, SETTING_MAIL_CONFIG } = await import('../lib/mail/config.ts');
const { getMailEvent, isEssential } = await import('../lib/mail/events.ts');
const { decideQuota } = await import('../lib/mail/quota.ts');
const { getSetting } = await import('../lib/d1/settings.ts');
const { queryD1 } = await import('../lib/d1/client.ts');
const { insertMailLogs, getUsageCounts } = await import('../lib/d1/mailLog.ts');
const { default: mysql } = await import('mysql2/promise');

const eventDef = getMailEvent(EVENT_KEY);
if (!eventDef) {
  console.error(`\n✗ 모르는 이벤트 키: ${EVENT_KEY}\n`);
  process.exit(1);
}

// ── 1) 실패 기록에서 대상 뽑기 ───────────────────────────────
const failed = await queryD1(
  `SELECT to_address, audience, MIN(created_at) AS first_at, COUNT(*) AS tries
     FROM mail_log
    WHERE event_key = ? AND status = 'failed'
    GROUP BY to_address, audience
    ORDER BY first_at`,
  [EVENT_KEY]
);

let targets = failed.filter((r) => r.to_address && r.to_address.includes('@'));
if (ONLY.length) {
  targets = targets.filter((r) => ONLY.includes(r.to_address.toLowerCase()));
}
if (!targets.length) {
  console.log(`\n${EVENT_KEY}: 재발송할 실패 기록이 없습니다.\n`);
  process.exit(0);
}

// ── 2) 회원 정보(이름·수신 동의) 붙이기 ──────────────────────
const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
const [members] = await conn.query(
  `SELECT email, name, email_opt_in FROM users WHERE email IN (${targets.map(() => '?').join(',')})`,
  targets.map((t) => t.to_address)
);
await conn.end();

const byEmail = new Map(
  members.map((m) => [String(m.email).toLowerCase(), m])
);

const plan = targets.map((t) => {
  const member = byEmail.get(t.to_address.toLowerCase());
  const essential = isEssential(eventDef, t.audience);
  const optedOut = member ? member.email_opt_in === 0 : false;
  return {
    to: t.to_address,
    audience: t.audience,
    name: member?.name ?? '',
    firstAt: t.first_at,
    tries: t.tries,
    // 수신거부는 필수 이벤트만 무시한다.
    skip: !essential && optedOut ? '수신거부' : null,
  };
});

const sending = plan.filter((p) => !p.skip);

console.log(`\n${eventDef.label} (${EVENT_KEY}) — 실패 기록 ${plan.length}명\n`);
for (const p of plan) {
  const mark = p.skip ? `건너뜀(${p.skip})` : DO_SEND ? '보냄' : '보낼 예정';
  console.log(
    `  ${mark.padEnd(14)} ${p.to.padEnd(32)} ${(p.name || '(이름 없음)').padEnd(16)} 최초실패 ${String(p.firstAt).slice(5, 16)}`
  );
}

if (!sending.length) {
  console.log('\n보낼 대상이 없습니다.\n');
  process.exit(0);
}

// ── 3) 설정·한도 ─────────────────────────────────────────────
const config = mergeMailConfig(await getSetting(SETTING_MAIL_CONFIG));
const resolved = resolveMailConfig(config);
if (resolved.provider === 'none') {
  console.error(`\n✗ 메일 설정이 미완성입니다(${resolved.reason}).\n`);
  process.exit(1);
}

const usage = await getUsageCounts(TIME_ZONE);
const quota = decideQuota(usage, config.quota, sending.length, false);
console.log(
  `\n오늘 ${usage.dailySent}/${config.quota.dailyLimit} · 이번 달 ${usage.monthlySent}/${config.quota.monthlyLimit}` +
    ` → ${sending.length}통 추가`
);
if (!quota.allow) {
  console.error(`\n✗ 한도를 넘습니다(${quota.reason}). 보내지 않았습니다.\n`);
  process.exit(1);
}

console.log(`발신 ${resolved.from} · 답장 ${resolved.replyTo || '(없음)'} · 링크 ${SITE_URL}`);

if (!DO_SEND) {
  // 실제로 나갈 문장을 보여 준다. 8명에게 뿌린 뒤에 오타를 발견하면 늦다.
  const sample = renderMailBody(EVENT_KEY, sending[0].audience, {
    name: sending[0].name,
    url: SITE_URL,
  });
  console.log(`\n─── ${sending[0].to} 에게 나갈 본문 ───`);
  console.log(`제목: ${sample.subject}\n`);
  console.log(sample.text);
  console.log(`─────────────────────────────────`);
  console.log(`\n미리보기입니다. 실제로 보내려면 --send 를 붙이세요.\n`);
  process.exit(0);
}

// ── 4) 발송 + 기록 ───────────────────────────────────────────
const logs = [];
let ok = 0;

for (const p of sending) {
  const body = renderMailBody(EVENT_KEY, p.audience, {
    name: p.name,
    url: SITE_URL,
  });
  const result = await sendMail(resolved, {
    to: [p.to],
    subject: body.subject,
    text: body.text,
  });
  if (result.ok) ok++;
  console.log(`  ${result.ok ? '✓' : '✗'} ${p.to}${result.ok ? '' : ` — ${result.detail}`}`);

  logs.push({
    eventKey: EVENT_KEY,
    audience: p.audience,
    toAddress: p.to,
    subject: body.subject,
    body: eventDef.redactBody ? null : body.text,
    status: result.ok ? 'sent' : 'failed',
    detail: result.ok ? '재발송' : result.detail ?? null,
    provider: resolved.provider,
    providerId: result.providerId ?? null,
    quotaDaily: result.quotaDaily ?? null,
    quotaMonthly: result.quotaMonthly ?? null,
  });
}

await insertMailLogs(logs);
console.log(`\n${ok}/${sending.length}통 발송. 발송 내역(/admin/mail)에 기록했습니다.\n`);
