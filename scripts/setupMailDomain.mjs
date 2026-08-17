#!/usr/bin/env node
/**
 * 발신 도메인 인증 자동화 — Resend 등록 → Cloudflare DNS 삽입 → 인증 확인
 *
 * 손으로 하면 "레코드 3~4줄을 옮겨 적는" 단계에서 오타가 나고, 그 오타는
 * 며칠 뒤 스팸함에서야 드러난다. 그래서 옮겨 적는 과정을 없앤다.
 *
 * 필요한 것 (환경변수):
 *   RESEND_API_KEY        발신 도메인을 등록할 Resend 계정 키
 *   CLOUDFLARE_DNS_TOKEN  해당 zone의 DNS 편집 권한 토큰
 *                         (없으면 CLOUDFLARE_API_TOKEN을 시도한다)
 *
 * 사용:
 *   node scripts/setupMailDomain.mjs                    # mail.ktdoc.org
 *   node scripts/setupMailDomain.mjs mail.example.com   # 다른 도메인
 *   node scripts/setupMailDomain.mjs --status           # 현재 상태만 확인
 *
 * 안전장치: 같은 이름·종류의 레코드가 이미 있으면 값이 다를 때만 갱신한다.
 * 관계없는 레코드는 건드리지 않는다.
 */

import { readFileSync } from 'node:fs';

// ── 인자·환경 ────────────────────────────────────────────────
const args = process.argv.slice(2);
const statusOnly = args.includes('--status');
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

const RESEND_KEY = process.env.RESEND_API_KEY || envFromFile('RESEND_API_KEY');
const CF_TOKEN =
  process.env.CLOUDFLARE_DNS_TOKEN ||
  envFromFile('CLOUDFLARE_DNS_TOKEN') ||
  process.env.CLOUDFLARE_API_TOKEN ||
  envFromFile('CLOUDFLARE_API_TOKEN');

if (!RESEND_KEY) die('RESEND_API_KEY가 없습니다. 환경변수나 .env.local에 넣어 주세요.');
if (!CF_TOKEN) die('CLOUDFLARE_DNS_TOKEN이 없습니다 (DNS 편집 권한 토큰).');

function die(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

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

  if (statusOnly) die(`${SUBDOMAIN}이 Resend에 등록돼 있지 않습니다.`);

  console.log(`· Resend에 도메인 등록: ${SUBDOMAIN}`);
  const created = await resend('/domains', {
    method: 'POST',
    body: JSON.stringify({ name: SUBDOMAIN, region: 'us-east-1' }),
  });
  if (!created.ok) {
    const m = created.json?.message || JSON.stringify(created.json);
    if (/domain limit/i.test(m)) {
      die(
        `Resend 무료 플랜은 도메인 1개입니다. 이미 다른 도메인이 등록돼 있어\n` +
          `  ${SUBDOMAIN}을 추가할 수 없습니다. 등록된 목록:\n` +
          (list.json.data || []).map((d) => `    - ${d.name} (${d.status})`).join('\n')
      );
    }
    die(`도메인 등록 실패: ${m}`);
  }
  return created.json;
}

// ── 2) Cloudflare에 레코드 반영 ──────────────────────────────
async function findZoneId() {
  const zones = await cf(`/zones?name=${encodeURIComponent(ZONE_NAME)}`);
  if (!zones.length) {
    die(
      `Cloudflare에서 ${ZONE_NAME} zone을 찾을 수 없습니다.\n` +
        `  토큰에 그 zone의 DNS 편집 권한이 있는지 확인해 주세요.`
    );
  }
  return zones[0].id;
}

/** Resend가 준 레코드 한 줄을 Cloudflare 형식으로 옮긴다. */
function toCfRecord(rec) {
  // Resend는 name을 전체 호스트명으로 준다. Cloudflare도 전체명을 받는다.
  const base = {
    type: rec.type,
    name: rec.name,
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
      (e) => e.type === want.type && e.name === want.name
    );

    if (!match) {
      await cf(`/zones/${zoneId}/dns_records`, {
        method: 'POST',
        body: JSON.stringify(want),
      });
      results.push({ action: '추가', ...want });
    } else if (match.content !== want.content) {
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

console.log(`\n· 필요한 DNS 레코드 ${records.length}개`);
for (const r of records) {
  console.log(`    ${r.type.padEnd(5)} ${r.name}`);
}

if (statusOnly) {
  console.log(`\n현재 Resend 상태: ${domain.status}\n`);
  process.exit(0);
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
