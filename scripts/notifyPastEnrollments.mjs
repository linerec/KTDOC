#!/usr/bin/env node
/**
 * 이미 배정됐지만 안내를 못 받은 원생에게 뒤늦게 등록 안내 보내기
 *
 * 신청 화면의 '수업 명단에 넣기'에는 원래 알림 호출이 없었다(수업 화면의 배정에는
 * 있었다). 그래서 신청서로 처리된 원생들은 자기가 어느 수업에 들어갔는지
 * 시스템으로부터 들은 바가 없다. 호출은 고쳤지만 그건 앞으로의 배정에만 적용된다 —
 * 이미 배정된 사람들에게는 이 스크립트로 한 번 보내야 한다.
 *
 * 대상은 **mail_log에 enrollment.created 기록이 없는** 활성 배정자다.
 * 이미 받은 사람에게 두 번 보내지 않는다.
 *
 * 학원(staff)에는 보내지 않는다 — 며칠 전 배정을 "새 등록이 있었습니다"로
 * 알리면 방금 일어난 일로 읽힌다. 원생·보호자에게만 간다.
 *
 * **기본은 미리보기다.** 실제 발송은 --send 를 붙여야 한다.
 *
 * 사용:
 *   node scripts/notifyPastEnrollments.mjs
 *   node scripts/notifyPastEnrollments.mjs --send
 *   node scripts/notifyPastEnrollments.mjs --only <userId>,<userId> --send
 */

import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const args = process.argv.slice(2);
const DO_SEND = args.includes('--send');
function flag(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? '') : '';
}
const ONLY = flag('only').split(',').map((s) => s.trim()).filter(Boolean);

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

register('./appAliasHooks.mjs', import.meta.url);

const { queryD1 } = await import('../lib/d1/client.ts');
const { notifyEvent } = await import('../lib/mail/notify.ts');
const { default: mysql } = await import('mysql2/promise');

// ── 1) 활성 배정 + 수업 정보 ──────────────────────────────────
const rows = await queryD1(
  `SELECT e.user_id, e.enrolled_at, p.title_ko, p.schedule_ko
     FROM program_enrollments e
     JOIN programs p ON p.id = e.program_id
    WHERE e.status = 'active'
    ORDER BY e.user_id, p.id`
);

// ── 2) 이미 등록 안내를 받은 주소 ─────────────────────────────
const alreadySent = await queryD1(
  `SELECT DISTINCT to_address FROM mail_log
    WHERE event_key = 'enrollment.created' AND audience = 'user' AND status = 'sent'`
);
const sentTo = new Set(alreadySent.map((r) => String(r.to_address).toLowerCase()));

// ── 3) 회원 이름·이메일 ───────────────────────────────────────
const ids = [...new Set(rows.map((r) => r.user_id))];
if (!ids.length) {
  console.log('\n배정된 원생이 없습니다.\n');
  process.exit(0);
}
const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
const [members] = await conn.query(
  `SELECT id, name, email, role FROM users WHERE id IN (${ids.map(() => '?').join(',')})`,
  ids
);
const [guardians] = await conn.query(
  `SELECT sg.student_id, g.name AS gname, g.email AS gemail
     FROM student_guardians sg JOIN users g ON g.id = sg.guardian_id
    WHERE sg.student_id IN (${ids.map(() => '?').join(',')})`,
  ids
);
await conn.end();

const byId = new Map(members.map((m) => [m.id, m]));
const guardiansOf = new Map();
for (const g of guardians) {
  if (!guardiansOf.has(g.student_id)) guardiansOf.set(g.student_id, []);
  guardiansOf.get(g.student_id).push(g);
}

// ── 4) 사람별로 묶기 ──────────────────────────────────────────
const byUser = new Map();
for (const r of rows) {
  if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
  byUser.get(r.user_id).push(r);
}

const plan = [];
for (const [userId, list] of byUser) {
  if (ONLY.length && !ONLY.includes(userId)) continue;
  const m = byId.get(userId);
  if (!m) {
    plan.push({ userId, skip: '회원을 찾을 수 없음' });
    continue;
  }
  // 역할별 테스트 계정(@ktdoc.org)은 실제 가정이 아니다.
  if (String(m.email ?? '').toLowerCase().endsWith('@ktdoc.org')) {
    plan.push({ userId, name: m.name, skip: '테스트 계정' });
    continue;
  }
  const gs = guardiansOf.get(userId) ?? [];
  const addresses = [m.email, ...gs.map((g) => g.gemail)].filter(Boolean);
  if (addresses.every((a) => sentTo.has(String(a).toLowerCase()))) {
    plan.push({ userId, name: m.name, skip: '이미 등록 안내를 받았음' });
    continue;
  }
  plan.push({
    userId,
    name: m.name,
    email: m.email,
    guardians: gs.map((g) => `${g.gname} <${g.gemail}>`),
    classes: list.map((r) => r.title_ko),
    schedules: list.map((r) => r.schedule_ko).filter(Boolean),
    enrolledAt: list[0].enrolled_at,
  });
}

// ── 5) 보여주기 ───────────────────────────────────────────────
const targets = plan.filter((p) => !p.skip);
const skipped = plan.filter((p) => p.skip);

console.log(`\n${DO_SEND ? '■ 발송' : '■ 미리보기 (실제로 보내려면 --send)'}\n`);
for (const p of targets) {
  console.log(`  ${p.name} <${p.email}>`);
  console.log(`    배정: ${p.enrolledAt}`);
  console.log(`    수업: ${p.classes.join(' · ')}`);
  if (p.guardians.length) console.log(`    보호자에게도: ${p.guardians.join(', ')}`);
  console.log(`    제목: 수업 등록 안내 — ${p.classes.join(', ')} / Class enrollment`);
  console.log('');
}
if (skipped.length) {
  console.log('  건너뜀:');
  for (const s of skipped) console.log(`    · ${s.name ?? s.userId} — ${s.skip}`);
  console.log('');
}
console.log(`  대상 ${targets.length}명 (수신자는 보호자 포함이라 이보다 많을 수 있습니다)\n`);

if (!DO_SEND) {
  console.log('  실제로 보내려면 --send 를 붙이세요.\n');
  process.exit(0);
}

// ── 6) 발송 ───────────────────────────────────────────────────
for (const p of targets) {
  await notifyEvent('enrollment.created', {
    userIds: [p.userId],
    // 학원에는 보내지 않는다 — 지나간 배정이라 '새 등록'으로 읽히면 안 된다.
    audiences: ['user'],
    data: {
      name: p.name ?? '',
      title: p.classes.join(', '),
      schedule: p.schedules.join(' / '),
    },
  });
  console.log(`  ✓ ${p.name}`);
}
console.log(`\n완료 — ${targets.length}명에게 보냈습니다. 결과는 /admin/mail 발송 내역에서 확인하세요.\n`);

// lib/db 의 MySQL 풀이 열린 채로 남아 이벤트 루프를 붙잡는다(앱에서는 계속
// 살아 있어야 하는 것이라 닫는 길이 없다). 할 일은 끝났으니 여기서 내려간다.
process.exit(0);
