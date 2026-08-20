#!/usr/bin/env node
/**
 * 발신 도메인 인증 자동화 — Resend 등록 → Cloudflare DNS 삽입 → 인증 확인
 *
 * 손으로 하면 "레코드 3~4줄을 옮겨 적는" 단계에서 오타가 나고, 그 오타는
 * 며칠 뒤 스팸함에서야 드러난다. 그래서 옮겨 적는 과정을 없앤다.
 *
 * 필요한 것 (환경변수):
 *   RESEND_API_KEY        발신 도메인을 등록할 Resend 계정 키.
 *                         없으면 D1의 mail.config에 저장된 키를 쓴다 —
 *                         앱이 실제로 발송에 쓰는 그 계정에 등록해야
 *                         인증해도 403이 계속되는 사고가 없다.
 *   CLOUDFLARE_DNS_TOKEN  해당 zone의 DNS 편집 권한 토큰.
 *                         D1용 CLOUDFLARE_API_TOKEN은 보통 zone 권한이 없어
 *                         쓸 수 없다(--records로 손입력 경로를 쓸 것).
 *
 * 사용:
 *   node scripts/setupMailDomain.mjs                    # mail.ktdoc.org
 *   node scripts/setupMailDomain.mjs mail.example.com   # 다른 도메인
 *   node scripts/setupMailDomain.mjs --status           # 현재 상태만 확인
 *   node scripts/setupMailDomain.mjs --records          # 레코드만 출력(손입력용)
 *   node scripts/setupMailDomain.mjs --verify           # DNS는 그대로, 인증만 재요청
 *
 * 안전장치: 같은 이름·종류의 레코드가 이미 있으면 값이 다를 때만 갱신한다.
 * 관계없는 레코드는 건드리지 않는다.
 */

import { readFileSync } from 'node:fs';

// ── 인자·환경 ────────────────────────────────────────────────
const args = process.argv.slice(2);
const statusOnly = args.includes('--status');
const recordsOnly = args.includes('--records');
const verifyOnly = args.includes('--verify');
/** DNS를 건드리지 않는 모드 — Cloudflare 토큰이 없어도 된다. */
const readOnly = statusOnly || recordsOnly || verifyOnly;
const SUBDOMAIN = args.find((a) => !a.startsWith('--')) || 'mail.ktdoc.org';
/** 루트 도메인(zone 이름). mail.ktdoc.org → ktdoc.org */
const ZONE_NAME = SUBDOMAIN.split('.').slice(-2).join('.');

function envFromFile(key) {
  try {
    const line = readFileSync('.env.local', 'utf8')
      .split('\n')
      .find((l) => l.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim() : '';
  } catch {
    return '';
  }
}

function die(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

const CF_TOKEN =
  process.env.CLOUDFLARE_DNS_TOKEN || envFromFile('CLOUDFLARE_DNS_TOKEN');

if (!CF_TOKEN && !readOnly) {
  die(
    `CLOUDFLARE_DNS_TOKEN이 없습니다 (${ZONE_NAME} zone의 DNS 편집 권한 토큰).\n` +
      `  토큰 없이 손으로 넣으려면: node scripts/setupMailDomain.mjs ${SUBDOMAIN} --records`
  );
}

/**
 * Resend 키는 D1의 mail.config가 원본이다.
 * 환경변수로 덮어쓸 수는 있지만, 기본은 앱이 실제로 쓰는 그 키다.
 */
async function resolveResendKey() {
  const fromEnv = process.env.RESEND_API_KEY || envFromFile('RESEND_API_KEY');
  if (fromEnv) return fromEnv;

  const accountId =
    process.env.CLOUDFLARE_ACCOUNT_ID || envFromFile('CLOUDFLARE_ACCOUNT_ID');
  const token =
    process.env.CLOUDFLARE_API_TOKEN || envFromFile('CLOUDFLARE_API_TOKEN');
  const dbId = process.env.D1_DATABASE_ID || envFromFile('D1_DATABASE_ID');
  if (!accountId || !token || !dbId) {
    die('RESEND_API_KEY도 D1 자격증명도 없습니다. .env.local을 확인해 주세요.');
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: 'SELECT setting_value FROM site_settings WHERE setting_key = ?',
        params: ['mail.config'],
      }),
    }
  );
  const json = await res.json().catch(() => ({}));
  const row = json?.result?.[0]?.results?.[0];
  if (!row) die('D1에 mail.config가 없습니다. /admin/mail에서 먼저 저장해 주세요.');

  const key = JSON.parse(row.setting_value)?.resendApiKey?.trim();
  if (!key) die('mail.config에 Resend 키가 비어 있습니다.');
  console.log('· Resend 키: D1 mail.config (앱이 실제로 발송에 쓰는 계정)');
  return key;
}

const RESEND_KEY = await resolveResendKey();

// ── API 헬퍼 ─────────────────────────────────────────────────
async function resend(path, init = {}) {
  const res = await fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

async function cf(path, init = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${CF_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!json.success) {
    const msgs = (json.errors || []).map((e) => e.message).join(', ');
    throw new Error(`Cloudflare ${path}: ${msgs || res.status}`);
  }
  return json.result;
}

// ── 1) Resend에 도메인 확보 ──────────────────────────────────
async function ensureResendDomain() {
  const list = await resend('/domains');
  if (!list.ok) die(`Resend 도메인 목록 조회 실패: ${JSON.stringify(list.json)}`);

  const existing = (list.json.data || []).find((d) => d.name === SUBDOMAIN);
  if (existing) {
    console.log(`· Resend에 이미 등록됨: ${SUBDOMAIN} (${existing.status})`);
    const detail = await resend(`/domains/${existing.id}`);
    return detail.json;
  }

  if (readOnly) die(`${SUBDOMAIN}이 Resend에 등록돼 있지 않습니다.`);

  console.log(`· Resend에 도메인 등록: ${SUBDOMAIN}`);
  const created = await resend('/domains', {
    method: 'POST',
    body: JSON.stringify({ name: SUBDOMAIN, region: 'us-east-1' }),
  });
  if (!created.ok) {
    const m = created.json?.message || JSON.stringify(created.json);
    if (/domain limit/i.test(m)) {
      die(
        `이 Resend 계정의 도메인 한도에 걸렸습니다. 등록된 목록:\n` +
          (list.json.data || [])
            .map((d) => `    - ${d.name} (${d.status})`)
            .join('\n') +
          `\n  플랜을 올리거나, KTDOC 전용 계정을 새로 만들어 그 키를 /admin/mail에 넣으세요.`
      );
    }
    die(`도메인 등록 실패: ${m}`);
  }
  return created.json;
}

// ── 2) Cloudflare에 레코드 반영 ──────────────────────────────
async function findZoneId() {
  // zone 목록 조회에는 DNS:Edit이 아니라 Zone:Read가 필요하다. 토큰을
  // "Edit zone DNS" 템플릿으로만 만들면 이름으로 못 찾으니, ID 직접 지정을 허용한다.
  const preset =
    process.env.CLOUDFLARE_ZONE_ID || envFromFile('CLOUDFLARE_ZONE_ID');
  if (preset) return preset;

  const zones = await cf(`/zones?name=${encodeURIComponent(ZONE_NAME)}`);
  if (!zones.length) {
    die(
      `Cloudflare에서 ${ZONE_NAME} zone을 찾을 수 없습니다.\n` +
        `  토큰에 Zone:Read 권한을 더하거나,\n` +
        `  대시보드 우측 하단의 Zone ID를 .env.local에 CLOUDFLARE_ZONE_ID로 넣어 주세요.`
    );
  }
  return zones[0].id;
}

/**
 * Resend는 name을 zone 상대명으로 준다("send.mail"). Cloudflare는 만들 때는
 * 상대명을 받아 zone을 붙여 주지만, 조회하면 전체명("send.mail.ktdoc.org")으로
 * 돌려준다. 비교는 반드시 같은 형태로 맞춘 뒤에 한다 — 안 그러면 "이미 있는
 * 레코드"를 못 찾아 재실행마다 DKIM TXT가 하나씩 늘고, 값이 둘이면 인증이 깨진다.
 */
function fqdn(name) {
  const n = name.replace(/\.$/, '');
  return n === '@' || n === ZONE_NAME || n.endsWith(`.${ZONE_NAME}`)
    ? n
    : `${n}.${ZONE_NAME}`;
}

/** Resend가 준 레코드 한 줄을 Cloudflare 형식으로 옮긴다. */
function toCfRecord(rec) {
  const base = {
    type: rec.type,
    name: fqdn(rec.name),
    content: rec.value,
    ttl: 1, // 1 = auto
  };
  if (rec.type === 'MX') base.priority = Number(rec.priority ?? 10);
  // TXT/MX는 프록시 대상이 아니다. CNAME이 와도 메일 레코드는 프록시하면 안 된다.
  if (rec.type === 'CNAME') base.proxied = false;
  return base;
}

async function applyRecords(zoneId, records) {
  const existing = await cf(`/zones/${zoneId}/dns_records?per_page=200`);
  const results = [];

  for (const rec of records) {
    const want = toCfRecord(rec);
    const match = existing.find(
      (e) => e.type === want.type && fqdn(e.name) === want.name
    );

    if (!match) {
      await cf(`/zones/${zoneId}/dns_records`, {
        method: 'POST',
        body: JSON.stringify(want),
      });
      results.push({ action: '추가', ...want });
    } else if (
      match.content !== want.content ||
      (want.type === 'MX' && Number(match.priority) !== want.priority)
    ) {
      await cf(`/zones/${zoneId}/dns_records/${match.id}`, {
        method: 'PUT',
        body: JSON.stringify(want),
      });
      results.push({ action: '갱신', ...want });
    } else {
      results.push({ action: '그대로', ...want });
    }
  }
  return results;
}

// ── 3) 인증 요청·확인 ────────────────────────────────────────
async function verify(domainId) {
  await resend(`/domains/${domainId}/verify`, { method: 'POST' });

  // DNS 전파에 시간이 걸린다. 몇 번 확인해 본다.
  for (let i = 1; i <= 10; i++) {
    await new Promise((r) => setTimeout(r, i === 1 ? 5000 : 15000));
    const d = await resend(`/domains/${domainId}`);
    const status = d.json?.status;
    console.log(`  [${i}/10] 상태: ${status}`);
    if (status === 'verified') return true;
    if (status === 'failure') return false;
  }
  return false;
}

// ── 실행 ─────────────────────────────────────────────────────
console.log(`\n발신 도메인 설정: ${SUBDOMAIN}  (zone: ${ZONE_NAME})\n`);

const domain = await ensureResendDomain();
const records = domain.records || [];
if (!records.length) die('Resend가 DNS 레코드를 주지 않았습니다.');

console.log(`\n· 현재 Resend 상태: ${domain.status}`);

if (statusOnly) {
  console.log('');
  process.exit(0);
}

if (recordsOnly) {
  // 손으로 넣을 사람을 위한 출력 — Cloudflare 대시보드의 입력칸 순서 그대로.
  console.log(`\n${ZONE_NAME} zone에 아래 ${records.length}개를 넣으면 됩니다.`);
  console.log('(프록시는 끄고, TTL은 Auto)\n');
  for (const r of records) {
    console.log(`  종류   ${r.type}`);
    console.log(`  이름   ${fqdn(r.name)}`);
    if (r.type === 'MX') console.log(`  우선순위 ${r.priority ?? 10}`);
    console.log(`  값     ${r.value}\n`);
  }
  console.log(
    `넣은 뒤 인증: node scripts/setupMailDomain.mjs ${SUBDOMAIN} --verify\n`
  );
  process.exit(0);
}

if (verifyOnly) {
  console.log('\n· 인증 요청 (DNS는 건드리지 않습니다)');
  const ok = await verify(domain.id);
  console.log(
    ok
      ? `\n✓ ${SUBDOMAIN} 인증 완료 — 이제 이 도메인으로 발송할 수 있습니다.\n`
      : `\n△ 아직입니다. DNS 전파에 몇 분 더 걸릴 수 있습니다.\n`
  );
  process.exit(ok ? 0 : 1);
}

console.log(`\n· 필요한 DNS 레코드 ${records.length}개`);
for (const r of records) {
  console.log(`    ${r.type.padEnd(5)} ${fqdn(r.name)}`);
}

const zoneId = await findZoneId();
console.log(`\n· Cloudflare zone: ${zoneId}`);

const applied = await applyRecords(zoneId, records);
for (const a of applied) {
  console.log(`    ${a.action.padEnd(4)} ${a.type.padEnd(5)} ${a.name}`);
}

console.log('\n· 인증 요청 (DNS 전파를 기다립니다)');
const ok = await verify(domain.id);

if (ok) {
  console.log(`\n✓ ${SUBDOMAIN} 인증 완료 — 이제 이 도메인으로 발송할 수 있습니다.\n`);
} else {
  console.log(
    `\n△ 아직 인증되지 않았습니다. DNS 전파에 몇 분 더 걸릴 수 있습니다.\n` +
      `  잠시 뒤 다시 확인: node scripts/setupMailDomain.mjs ${SUBDOMAIN} --status\n`
  );
}
