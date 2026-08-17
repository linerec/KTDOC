# 사이트 전역 이메일 발송 시스템 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사이트에서 일이 벌어지면 관련된 사람에게 자동으로 메일이 나가고, 무엇을 누구에게 보낼지를 관리 콘솔에서 켜고 끌 수 있게 한다.

**Architecture:** 이벤트 레지스트리(무엇을 보낼 수 있는가) → 수신자 결정(순수 함수) → 한도 판정(순수 함수) → 템플릿 → 발송 엔진(provider만 안다) → 로그. 각 층이 이웃 층만 알고, 발송 엔진은 이벤트를 모르고 레지스트리는 발송 방법을 모른다.

**Tech Stack:** Next.js 16 App Router / TypeScript / Cloudflare D1(설정·로그) / MySQL(회원) / nodemailer(SMTP) / Resend HTTP API / `node --test`

**설계 문서:** `docs/superpowers/specs/2026-08-17-email-system-design.md`

## Global Constraints

- **배포는 Vercel Node 런타임.** `docs/06-메일-발송-이식-가이드.md`의 3-b절(Cloudflare Workers / worker-mailer 벤더 사본 / postinstall)은 **적용하지 않는다.** `nodemailer@6.10.1`은 이미 설치돼 있다.
- **`sendMail()`은 절대 throw 하지 않는다.** `{ ok, detail }`을 돌려준다. 메일 실패가 본작업(가입·등록)을 실패시키지 않는다.
- **시크릿은 API 응답에 절대 담지 않는다.** `resendApiKeySet` / `passwordSet` 불리언만 내려간다.
- **PUT에서 빈 시크릿 = 기존 값 유지.** 시크릿 삭제는 명시적인 `clearKey` 플래그로만.
- **한도는 수신자 수로 센다.** Resend는 To·CC·BCC의 각 수신자를 1통으로 센다.
- **'오늘'은 사이트 시간대로 판단한다.** `dayInTimeZone(new Date(), timezone)` — `timezone`은 `getCalendarConfig()`에서 온다(`lib/calendar.ts`, 기본 `America/New_York`). UTC로 재면 저녁에 카운터가 어긋난다.
- **클라이언트 컴포넌트는 DB 모듈을 import 하지 않는다.** 공유 타입은 `types/mail.ts`, 레지스트리는 DB 의존이 없어 클라에서 import 가능.
- **메일 본문은 한국어 + 영어를 한 통에 병기한다.** 수신자별 언어 선호 정보가 없으므로(회원 테이블에 언어 컬럼 없음) 둘 다 넣는다. 제목은 `한국어 / English` 형식.
- **관리 콘솔 UI는 라이트·다크 두 테마 모두 확인**하고 `npm run lint:theme` 0건 (CLAUDE.md).
- **관리 화면 문구는 `admin.mail.*` 키코드**로 `locale/ko.json`·`locale/en.json` 양쪽에 추가하고, `t(키, '한국어 기본값')` 폴백을 항상 넘긴다.
- **마이그레이션 번호는 파일 생성 직전에 확인한다.** 다른 세션이 병렬 작업 중일 수 있다 — `git fetch && ls migrations/`로 실제 최신을 보고 이어붙인다. 이 계획은 D1 `0036`, MySQL `0037`을 가정한다.
- 커밋 메시지는 프로젝트 관습(한국어 conventional commits)을 따르고 `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`를 붙인다.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `types/mail.ts` | 공유 타입 — 설정·이벤트·로그. DB 의존 없음(클라 import 가능) |
| `lib/mail/events.ts` | 이벤트 레지스트리 (SSOT). DB 의존 없음 |
| `lib/mail/config.ts` | 설정 로드·저장·깊은 병합·공개뷰 마스킹 (server-only) |
| `lib/mail/mailer.ts` | 발송 엔진 — provider 해석 + 실제 전송. 이벤트를 모른다 |
| `lib/mail/recipients.ts` | 수신자 결정 (순수) |
| `lib/mail/quota.ts` | 한도 판정 (순수) |
| `lib/mail/templates/index.ts` | 이벤트 → 제목·본문 |
| `lib/mail/notify.ts` | 오케스트레이션 — `notifyEvent()` |
| `lib/d1/mailLog.ts` | 발송 로그 저장·집계·검색·정리 |
| `app/api/admin/mail/route.ts` | 설정 GET/PUT |
| `app/api/admin/mail/test/route.ts` | 테스트 발송 |
| `app/api/admin/mail/log/route.ts` | 내역 검색 |
| `app/api/account/notifications/route.ts` | 회원 개인 수신 설정 |
| `app/admin/mail/page.tsx` + `MailSettingsClient.tsx` | 관리 화면 |

---

### Task 1: 공유 타입 + 이벤트 레지스트리

**Files:**
- Create: `types/mail.ts`
- Create: `lib/mail/events.ts`

**Interfaces:**
- Produces: `MailAudience`, `MailProvider`, `SmtpConfig`, `MailQuotaConfig`, `MailEventSwitches`, `MailConfig`, `PublicMailConfig`, `MailLogStatus`, `MailEventDef`, `MAIL_EVENTS`, `getMailEvent()`, `MAIL_EVENT_GROUPS`

- [ ] **Step 1: 공유 타입 작성**

`types/mail.ts`:

```ts
/**
 * 이메일 발송 시스템 공유 타입 — 서버·클라이언트 공용
 *
 * DB 모듈에 의존하지 않는다(관리 화면이 클라이언트 컴포넌트라 여기서만 가져간다).
 */

/** 알림을 받는 두 부류. 'user'는 당사자 + (원생이면) 보호자를 포함한다. */
export type MailAudience = 'user' | 'staff';

/** '' = 미설정(환경변수 폴백) */
export type MailProvider = '' | 'resend' | 'smtp';

export interface SmtpConfig {
  host: string;
  /** 465(접속부터 TLS) 또는 587(STARTTLS 승급). 25는 쓰지 않는다. */
  port: number;
  /** true = 접속부터 TLS(465). false = 평문 접속 후 STARTTLS(587). */
  secure: boolean;
  username: string;
  password: string;
}

export interface MailQuotaConfig {
  /** Resend 무료 기준 100 */
  dailyLimit: number;
  /** Resend 무료 기준 3000 */
  monthlyLimit: number;
  /** 이 비율을 넘으면 경고 (0~100) */
  warnAtPercent: number;
}

/**
 * 이벤트 × 대상 × 채널 스위치.
 * 안쪽 `{ email: boolean }` 한 겹이 "채널 자리" — 나중에 push가 붙어도
 * 저장본 마이그레이션 없이 키만 늘어난다.
 */
export type MailEventSwitches = Record<
  string,
  Partial<Record<MailAudience, { email: boolean }>>
>;

export interface MailConfig {
  provider: MailProvider;
  /** 발신 주소. SPF/DKIM 인증된 주소여야 한다. */
  from: string;
  /** 받은편지함에 뜨는 이름 */
  fromName: string;
  /** 답장 받을 주소. 인증 불필요 — 클라이언트가 늘 쓰는 메일함을 넣는다. */
  replyTo: string;
  /** 운영진 알림 수신 주소들 */
  staffTo: string[];
  resendApiKey: string;
  smtp: SmtpConfig;
  quota: MailQuotaConfig;
  events: MailEventSwitches;
}

/** API 응답용 — 시크릿 원문 대신 "저장돼 있는지"만 내려간다. */
export interface PublicMailConfig
  extends Omit<MailConfig, 'resendApiKey' | 'smtp'> {
  resendApiKeySet: boolean;
  smtp: Omit<SmtpConfig, 'password'> & { passwordSet: boolean };
}

/**
 * 발송 결과.
 * - sent          보냈다
 * - failed        보내려다 실패했다(provider 오류)
 * - skipped       보내지 않기로 했다(스위치 off·수신거부·주소 없음)
 * - quota_blocked 한도가 모자라 보류했다
 *
 * 성공만 남기면 "왜 안 왔지"에 답할 수 없다 — 넷 다 남긴다.
 */
export type MailLogStatus = 'sent' | 'failed' | 'skipped' | 'quota_blocked';

export interface MailLogRow {
  id: number;
  event_key: string;
  audience: MailAudience;
  to_address: string;
  subject: string;
  body: string | null;
  status: MailLogStatus;
  detail: string | null;
  provider: string | null;
  provider_id: string | null;
  batch_id: string | null;
  quota_daily: number | null;
  quota_monthly: number | null;
  created_at: string;
}
```

- [ ] **Step 2: 이벤트 레지스트리 작성**

`lib/mail/events.ts`:

```ts
/**
 * 메일 이벤트 레지스트리 — 이벤트 "존재"의 진실의 원천(SSOT)
 *
 * 새 알림 추가 = 이 배열에 1건 + templates/index.ts에 본문 1개.
 * 관리 화면(/admin/mail)은 이 배열을 순회해 그리므로 화면 코드를 건드리지 않는다.
 *
 * DB 의존성이 없어 서버/클라이언트 어디서나 import 가능하다
 * (lib/admin/menu-registry.ts·lib/ai/registry.ts와 같은 관용구).
 */

import type { MailAudience } from '@/types/mail';

export type MailEventGroup = 'member' | 'lesson' | 'show' | 'ops';

export interface MailEventDef {
  key: string;
  /** 관리 화면에 표시할 이름 */
  label: string;
  /** 무슨 일이 생겼을 때 나가는지 — 화면 설명문 */
  description: string;
  group: MailEventGroup;
  /** 이 사건에서 알릴 수 있는 대상 */
  audiences: readonly MailAudience[];
  /** 끌 수 없는 대상 — 화면에 스위치 대신 '필수' 배지가 뜬다 */
  essential?: readonly MailAudience[];
  /** 설정에 값이 없을 때의 기본값 */
  defaultOn: Partial<Record<MailAudience, boolean>>;
  /**
   * true면 발송 내역에 본문을 저장하지 않는다.
   * 임시 비밀번호처럼 본문에 평문 비밀이 실리는 이벤트용.
   */
  redactBody?: boolean;
  /**
   * 한 번에 여러 명에게 BCC로 나가는 이벤트.
   * 한도를 통째로 판정하고(모자라면 전원 보류) 로그를 batch_id로 묶는다.
   */
  bulk?: boolean;
  /**
   * 수신자가 회원이 아닐 수 있는 이벤트(문의 접수 등).
   * 개인 수신거부 관문을 건너뛴다 — 끌 대상 계정이 없다.
   */
  allowNonMember?: boolean;
}

export const MAIL_EVENT_GROUPS: { key: MailEventGroup; label: string }[] = [
  { key: 'member', label: '회원' },
  { key: 'lesson', label: '수업' },
  { key: 'show', label: '공연' },
  { key: 'ops', label: '운영' },
];

export const MAIL_EVENTS: readonly MailEventDef[] = [
  {
    key: 'member.signup',
    label: '회원가입',
    description: '새 회원이 가입 신청을 마쳤을 때.',
    group: 'member',
    audiences: ['user', 'staff'],
    essential: ['user'],
    defaultOn: { user: true, staff: true },
  },
  {
    key: 'member.approved',
    label: '가입 승인',
    description: '운영진이 가입을 승인해 정회원이 되었을 때.',
    group: 'member',
    audiences: ['user'],
    defaultOn: { user: true },
  },
  {
    key: 'member.temp_password',
    label: '임시 비밀번호 발급',
    description:
      '운영진이 임시 비밀번호를 발급했을 때. 본문에 비밀번호가 실리므로 발송 내역에는 본문을 남기지 않습니다.',
    group: 'member',
    audiences: ['user'],
    essential: ['user'],
    defaultOn: { user: true },
    redactBody: true,
  },
  {
    key: 'enrollment.created',
    label: '수업 등록',
    description: '원생이 수업·프로그램에 배정되었을 때.',
    group: 'lesson',
    audiences: ['user', 'staff'],
    defaultOn: { user: true, staff: true },
  },
  {
    key: 'application.created',
    label: '공연 참가 신청',
    description: '공연 참가 신청서가 접수되었을 때.',
    group: 'show',
    audiences: ['user', 'staff'],
    defaultOn: { user: true, staff: true },
    allowNonMember: true,
  },
  {
    key: 'checkin.created',
    label: '공연 참여 확정',
    description:
      '공연 참여가 확정(체크인)되었을 때. 빈도가 높아 기본은 꺼둡니다.',
    group: 'show',
    audiences: ['user', 'staff'],
    defaultOn: { user: false, staff: false },
  },
  {
    key: 'form.submitted',
    label: '신청서 제출',
    description: '신청서(질문지) 응답이 접수되었을 때.',
    group: 'show',
    audiences: ['user', 'staff'],
    defaultOn: { user: true, staff: true },
    allowNonMember: true,
  },
  {
    key: 'feedback.created',
    label: '문의 접수',
    description: '홈페이지 문의가 접수되었을 때.',
    group: 'ops',
    audiences: ['user', 'staff'],
    defaultOn: { user: true, staff: true },
    allowNonMember: true,
  },
  {
    key: 'event.reminder',
    label: '공연 전날 안내',
    description:
      '공연 하루 전, 참여가 확정된 원생과 보호자에게. 한 번에 여러 명에게 나가므로 하루 한도를 가장 많이 씁니다.',
    group: 'show',
    audiences: ['user'],
    defaultOn: { user: true },
    bulk: true,
  },
  {
    key: 'quota.warning',
    label: '발송 한도 경고',
    description:
      '하루 발송량이 설정한 비율을 넘었을 때 운영진에게. 하루 한 번만 나갑니다.',
    group: 'ops',
    audiences: ['staff'],
    essential: ['staff'],
    defaultOn: { staff: true },
  },
] as const;

const BY_KEY = new Map(MAIL_EVENTS.map((e) => [e.key, e]));

/** 키로 이벤트 정의를 찾는다. 모르는 키는 null(호출부가 로그만 남기고 넘어간다). */
export function getMailEvent(key: string): MailEventDef | null {
  return BY_KEY.get(key) ?? null;
}

/** 이 대상은 끌 수 없는가 */
export function isEssential(def: MailEventDef, audience: MailAudience): boolean {
  return def.essential?.includes(audience) ?? false;
}
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 이 두 파일에서 오류 없음 (기존 파일의 미해결 오류는 무시)

- [ ] **Step 4: 커밋**

```bash
git add types/mail.ts lib/mail/events.ts
git commit -m "feat(mail): 이벤트 레지스트리와 공유 타입

새 알림 추가가 '배열에 1줄 + 본문 1개'가 되도록 이벤트를 한 곳에 모은다.
관리 화면은 이 배열을 순회해 그리므로 화면 코드를 건드리지 않는다.
DB 의존이 없어 클라이언트 컴포넌트에서도 가져갈 수 있다."
```

---

### Task 2: 설정 스키마·저장·마스킹

**Files:**
- Create: `lib/mail/config.ts`
- Test: `lib/mail/config.test.ts`

**Interfaces:**
- Consumes: `types/mail.ts`(Task 1), `lib/d1/settings.ts`의 `getSetting`/`setSetting`
- Produces: `SETTING_MAIL_CONFIG`, `DEFAULT_MAIL_CONFIG`, `mergeMailConfig(raw: unknown): MailConfig`, `toPublicMailConfig(c: MailConfig): PublicMailConfig`, `applyMailConfigPatch(current: MailConfig, patch: unknown): MailConfig`, `loadMailConfig(): Promise<MailConfig>`, `saveMailConfig(patch: unknown): Promise<MailConfig>`, `isValidEmail(v: string): boolean`

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/mail/config.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MAIL_CONFIG,
  mergeMailConfig,
  toPublicMailConfig,
  applyMailConfigPatch,
  isValidEmail,
} from './config.ts';

test('빈 저장본은 기본값이 된다', () => {
  assert.deepEqual(mergeMailConfig(null), DEFAULT_MAIL_CONFIG);
  assert.deepEqual(mergeMailConfig(undefined), DEFAULT_MAIL_CONFIG);
  assert.deepEqual(mergeMailConfig('깨진 값'), DEFAULT_MAIL_CONFIG);
});

test('옛 저장본에 없는 필드가 추가돼도 깨지지 않는다', () => {
  // quota·events가 없던 시절의 저장본
  const old = { provider: 'resend', from: 'a@b.com', resendApiKey: 'key' };
  const merged = mergeMailConfig(old);
  assert.equal(merged.from, 'a@b.com');
  assert.equal(merged.quota.dailyLimit, 100);
  assert.deepEqual(merged.events, {});
});

test('smtp를 일부만 저장해도 나머지는 기본값이 채워진다', () => {
  const merged = mergeMailConfig({ smtp: { host: 'smtp.example.com' } });
  assert.equal(merged.smtp.host, 'smtp.example.com');
  assert.equal(merged.smtp.port, 465);
  assert.equal(merged.smtp.secure, true);
});

test('공개뷰에는 시크릿 원문이 없다', () => {
  const config = mergeMailConfig({
    resendApiKey: 're_secret',
    smtp: { password: 'pw' },
  });
  const pub = toPublicMailConfig(config);
  const json = JSON.stringify(pub);
  assert.equal(json.includes('re_secret'), false);
  assert.equal(json.includes('pw'), false);
  assert.equal(pub.resendApiKeySet, true);
  assert.equal(pub.smtp.passwordSet, true);
});

test('빈 시크릿을 보내면 기존 값이 유지된다', () => {
  const current = mergeMailConfig({
    resendApiKey: 'keep-me',
    smtp: { password: 'keep-pw' },
  });
  const next = applyMailConfigPatch(current, {
    from: 'new@example.com',
    resendApiKey: '',
    smtp: { password: '' },
  });
  assert.equal(next.resendApiKey, 'keep-me');
  assert.equal(next.smtp.password, 'keep-pw');
  assert.equal(next.from, 'new@example.com');
});

test('clearResendApiKey 플래그로만 시크릿이 지워진다', () => {
  const current = mergeMailConfig({ resendApiKey: 'bye' });
  const next = applyMailConfigPatch(current, { clearResendApiKey: true });
  assert.equal(next.resendApiKey, '');
});

test('보낸 키만 반영한다 — 다른 탭 값이 지워지지 않는다', () => {
  const current = mergeMailConfig({
    from: 'a@b.com',
    staffTo: ['ops@b.com'],
    events: { 'member.signup': { user: { email: true } } },
  });
  const next = applyMailConfigPatch(current, { fromName: '이름만 변경' });
  assert.equal(next.from, 'a@b.com');
  assert.deepEqual(next.staffTo, ['ops@b.com']);
  assert.deepEqual(next.events, { 'member.signup': { user: { email: true } } });
});

test('이메일 형식 검증', () => {
  assert.equal(isValidEmail('a@b.com'), true);
  assert.equal(isValidEmail('a.b+c@d.co.kr'), true);
  assert.equal(isValidEmail('a@b'), false);
  assert.equal(isValidEmail('공백 @b.com'), false);
  assert.equal(isValidEmail(''), false);
});

test('한도 값은 정수로 강제되고 음수는 기본값으로 되돌아간다', () => {
  const merged = mergeMailConfig({
    quota: { dailyLimit: -5, monthlyLimit: 12.7, warnAtPercent: 500 },
  });
  assert.equal(merged.quota.dailyLimit, 100);
  assert.equal(merged.quota.monthlyLimit, 12);
  assert.equal(merged.quota.warnAtPercent, 100);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test lib/mail/config.test.ts`
Expected: FAIL — `Cannot find module './config.ts'`

- [ ] **Step 3: 구현**

`lib/mail/config.ts`:

```ts
/**
 * 메일 설정 — 스키마·기본값·깊은 병합·시크릿 마스킹
 *
 * 저장은 D1 site_settings의 'mail.config' 키 하나(JSON). 새 테이블을 만들지 않는다.
 *
 * 읽을 때 항상 기본값과 깊은 병합한다 — 나중에 필드를 추가해도 옛 저장본이
 * 깨지지 않는다. 시크릿은 응답에 담지 않고, 빈 값으로 덮어쓰지 않는다
 * (매번 재입력을 요구하면 다른 칸을 고칠 때마다 키가 지워진다).
 */

import 'server-only';
import { getSetting, setSetting } from '@/lib/d1/settings';
import type {
  MailConfig,
  MailEventSwitches,
  MailProvider,
  PublicMailConfig,
  SmtpConfig,
} from '@/types/mail';

export const SETTING_MAIL_CONFIG = 'mail.config';

export const DEFAULT_MAIL_CONFIG: MailConfig = {
  provider: '',
  from: '',
  fromName: 'KTDOC 춤누리',
  replyTo: '',
  staffTo: [],
  resendApiKey: '',
  smtp: { host: '', port: 465, secure: true, username: '', password: '' },
  quota: { dailyLimit: 100, monthlyLimit: 3000, warnAtPercent: 80 },
  events: {},
};

/** 지나치게 엄격하지 않게 — 오타(도메인 없음, 공백)만 걸러낸다. */
export function isValidEmail(value: string): boolean {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (!v || v.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

function int(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' ? Math.trunc(v) : NaN;
  if (!Number.isFinite(n) || n < min) return fallback;
  return Math.min(n, max);
}

function mergeSmtp(raw: unknown): SmtpConfig {
  const r = (raw ?? {}) as Partial<SmtpConfig>;
  return {
    host: str(r.host, DEFAULT_MAIL_CONFIG.smtp.host),
    port: int(r.port, DEFAULT_MAIL_CONFIG.smtp.port, 1, 65535),
    secure:
      typeof r.secure === 'boolean' ? r.secure : DEFAULT_MAIL_CONFIG.smtp.secure,
    username: str(r.username, DEFAULT_MAIL_CONFIG.smtp.username),
    password: str(r.password, DEFAULT_MAIL_CONFIG.smtp.password),
  };
}

function mergeEvents(raw: unknown): MailEventSwitches {
  if (!raw || typeof raw !== 'object') return {};
  const out: MailEventSwitches = {};
  for (const [eventKey, audiences] of Object.entries(raw as object)) {
    if (!audiences || typeof audiences !== 'object') continue;
    const bucket: MailEventSwitches[string] = {};
    for (const [audience, channels] of Object.entries(audiences as object)) {
      if (audience !== 'user' && audience !== 'staff') continue;
      if (!channels || typeof channels !== 'object') continue;
      // 채널 한 겹을 그대로 보존한다 — 나중에 push가 붙어도 이 자리에 늘어난다.
      const email = (channels as { email?: unknown }).email;
      bucket[audience] = { email: typeof email === 'boolean' ? email : false };
    }
    out[eventKey] = bucket;
  }
  return out;
}

/** 저장본(무엇이 들었을지 모른다)을 기본값과 깊은 병합해 온전한 설정으로 만든다. */
export function mergeMailConfig(raw: unknown): MailConfig {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }
  if (!parsed || typeof parsed !== 'object') {
    return structuredClone(DEFAULT_MAIL_CONFIG);
  }
  const r = parsed as Partial<MailConfig>;
  const provider = r.provider;
  const q = (r.quota ?? {}) as Partial<MailConfig['quota']>;
  return {
    provider:
      provider === 'resend' || provider === 'smtp' || provider === ''
        ? (provider as MailProvider)
        : DEFAULT_MAIL_CONFIG.provider,
    from: str(r.from, DEFAULT_MAIL_CONFIG.from),
    fromName: str(r.fromName, DEFAULT_MAIL_CONFIG.fromName),
    replyTo: str(r.replyTo, DEFAULT_MAIL_CONFIG.replyTo),
    staffTo: Array.isArray(r.staffTo)
      ? r.staffTo.filter((x): x is string => typeof x === 'string')
      : [],
    resendApiKey: str(r.resendApiKey, DEFAULT_MAIL_CONFIG.resendApiKey),
    smtp: mergeSmtp(r.smtp),
    quota: {
      dailyLimit: int(q.dailyLimit, DEFAULT_MAIL_CONFIG.quota.dailyLimit, 1, 1_000_000),
      monthlyLimit: int(q.monthlyLimit, DEFAULT_MAIL_CONFIG.quota.monthlyLimit, 1, 10_000_000),
      warnAtPercent: int(q.warnAtPercent, DEFAULT_MAIL_CONFIG.quota.warnAtPercent, 1, 100),
    },
    events: mergeEvents(r.events),
  };
}

/** API 응답용 — 시크릿을 불리언으로 바꾼다. */
export function toPublicMailConfig(config: MailConfig): PublicMailConfig {
  const { resendApiKey, smtp, ...rest } = config;
  const { password, ...smtpRest } = smtp;
  return {
    ...rest,
    resendApiKeySet: Boolean(resendApiKey),
    smtp: { ...smtpRest, passwordSet: Boolean(password) },
  };
}

/**
 * 부분 업데이트. 보낸 키만 반영하고, 빈 시크릿은 기존 값을 지우지 않는다.
 * 시크릿 삭제는 clearResendApiKey / clearSmtpPassword 플래그로만.
 */
export function applyMailConfigPatch(
  current: MailConfig,
  patch: unknown
): MailConfig {
  if (!patch || typeof patch !== 'object') return current;
  const p = patch as Record<string, unknown>;
  const next: MailConfig = structuredClone(current);

  if (p.provider === '' || p.provider === 'resend' || p.provider === 'smtp') {
    next.provider = p.provider;
  }
  if (typeof p.from === 'string') next.from = p.from.trim();
  if (typeof p.fromName === 'string') next.fromName = p.fromName.trim().slice(0, 100);
  if (typeof p.replyTo === 'string') next.replyTo = p.replyTo.trim();
  if (Array.isArray(p.staffTo)) {
    next.staffTo = p.staffTo
      .filter((x): x is string => typeof x === 'string')
      .map((x) => x.trim())
      .filter(Boolean);
  }

  // 시크릿: 비어 있지 않을 때만 덮어쓴다
  if (typeof p.resendApiKey === 'string' && p.resendApiKey.trim()) {
    next.resendApiKey = p.resendApiKey.trim().slice(0, 200);
  }
  if (p.clearResendApiKey === true) next.resendApiKey = '';

  if (p.smtp && typeof p.smtp === 'object') {
    const s = p.smtp as Record<string, unknown>;
    if (typeof s.host === 'string') next.smtp.host = s.host.trim();
    if (typeof s.port === 'number') next.smtp.port = int(s.port, next.smtp.port, 1, 65535);
    if (typeof s.secure === 'boolean') next.smtp.secure = s.secure;
    if (typeof s.username === 'string') next.smtp.username = s.username.trim();
    if (typeof s.password === 'string' && s.password) {
      next.smtp.password = s.password.slice(0, 200);
    }
  }
  if (p.clearSmtpPassword === true) next.smtp.password = '';

  if (p.quota && typeof p.quota === 'object') {
    const q = p.quota as Record<string, unknown>;
    if (typeof q.dailyLimit === 'number') {
      next.quota.dailyLimit = int(q.dailyLimit, next.quota.dailyLimit, 1, 1_000_000);
    }
    if (typeof q.monthlyLimit === 'number') {
      next.quota.monthlyLimit = int(q.monthlyLimit, next.quota.monthlyLimit, 1, 10_000_000);
    }
    if (typeof q.warnAtPercent === 'number') {
      next.quota.warnAtPercent = int(q.warnAtPercent, next.quota.warnAtPercent, 1, 100);
    }
  }

  if (p.events && typeof p.events === 'object') {
    // 이벤트 스위치는 화면이 전체를 보내므로 통째로 교체한다
    next.events = mergeEvents(p.events);
  }

  return next;
}

export async function loadMailConfig(): Promise<MailConfig> {
  const raw = await getSetting(SETTING_MAIL_CONFIG);
  return mergeMailConfig(raw);
}

export async function saveMailConfig(patch: unknown): Promise<MailConfig> {
  const current = await loadMailConfig();
  const next = applyMailConfigPatch(current, patch);
  await setSetting(SETTING_MAIL_CONFIG, JSON.stringify(next));
  return next;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test lib/mail/config.test.ts`
Expected: PASS (9 tests)

> `server-only` import가 `node --test`에서 문제되면, `lib/mail/config.ts`에서
> `import 'server-only'`를 제거하고 D1 접근 함수(`loadMailConfig`/`saveMailConfig`)만
> 쓰는 쪽이 서버 전용임을 주석으로 명시한다. 순수 함수 4개는 테스트 대상이므로
> 이 파일은 클라이언트에서 import 되지 않는다는 것만 지키면 된다.

- [ ] **Step 5: 커밋**

```bash
git add lib/mail/config.ts lib/mail/config.test.ts
git commit -m "feat(mail): 설정 스키마와 시크릿 취급 규칙

깊은 병합으로 옛 저장본이 필드 추가에 깨지지 않게 하고, 시크릿은 응답에
담지 않으며 빈 값으로 덮어쓰지 않는다(매번 재입력을 요구하면 다른 칸을
고칠 때마다 키가 지워진다). 삭제는 명시적 플래그로만."
```

---

### Task 3: 발송 엔진

**Files:**
- Create: `lib/mail/mailer.ts`

**Interfaces:**
- Consumes: `types/mail.ts`(Task 1), `lib/mail/config.ts`(Task 2)
- Produces: `ResolvedMailConfig`, `resolveMailConfig(config: MailConfig): ResolvedMailConfig`, `MailMessage`, `SendMailResult`, `sendMail(resolved: ResolvedMailConfig, message: MailMessage): Promise<SendMailResult>`

- [ ] **Step 1: 구현**

`lib/mail/mailer.ts`:

```ts
/**
 * 발송 엔진 — provider 해석과 실제 전송만 안다
 *
 * 이 파일은 이벤트도 회원도 모른다. 주소와 본문을 받아 보낼 뿐이다.
 * 이 경계를 지키면 provider를 바꿔도 이벤트 코드가, 이벤트를 늘려도
 * 발송 코드가 그대로다.
 *
 * sendMail()은 절대 throw 하지 않는다 — 메일이 치명적인지는 호출부가 정한다.
 */

import type { MailConfig, SmtpConfig } from '@/types/mail';

export type ResolvedMailConfig =
  | {
      provider: 'resend';
      apiKey: string;
      from: string;
      fromName: string;
      replyTo: string;
    }
  | {
      provider: 'smtp';
      smtp: SmtpConfig;
      from: string;
      fromName: string;
      replyTo: string;
    }
  | { provider: 'none'; reason: string };

export interface MailMessage {
  /** 실제 수신자. 단건은 1명. */
  to: string[];
  /** 단체 발송 — 수신자끼리 주소가 보이지 않게 한다. */
  bcc?: string[];
  subject: string;
  text: string;
  /** 지정하면 설정의 replyTo를 덮어쓴다(문의 접수 → 문의자에게 답장) */
  replyTo?: string;
}

export interface SendMailResult {
  ok: boolean;
  /** 실패 사유 — 테스트 발송 화면이 그대로 보여준다 */
  detail?: string;
  /** provider가 준 메시지 id (추적용) */
  providerId?: string;
  /** Resend가 헤더로 알려준 그 시점의 사용량 (대조용) */
  quotaDaily?: number;
  quotaMonthly?: number;
}

/**
 * 설정과 환경변수를 합쳐 "실제로 발송에 쓸 값"을 정한다.
 * provider가 ''이면 환경변수 폴백 — 설정 화면을 한 번도 열지 않은 배포도 동작한다.
 */
export function resolveMailConfig(config: MailConfig): ResolvedMailConfig {
  const from = config.from.trim() || process.env.MAIL_FROM || '';
  const fromName = config.fromName.trim() || 'KTDOC 춤누리';
  const replyTo = config.replyTo.trim();

  if (config.provider === 'smtp') {
    if (!config.smtp.host.trim()) return { provider: 'none', reason: 'smtp-no-host' };
    if (!from) return { provider: 'none', reason: 'no-from' };
    return { provider: 'smtp', smtp: config.smtp, from, fromName, replyTo };
  }

  // '' (미설정)과 'resend'는 같은 경로 — 설정에 키가 없으면 환경변수 키
  const apiKey = config.resendApiKey.trim() || process.env.RESEND_API_KEY || '';
  if (!apiKey) return { provider: 'none', reason: 'no-api-key' };
  if (!from) return { provider: 'none', reason: 'no-from' };
  return { provider: 'resend', apiKey, from, fromName, replyTo };
}

function headerInt(res: Response, name: string): number | undefined {
  const raw = res.headers.get(name);
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

/** Resend는 SDK가 필요 없다 — HTTP API 한 번이면 된다. */
async function sendViaResend(
  cfg: Extract<ResolvedMailConfig, { provider: 'resend' }>,
  message: MailMessage
): Promise<SendMailResult> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${cfg.fromName} <${cfg.from}>`,
      to: message.to,
      bcc: message.bcc?.length ? message.bcc : undefined,
      reply_to: message.replyTo || cfg.replyTo || undefined,
      subject: message.subject,
      text: message.text,
    }),
  });

  // 사용량 헤더는 성공·실패 모두에 실린다 — 먼저 읽는다.
  const quotaDaily = headerInt(res, 'x-resend-daily-quota');
  const quotaMonthly = headerInt(res, 'x-resend-monthly-quota');

  if (!res.ok) {
    const body = await res.text();
    return {
      ok: false,
      detail: `resend ${res.status}: ${body.slice(0, 500)}`,
      quotaDaily,
      quotaMonthly,
    };
  }
  const json = (await res.json().catch(() => null)) as { id?: string } | null;
  return { ok: true, providerId: json?.id, quotaDaily, quotaMonthly };
}

async function sendViaSmtp(
  cfg: Extract<ResolvedMailConfig, { provider: 'smtp' }>,
  message: MailMessage
): Promise<SendMailResult> {
  const { default: nodemailer } = await import('nodemailer');
  const transport = nodemailer.createTransport({
    host: cfg.smtp.host,
    port: cfg.smtp.port,
    secure: cfg.smtp.secure,
    // 자격증명을 보낼 때는 STARTTLS 강제 — 평문으로 비밀번호를 흘리지 않는다
    requireTLS: !cfg.smtp.secure && Boolean(cfg.smtp.username),
    auth: cfg.smtp.username
      ? { user: cfg.smtp.username, pass: cfg.smtp.password }
      : undefined,
    // 사용자 응답이 메일 서버 장애에 몇 분씩 끌려가면 안 된다
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  const info = await transport.sendMail({
    from: { name: cfg.fromName, address: cfg.from },
    to: message.to,
    bcc: message.bcc?.length ? message.bcc : undefined,
    replyTo: message.replyTo || cfg.replyTo || undefined,
    subject: message.subject,
    text: message.text,
  });
  return { ok: true, providerId: info.messageId };
}

/**
 * 메일 한 통을 보낸다. 실패해도 던지지 않는다.
 * detail은 테스트 발송 화면과 발송 내역이 원인을 보여줄 때 쓴다.
 */
export async function sendMail(
  resolved: ResolvedMailConfig,
  message: MailMessage
): Promise<SendMailResult> {
  if (resolved.provider === 'none') {
    console.warn(`[mail] 미설정(${resolved.reason}) — 발송 건너뜀: ${message.subject}`);
    return { ok: false, detail: resolved.reason };
  }
  if (!message.to.length && !message.bcc?.length) {
    return { ok: false, detail: 'no-recipients' };
  }
  try {
    return resolved.provider === 'smtp'
      ? await sendViaSmtp(resolved, message)
      : await sendViaResend(resolved, message);
  } catch (error) {
    console.error(`[mail] ${resolved.provider} 발송 실패:`, error);
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
```

- [ ] **Step 2: `serverExternalPackages` 추가**

`next.config.ts`의 `nextConfig` 객체에 추가 (`experimental` 키와 같은 레벨):

```ts
  // nodemailer는 Node 전용 소켓을 쓴다 — 번들러가 건드리지 못하게 외부로 뺀다
  serverExternalPackages: ['nodemailer'],
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: `lib/mail/mailer.ts`에서 오류 없음

- [ ] **Step 4: 커밋**

```bash
git add lib/mail/mailer.ts next.config.ts
git commit -m "feat(mail): 발송 엔진(Resend HTTP / SMTP)

provider 해석과 전송만 안다 — 이벤트도 회원도 모른다. 이 경계를 지키면
provider를 바꿔도 이벤트 코드가, 이벤트를 늘려도 발송 코드가 그대로다.
Resend 응답의 사용량 헤더는 성공·실패 모두에서 읽는다."
```

---

### Task 4: 수신자 결정 (순수 함수)

**Files:**
- Create: `lib/mail/recipients.ts`
- Test: `lib/mail/recipients.test.ts`

**Interfaces:**
- Consumes: `types/mail.ts`(Task 1), `lib/mail/events.ts`(Task 1), `isValidEmail`(Task 2)
- Produces: `RecipientCandidate`, `ResolveRecipientsInput`, `ResolveRecipientsResult`, `SkipReason`, `resolveRecipients(input): ResolveRecipientsResult`, `isAudienceOn(def, audience, switches): boolean`

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/mail/recipients.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRecipients, isAudienceOn } from './recipients.ts';
import type { MailEventDef } from './events.ts';

const plain: MailEventDef = {
  key: 'test.plain',
  label: '테스트',
  description: '',
  group: 'ops',
  audiences: ['user', 'staff'],
  defaultOn: { user: true, staff: true },
};

const essential: MailEventDef = {
  ...plain,
  key: 'test.essential',
  essential: ['user'],
};

test('스위치가 꺼져 있으면 아무에게도 보내지 않는다', () => {
  const r = resolveRecipients({
    def: plain,
    audience: 'user',
    switches: { 'test.plain': { user: { email: false } } },
    candidates: [{ email: 'a@b.com', optIn: true }],
    staffTo: [],
  });
  assert.deepEqual(r.addresses, []);
  assert.equal(r.skipped[0].reason, 'switch-off');
});

test('설정이 없으면 레지스트리 기본값을 따른다', () => {
  const r = resolveRecipients({
    def: plain,
    audience: 'user',
    switches: {},
    candidates: [{ email: 'a@b.com', optIn: true }],
    staffTo: [],
  });
  assert.deepEqual(r.addresses, ['a@b.com']);
});

test('개인이 끄면 제외된다', () => {
  const r = resolveRecipients({
    def: plain,
    audience: 'user',
    switches: {},
    candidates: [
      { email: 'yes@b.com', optIn: true },
      { email: 'no@b.com', optIn: false },
    ],
    staffTo: [],
  });
  assert.deepEqual(r.addresses, ['yes@b.com']);
  assert.equal(r.skipped[0].reason, 'opted-out');
});

test('필수 이벤트는 개인 수신거부를 무시한다', () => {
  const r = resolveRecipients({
    def: essential,
    audience: 'user',
    switches: { 'test.essential': { user: { email: false } } },
    candidates: [{ email: 'no@b.com', optIn: false }],
    staffTo: [],
  });
  // 관리자 스위치도 개인 설정도 모두 무시된다 — 못 받으면 계정을 못 쓴다
  assert.deepEqual(r.addresses, ['no@b.com']);
});

test('주소가 없거나 형식이 깨지면 사유와 함께 제외한다', () => {
  const r = resolveRecipients({
    def: plain,
    audience: 'user',
    switches: {},
    candidates: [
      { email: null, optIn: true },
      { email: '깨진주소', optIn: true },
      { email: 'ok@b.com', optIn: true },
    ],
    staffTo: [],
  });
  assert.deepEqual(r.addresses, ['ok@b.com']);
  assert.deepEqual(
    r.skipped.map((s) => s.reason).sort(),
    ['invalid-address', 'no-address']
  );
});

test('staff 대상은 staffTo를 쓰고 개인 수신거부가 없다', () => {
  const r = resolveRecipients({
    def: plain,
    audience: 'staff',
    switches: {},
    candidates: [{ email: 'ignored@b.com', optIn: false }],
    staffTo: ['ops1@b.com', 'ops2@b.com'],
  });
  assert.deepEqual(r.addresses, ['ops1@b.com', 'ops2@b.com']);
});

test('중복 주소는 한 번만 남는다 — 형제가 둘이면 보호자가 두 번 들어온다', () => {
  const r = resolveRecipients({
    def: plain,
    audience: 'user',
    switches: {},
    candidates: [
      { email: 'mom@b.com', optIn: true },
      { email: 'MOM@b.com', optIn: true },
      { email: 'kid@b.com', optIn: true },
    ],
    staffTo: [],
  });
  assert.equal(r.addresses.length, 2);
});

test('회원이 아닐 수 있는 이벤트는 옵트아웃 관문을 건너뛴다', () => {
  const nonMember: MailEventDef = { ...plain, key: 't.nm', allowNonMember: true };
  const r = resolveRecipients({
    def: nonMember,
    audience: 'user',
    switches: {},
    // 비회원은 optIn 정보가 없다(undefined)
    candidates: [{ email: 'guest@b.com' }],
    staffTo: [],
  });
  assert.deepEqual(r.addresses, ['guest@b.com']);
});

test('isAudienceOn — 정의에 없는 대상은 항상 꺼짐', () => {
  const userOnly: MailEventDef = { ...plain, audiences: ['user'] };
  assert.equal(isAudienceOn(userOnly, 'staff', {}), false);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test lib/mail/recipients.test.ts`
Expected: FAIL — `Cannot find module './recipients.ts'`

- [ ] **Step 3: 구현**

`lib/mail/recipients.ts`:

```ts
/**
 * 수신자 결정 — 3중 관문 (순수 함수)
 *
 * 조건이 하나 빠져도 아무도 모르는 자리다(메일이 안 온 걸 눈치채는 사람이 없다).
 * lib/d1/eventViews.ts와 같은 이유로 순수하게 유지하고 시험으로 의도를 잠근다.
 */

import { isValidEmail } from './config';
import { isEssential, type MailEventDef } from './events';
import type { MailAudience, MailEventSwitches } from '@/types/mail';

export type SkipReason =
  | 'switch-off'
  | 'opted-out'
  | 'no-address'
  | 'invalid-address';

export interface RecipientCandidate {
  email: string | null;
  /**
   * 개인 수신 설정. 비회원(문의자 등)은 undefined —
   * allowNonMember 이벤트에서 관문을 건너뛴다.
   */
  optIn?: boolean;
}

export interface ResolveRecipientsInput {
  def: MailEventDef;
  audience: MailAudience;
  switches: MailEventSwitches;
  /** audience='user'일 때의 후보(당사자 + 보호자) */
  candidates: RecipientCandidate[];
  /** audience='staff'일 때의 수신처 */
  staffTo: string[];
}

export interface ResolveRecipientsResult {
  addresses: string[];
  skipped: { email: string | null; reason: SkipReason }[];
}

/** 관리자가 이 이벤트 × 대상을 켰는가. 설정에 없으면 레지스트리 기본값. */
export function isAudienceOn(
  def: MailEventDef,
  audience: MailAudience,
  switches: MailEventSwitches
): boolean {
  if (!def.audiences.includes(audience)) return false;
  const saved = switches[def.key]?.[audience];
  if (saved && typeof saved.email === 'boolean') return saved.email;
  return def.defaultOn[audience] ?? false;
}

export function resolveRecipients(
  input: ResolveRecipientsInput
): ResolveRecipientsResult {
  const { def, audience, switches, candidates, staffTo } = input;
  const skipped: ResolveRecipientsResult['skipped'] = [];
  const essential = isEssential(def, audience);

  // 관문 1 — 관리자 스위치 (필수 이벤트는 통과한 것으로 본다)
  if (!essential && !isAudienceOn(def, audience, switches)) {
    return { addresses: [], skipped: [{ email: null, reason: 'switch-off' }] };
  }
  if (!def.audiences.includes(audience)) {
    return { addresses: [], skipped: [{ email: null, reason: 'switch-off' }] };
  }

  const raw: RecipientCandidate[] =
    audience === 'staff'
      ? staffTo.map((email) => ({ email }))
      : candidates;

  const seen = new Set<string>();
  const addresses: string[] = [];

  for (const c of raw) {
    // 관문 2 — 개인 수신거부 (staff·필수·비회원 이벤트는 해당 없음)
    if (
      audience === 'user' &&
      !essential &&
      !def.allowNonMember &&
      c.optIn === false
    ) {
      skipped.push({ email: c.email, reason: 'opted-out' });
      continue;
    }

    // 관문 3 — 주소 유효성
    if (!c.email) {
      skipped.push({ email: null, reason: 'no-address' });
      continue;
    }
    const email = c.email.trim();
    if (!isValidEmail(email)) {
      skipped.push({ email, reason: 'invalid-address' });
      continue;
    }

    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    addresses.push(email);
  }

  return { addresses, skipped };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test lib/mail/recipients.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/mail/recipients.ts lib/mail/recipients.test.ts
git commit -m "feat(mail): 수신자 결정 3중 관문

관리자 스위치 · 개인 수신거부 · 주소 유효성을 순서대로 통과한 주소만 남긴다.
필수 이벤트는 앞의 두 관문을 무시한다 — 못 받으면 계정을 못 쓴다.
조건이 빠져도 아무도 모르는 자리라 순수 함수로 두고 시험으로 잠근다."
```

---

### Task 5: 한도 판정 (순수 함수)

**Files:**
- Create: `lib/mail/quota.ts`
- Test: `lib/mail/quota.test.ts`

**Interfaces:**
- Consumes: `types/mail.ts`(Task 1)
- Produces: `QuotaUsage`, `QuotaDecision`, `decideQuota(usage, limits, recipientCount, essential): QuotaDecision`, `quotaPercent(sent, limit): number`, `monthRangeUtcFromSiteDay(day: string): { start: string; end: string }`, `dayRangeFromSiteDay(day: string, timeZone: string): { start: string; end: string }`

- [ ] **Step 1: 실패하는 테스트 작성**

`lib/mail/quota.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideQuota, quotaPercent } from './quota.ts';

const limits = { dailyLimit: 100, monthlyLimit: 3000, warnAtPercent: 80 };

test('여유가 있으면 보낸다', () => {
  const d = decideQuota({ dailySent: 10, monthlySent: 200 }, limits, 5, false);
  assert.equal(d.allow, true);
  assert.equal(d.warn, false);
});

test('경고 임계를 넘으면 allow하되 warn이 선다', () => {
  const d = decideQuota({ dailySent: 79, monthlySent: 200 }, limits, 2, false);
  assert.equal(d.allow, true);
  assert.equal(d.warn, true);
});

test('일일 한도를 넘기면 막는다', () => {
  const d = decideQuota({ dailySent: 98, monthlySent: 200 }, limits, 5, false);
  assert.equal(d.allow, false);
  assert.equal(d.reason, 'daily');
});

test('딱 맞으면 보낸다 — 경계는 초과일 때만 막는다', () => {
  const d = decideQuota({ dailySent: 95, monthlySent: 200 }, limits, 5, false);
  assert.equal(d.allow, true);
});

test('월 한도도 막는다', () => {
  const d = decideQuota({ dailySent: 1, monthlySent: 2999 }, limits, 5, false);
  assert.equal(d.allow, false);
  assert.equal(d.reason, 'monthly');
});

test('필수 메일은 한도를 넘어도 보낸다', () => {
  const d = decideQuota({ dailySent: 100, monthlySent: 3000 }, limits, 1, true);
  assert.equal(d.allow, true);
});

test('단체 발송은 수신자 수만큼 한 번에 판정한다 — 일부만 보내지 않는다', () => {
  // 남은 자리 10, 수신자 30 → 전부 보류
  const d = decideQuota({ dailySent: 90, monthlySent: 200 }, limits, 30, false);
  assert.equal(d.allow, false);
  assert.equal(d.reason, 'daily');
});

test('quotaPercent', () => {
  assert.equal(quotaPercent(50, 100), 50);
  assert.equal(quotaPercent(0, 100), 0);
  assert.equal(quotaPercent(150, 100), 100);
  assert.equal(quotaPercent(5, 0), 100);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test lib/mail/quota.test.ts`
Expected: FAIL — `Cannot find module './quota.ts'`

- [ ] **Step 3: 구현**

`lib/mail/quota.ts`:

```ts
/**
 * 발송 한도 판정 (순수 함수)
 *
 * Resend 무료는 월 3,000 / 하루 100이고 하루 100은 하드 캡이다(초과분 과금이
 * 아니라 그냥 막힌다). 그리고 To·CC·BCC의 각 수신자를 1통으로 세므로,
 * 판정 단위도 "수신자 수"다.
 *
 * 한도를 넘기 전에 막는 것이 핵심 — 429를 받고 실패하는 것보다
 * "한도 초과로 미발송 12건"이 화면에 남는 편이 낫다.
 */

import type { MailQuotaConfig } from '@/types/mail';

export interface QuotaUsage {
  dailySent: number;
  monthlySent: number;
}

export type QuotaDecision =
  | { allow: true; warn: boolean }
  | { allow: false; reason: 'daily' | 'monthly'; warn: boolean };

export function quotaPercent(sent: number, limit: number): number {
  if (!limit || limit <= 0) return 100;
  return Math.min(100, Math.round((sent / limit) * 100));
}

/**
 * 이 발송을 허용할지 정한다.
 *
 * @param recipientCount 이번에 보낼 수신자 수(단체 발송은 전원)
 * @param essential      끌 수 없는 메일인가 — 한도를 넘어도 보낸다
 */
export function decideQuota(
  usage: QuotaUsage,
  limits: MailQuotaConfig,
  recipientCount: number,
  essential: boolean
): QuotaDecision {
  const afterDaily = usage.dailySent + recipientCount;
  const afterMonthly = usage.monthlySent + recipientCount;
  const warn = quotaPercent(afterDaily, limits.dailyLimit) >= limits.warnAtPercent;

  // 못 보내면 계정을 못 쓰는 메일은 한도보다 우선한다.
  if (essential) return { allow: true, warn };

  // 단체 발송에서 일부만 보내면 "누구는 받고 누구는 못 받은" 상태가 된다 —
  // 그건 안 보낸 것보다 나쁘다(아무도 그 사실을 모른다). 통째로 판정한다.
  if (afterDaily > limits.dailyLimit) return { allow: false, reason: 'daily', warn };
  if (afterMonthly > limits.monthlyLimit) {
    return { allow: false, reason: 'monthly', warn };
  }
  return { allow: true, warn };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test lib/mail/quota.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/mail/quota.ts lib/mail/quota.test.ts
git commit -m "feat(mail): 발송 한도 판정

Resend 무료의 하루 100통은 하드 캡이고 BCC 수신자도 각각 1통으로 센다.
그래서 판정 단위가 '수신자 수'이고, 단체 발송은 통째로 판정한다 —
일부만 보내면 못 받은 사람이 그 사실을 영영 모른다.
필수 메일은 한도보다 우선한다."
```

---

### Task 6: 발송 로그 (D1)

**Files:**
- Create: `migrations/0036_mail_log.sql` (번호는 생성 직전 확인)
- Create: `lib/d1/mailLog.ts`
- Modify: `lib/d1/index.ts` (재수출)

**Interfaces:**
- Consumes: `types/mail.ts`(Task 1), `lib/d1/client.ts`의 `queryD1`/`executeD1`/`batchD1`
- Produces: `MailLogInsert`, `insertMailLogs(rows): Promise<void>`, `getUsageCounts(timeZone): Promise<QuotaUsage>`, `searchMailLog(params): Promise<{ rows: MailLogRow[]; total: number }>`, `getMailLogById(id): Promise<MailLogRow | null>`, `wasEventSentToday(eventKey, timeZone): Promise<boolean>`, `purgeMailLogOlderThan(days): Promise<number>`

- [ ] **Step 1: 마이그레이션 번호 확인**

```bash
git fetch origin --quiet && ls migrations/ | tail -3
```
가장 큰 번호 + 1을 쓴다. 아래는 `0036`을 가정한다.

- [ ] **Step 2: 마이그레이션 작성**

`migrations/0036_mail_log.sql`:

```sql
-- 0036: 메일 발송 내역 (Cloudflare D1)
--
-- 성공만이 아니라 건너뛴 것도 남긴다 — "왜 안 왔지"의 답이 대부분 여기 있다.
-- 스위치가 꺼져 있었는지(skipped), 한도에 막혔는지(quota_blocked),
-- 주소가 없었는지(skipped + detail). 성공만 남기면 이 질문에 답할 수 없다.
--
-- 적용: node scripts/d1Migrate.mjs migrations/0036_mail_log.sql

CREATE TABLE IF NOT EXISTS mail_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  event_key     TEXT NOT NULL,
  audience      TEXT NOT NULL,              -- 'user' | 'staff'
  to_address    TEXT NOT NULL,
  subject       TEXT NOT NULL,
  -- redactBody 이벤트(임시 비밀번호 등)는 NULL. 단체 발송은 대표 행에만 저장한다.
  body          TEXT,
  status        TEXT NOT NULL,              -- sent | failed | skipped | quota_blocked
  detail        TEXT,
  provider      TEXT,
  provider_id   TEXT,
  -- 단체 발송(BCC) 묶음. 단건은 NULL.
  batch_id      TEXT,
  -- Resend 응답 헤더가 알려준 그 시점 사용량(자체 집계와 대조용)
  quota_daily   INTEGER,
  quota_monthly INTEGER,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mail_log_created ON mail_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mail_log_event   ON mail_log(event_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mail_log_to      ON mail_log(to_address);
CREATE INDEX IF NOT EXISTS idx_mail_log_status  ON mail_log(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mail_log_batch   ON mail_log(batch_id);
```

- [ ] **Step 3: 마이그레이션 적용**

Run: `node scripts/d1Migrate.mjs migrations/0036_mail_log.sql`
Expected: 성공 출력. D1은 원격이므로 로컬/운영 구분 없이 즉시 반영된다.

- [ ] **Step 4: 데이터 접근 모듈 작성**

`lib/d1/mailLog.ts`:

```ts
/**
 * 메일 발송 내역 — D1
 *
 * 사용량 집계의 1차 근거다. Resend가 BCC 수신자도 각각 1통으로 세므로
 * 여기도 수신자당 1행이어야 게이지가 실제 잔량과 일치한다.
 * API 호출 수로 세면 화면은 "12통"인데 provider는 한도 초과를 반환하는
 * 상태가 된다.
 */

import { queryD1, executeD1, batchD1 } from './client';
import { dayInTimeZone } from '@/lib/siteDay';
import type { MailAudience, MailLogRow, MailLogStatus } from '@/types/mail';

export interface MailLogInsert {
  eventKey: string;
  audience: MailAudience;
  toAddress: string;
  subject: string;
  body?: string | null;
  status: MailLogStatus;
  detail?: string | null;
  provider?: string | null;
  providerId?: string | null;
  batchId?: string | null;
  quotaDaily?: number | null;
  quotaMonthly?: number | null;
}

const INSERT_SQL = `
  INSERT INTO mail_log
    (event_key, audience, to_address, subject, body, status, detail,
     provider, provider_id, batch_id, quota_daily, quota_monthly)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

function insertParams(r: MailLogInsert): unknown[] {
  return [
    r.eventKey,
    r.audience,
    r.toAddress,
    r.subject.slice(0, 500),
    r.body ?? null,
    r.status,
    r.detail?.slice(0, 1000) ?? null,
    r.provider ?? null,
    r.providerId ?? null,
    r.batchId ?? null,
    r.quotaDaily ?? null,
    r.quotaMonthly ?? null,
  ];
}

/** 여러 행을 한 번에. 로그 쓰기 실패가 발송 흐름을 깨지 않게 삼킨다. */
export async function insertMailLogs(rows: MailLogInsert[]): Promise<void> {
  if (!rows.length) return;
  try {
    if (rows.length === 1) {
      await executeD1(INSERT_SQL, insertParams(rows[0]));
      return;
    }
    await batchD1(rows.map((r) => ({ sql: INSERT_SQL, params: insertParams(r) })));
  } catch (error) {
    console.error('[mail] 발송 로그 저장 실패:', error);
  }
}

/**
 * 오늘/이번 달 발송 수(status='sent' 행 수).
 * '오늘'은 사이트 시간대 기준 — UTC로 재면 저녁에 카운터가 넘어간다.
 */
export async function getUsageCounts(
  timeZone: string
): Promise<{ dailySent: number; monthlySent: number }> {
  const today = dayInTimeZone(new Date(), timeZone); // 'YYYY-MM-DD'
  const monthPrefix = today.slice(0, 7); // 'YYYY-MM'
  const rows = await queryD1<{ daily: number; monthly: number }>(
    `SELECT
       SUM(CASE WHEN substr(created_at, 1, 10) = ? THEN 1 ELSE 0 END) AS daily,
       SUM(CASE WHEN substr(created_at, 1, 7)  = ? THEN 1 ELSE 0 END) AS monthly
     FROM mail_log
     WHERE status = 'sent' AND substr(created_at, 1, 7) = ?`,
    [today, monthPrefix, monthPrefix]
  );
  return {
    dailySent: Number(rows[0]?.daily ?? 0),
    monthlySent: Number(rows[0]?.monthly ?? 0),
  };
}

/** 오늘 이 이벤트가 이미 나갔는가 — 한도 경고를 하루 한 번으로 묶는 데 쓴다. */
export async function wasEventSentToday(
  eventKey: string,
  timeZone: string
): Promise<boolean> {
  const today = dayInTimeZone(new Date(), timeZone);
  const rows = await queryD1<{ n: number }>(
    `SELECT COUNT(*) AS n FROM mail_log
      WHERE event_key = ? AND status = 'sent' AND substr(created_at, 1, 10) = ?`,
    [eventKey, today]
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

export interface MailLogSearch {
  /** 'YYYY-MM-DD' 이상 */
  from?: string;
  /** 'YYYY-MM-DD' 이하 */
  to?: string;
  eventKey?: string;
  status?: MailLogStatus;
  /** 수신자 주소 또는 제목 부분일치 */
  q?: string;
  page?: number;
  pageSize?: number;
}

export async function searchMailLog(
  params: MailLogSearch
): Promise<{ rows: MailLogRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, params.pageSize ?? 50));
  const where: string[] = [];
  const args: unknown[] = [];

  if (params.from) {
    where.push('substr(created_at, 1, 10) >= ?');
    args.push(params.from);
  }
  if (params.to) {
    where.push('substr(created_at, 1, 10) <= ?');
    args.push(params.to);
  }
  if (params.eventKey) {
    where.push('event_key = ?');
    args.push(params.eventKey);
  }
  if (params.status) {
    where.push('status = ?');
    args.push(params.status);
  }
  if (params.q?.trim()) {
    where.push('(to_address LIKE ? OR subject LIKE ?)');
    const like = `%${params.q.trim()}%`;
    args.push(like, like);
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const countRows = await queryD1<{ n: number }>(
    `SELECT COUNT(*) AS n FROM mail_log ${clause}`,
    args
  );
  const rows = await queryD1<MailLogRow>(
    `SELECT * FROM mail_log ${clause}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?`,
    [...args, pageSize, (page - 1) * pageSize]
  );
  return { rows, total: Number(countRows[0]?.n ?? 0), page, pageSize };
}

export async function getMailLogById(id: number): Promise<MailLogRow | null> {
  const rows = await queryD1<MailLogRow>('SELECT * FROM mail_log WHERE id = ?', [id]);
  return rows[0] ?? null;
}

/** 같은 batch의 대표 행(본문을 가진 행)을 찾는다 — 단체 발송 본문 보기용. */
export async function getBatchBody(batchId: string): Promise<string | null> {
  const rows = await queryD1<{ body: string | null }>(
    `SELECT body FROM mail_log
      WHERE batch_id = ? AND body IS NOT NULL
      LIMIT 1`,
    [batchId]
  );
  return rows[0]?.body ?? null;
}

/** 보관 기간이 지난 기록 정리. 반환값은 삭제된 행 수. */
export async function purgeMailLogOlderThan(days: number): Promise<number> {
  const result = await executeD1(
    `DELETE FROM mail_log WHERE created_at < datetime('now', ?)`,
    [`-${Math.max(1, Math.trunc(days))} days`]
  );
  return result.changes;
}
```

- [ ] **Step 5: `lib/d1/index.ts`에 재수출 추가**

`lib/d1/index.ts` 끝에 다른 모듈과 같은 형식으로 추가:

```ts
export * from './mailLog';
```

(파일의 기존 재수출 스타일을 먼저 확인하고 그 형식에 맞춘다.)

- [ ] **Step 6: 타입 체크**

Run: `npx tsc --noEmit`
Expected: `lib/d1/mailLog.ts`에서 오류 없음

- [ ] **Step 7: 커밋**

```bash
git add migrations/0036_mail_log.sql lib/d1/mailLog.ts lib/d1/index.ts
git commit -m "feat(mail): 발송 내역 테이블과 집계·검색

성공만이 아니라 건너뛴 것(스위치 off·수신거부·한도 초과)도 남긴다 —
'왜 안 왔지'의 답이 대부분 거기 있다. BCC 수신자도 각각 1통으로 세이므로
로그도 수신자당 1행이어야 게이지가 실제 잔량과 맞는다."
```

---

### Task 7: 본문 템플릿

**Files:**
- Create: `lib/mail/templates/index.ts`

**Interfaces:**
- Consumes: `lib/mail/events.ts`(Task 1)
- Produces: `MailTemplateData`, `MailBody`, `renderMailBody(eventKey, audience, data): MailBody`

- [ ] **Step 1: 구현**

`lib/mail/templates/index.ts`:

```ts
/**
 * 메일 본문 — 이벤트별 제목·내용
 *
 * 회원별 언어 선호를 저장하는 자리가 없으므로(users에 언어 컬럼 없음)
 * 한 통에 한국어와 영어를 함께 싣는다. 제목도 '한국어 / English'.
 *
 * 새 이벤트 추가 = 여기 case 1개 + events.ts에 정의 1건.
 */

import type { MailAudience } from '@/types/mail';

/** 템플릿이 쓰는 치환값. 호출부가 채운다. */
export type MailTemplateData = Record<string, string | number | undefined>;

export interface MailBody {
  subject: string;
  text: string;
}

const SITE_NAME = 'KTDOC 춤누리';

function line(ko: string, en: string): string {
  return `${ko}\n${en}`;
}

/** 한국어 본문과 영어 본문을 구분선으로 잇는다. */
function bilingual(ko: string, en: string): string {
  return `${ko.trim()}\n\n${'─'.repeat(32)}\n\n${en.trim()}\n\n— ${SITE_NAME}`;
}

function s(data: MailTemplateData, key: string, fallback = ''): string {
  const v = data[key];
  return v === undefined || v === null ? fallback : String(v);
}

/**
 * 이벤트 키와 대상에 맞는 제목·본문을 만든다.
 * 모르는 키는 일반 문구로 떨어진다 — 레지스트리에만 추가하고 본문을 빠뜨려도
 * 발송이 통째로 깨지지 않는다.
 */
export function renderMailBody(
  eventKey: string,
  audience: MailAudience,
  data: MailTemplateData
): MailBody {
  const name = s(data, 'name', '회원');
  const title = s(data, 'title');
  const url = s(data, 'url');
  const linkKo = url ? `\n\n자세히 보기: ${url}` : '';
  const linkEn = url ? `\n\nDetails: ${url}` : '';

  switch (`${eventKey}:${audience}`) {
    case 'member.signup:user':
      return {
        subject: line('가입 신청이 접수되었습니다', 'Your registration was received').replace('\n', ' / '),
        text: bilingual(
          `${name} 님, 가입 신청이 접수되었습니다.\n\n운영진이 확인한 뒤 승인해 드립니다. 승인이 완료되면 다시 안내드리겠습니다.${linkKo}`,
          `Hello ${name}, we received your registration.\n\nOur staff will review and approve it shortly. We'll email you again once it's approved.${linkEn}`
        ),
      };

    case 'member.signup:staff':
      return {
        subject: `[${SITE_NAME}] 새 가입 신청 — ${name}`,
        text: bilingual(
          `새 회원이 가입을 신청했습니다.\n\n이름: ${name}\n이메일: ${s(data, 'email')}\n연락처: ${s(data, 'phone', '-')}${linkKo}`,
          `A new member has registered.\n\nName: ${name}\nEmail: ${s(data, 'email')}\nPhone: ${s(data, 'phone', '-')}${linkEn}`
        ),
      };

    case 'member.approved:user':
      return {
        subject: '가입이 승인되었습니다 / Your account is approved',
        text: bilingual(
          `${name} 님, 가입이 승인되었습니다.\n\n이제 로그인하여 수업 일정과 공연 소식을 확인하실 수 있습니다.${linkKo}`,
          `Hello ${name}, your account has been approved.\n\nYou can now sign in to view class schedules and performance news.${linkEn}`
        ),
      };

    case 'member.temp_password:user':
      return {
        subject: '임시 비밀번호 안내 / Temporary password',
        text: bilingual(
          `${name} 님, 임시 비밀번호를 발급해 드렸습니다.\n\n임시 비밀번호: ${s(data, 'tempPassword')}\n\n이 비밀번호로 로그인하시면 새 비밀번호를 정하는 화면으로 이동합니다. 보안을 위해 로그인 후 바로 변경해 주세요.${linkKo}`,
          `Hello ${name}, a temporary password has been issued for your account.\n\nTemporary password: ${s(data, 'tempPassword')}\n\nAfter signing in you'll be asked to set a new password. Please change it right away.${linkEn}`
        ),
      };

    case 'enrollment.created:user':
      return {
        subject: `수업 등록 안내 — ${title} / Class enrollment`,
        text: bilingual(
          `${name} 님의 수업 등록이 완료되었습니다.\n\n수업: ${title}\n${s(data, 'schedule') ? `일정: ${s(data, 'schedule')}\n` : ''}${linkKo}`,
          `Enrollment confirmed for ${name}.\n\nClass: ${title}\n${s(data, 'schedule') ? `Schedule: ${s(data, 'schedule')}\n` : ''}${linkEn}`
        ),
      };

    case 'enrollment.created:staff':
      return {
        subject: `[${SITE_NAME}] 수업 등록 — ${name} / ${title}`,
        text: bilingual(
          `수업 등록이 있었습니다.\n\n원생: ${name}\n수업: ${title}${linkKo}`,
          `A new class enrollment.\n\nStudent: ${name}\nClass: ${title}${linkEn}`
        ),
      };

    case 'application.created:user':
      return {
        subject: `참가 신청이 접수되었습니다 — ${title}`,
        text: bilingual(
          `${name} 님, 참가 신청이 접수되었습니다.\n\n공연: ${title}\n\n확인 후 안내드리겠습니다.${linkKo}`,
          `Hello ${name}, your application was received.\n\nPerformance: ${title}\n\nWe'll be in touch after review.${linkEn}`
        ),
      };

    case 'application.created:staff':
      return {
        subject: `[${SITE_NAME}] 참가 신청 — ${title} / ${name}`,
        text: bilingual(
          `참가 신청이 접수되었습니다.\n\n공연: ${title}\n신청자: ${name}\n이메일: ${s(data, 'email')}\n연락처: ${s(data, 'phone', '-')}${linkKo}`,
          `A new application was received.\n\nPerformance: ${title}\nApplicant: ${name}\nEmail: ${s(data, 'email')}\nPhone: ${s(data, 'phone', '-')}${linkEn}`
        ),
      };

    case 'checkin.created:user':
      return {
        subject: `참여가 확정되었습니다 — ${title}`,
        text: bilingual(
          `${name} 님의 참여가 확정되었습니다.\n\n공연: ${title}\n${s(data, 'when') ? `일시: ${s(data, 'when')}\n` : ''}${s(data, 'where') ? `장소: ${s(data, 'where')}\n` : ''}${linkKo}`,
          `Participation confirmed for ${name}.\n\nPerformance: ${title}\n${s(data, 'when') ? `When: ${s(data, 'when')}\n` : ''}${s(data, 'where') ? `Where: ${s(data, 'where')}\n` : ''}${linkEn}`
        ),
      };

    case 'checkin.created:staff':
      return {
        subject: `[${SITE_NAME}] 참여 확정 — ${title} / ${name}`,
        text: bilingual(
          `참여가 확정되었습니다.\n\n공연: ${title}\n참가자: ${name}${linkKo}`,
          `Participation confirmed.\n\nPerformance: ${title}\nParticipant: ${name}${linkEn}`
        ),
      };

    case 'form.submitted:user':
      return {
        subject: `신청서가 접수되었습니다 — ${title}`,
        text: bilingual(
          `${name} 님, 신청서가 접수되었습니다.\n\n신청서: ${title}\n\n확인 후 안내드리겠습니다.${linkKo}`,
          `Hello ${name}, your form was submitted.\n\nForm: ${title}\n\nWe'll be in touch after review.${linkEn}`
        ),
      };

    case 'form.submitted:staff':
      return {
        subject: `[${SITE_NAME}] 신청서 응답 — ${title} / ${name}`,
        text: bilingual(
          `신청서 응답이 들어왔습니다.\n\n신청서: ${title}\n제출자: ${name}${linkKo}`,
          `A new form response.\n\nForm: ${title}\nSubmitted by: ${name}${linkEn}`
        ),
      };

    case 'feedback.created:user':
      return {
        subject: '문의가 접수되었습니다 / We received your message',
        text: bilingual(
          `${name} 님, 문의가 접수되었습니다.\n\n보내주신 내용을 확인한 뒤 답변드리겠습니다.\n\n─ 보내신 내용 ─\n${s(data, 'message')}`,
          `Hello ${name}, we received your message.\n\nWe'll review it and get back to you.\n\n— Your message —\n${s(data, 'message')}`
        ),
      };

    case 'feedback.created:staff':
      return {
        subject: `[${SITE_NAME}] 홈페이지 문의 — ${name}`,
        text: bilingual(
          `홈페이지 문의가 접수되었습니다.\n\n이름: ${name}\n이메일: ${s(data, 'email')}\n연락처: ${s(data, 'phone', '-')}\n\n─ 내용 ─\n${s(data, 'message')}`,
          `A new inquiry from the website.\n\nName: ${name}\nEmail: ${s(data, 'email')}\nPhone: ${s(data, 'phone', '-')}\n\n— Message —\n${s(data, 'message')}`
        ),
      };

    case 'event.reminder:user':
      return {
        subject: `내일 일정 안내 — ${title} / Tomorrow: ${title}`,
        text: bilingual(
          `내일 일정을 안내드립니다.\n\n${title}\n${s(data, 'when') ? `일시: ${s(data, 'when')}\n` : ''}${s(data, 'where') ? `장소: ${s(data, 'where')}\n` : ''}${s(data, 'note') ? `\n${s(data, 'note')}\n` : ''}${linkKo}`,
          `A reminder for tomorrow.\n\n${title}\n${s(data, 'when') ? `When: ${s(data, 'when')}\n` : ''}${s(data, 'where') ? `Where: ${s(data, 'where')}\n` : ''}${linkEn}`
        ),
      };

    case 'quota.warning:staff':
      return {
        subject: `[${SITE_NAME}] 오늘 메일 발송량이 ${s(data, 'percent')}%에 도달했습니다`,
        text: bilingual(
          `오늘 메일 발송량이 한도에 가까워졌습니다.\n\n오늘: ${s(data, 'dailySent')} / ${s(data, 'dailyLimit')} 통\n이번 달: ${s(data, 'monthlySent')} / ${s(data, 'monthlyLimit')} 통\n\n한도에 도달하면 일반 알림은 발송되지 않고 내역에 '한도 초과'로 기록됩니다. 비밀번호 안내처럼 꼭 필요한 메일은 계속 나갑니다.${linkKo}`,
          `Today's email volume is approaching the limit.\n\nToday: ${s(data, 'dailySent')} / ${s(data, 'dailyLimit')}\nThis month: ${s(data, 'monthlySent')} / ${s(data, 'monthlyLimit')}\n\nOnce the limit is reached, non-essential notifications are held and recorded as "quota exceeded". Essential emails still go out.${linkEn}`
        ),
      };

    default:
      // 레지스트리에만 있고 본문이 없는 이벤트 — 발송이 깨지지 않게 일반 문구로.
      return {
        subject: `[${SITE_NAME}] ${title || '알림'}`,
        text: bilingual(
          `${SITE_NAME}에서 보내는 알림입니다.${title ? `\n\n${title}` : ''}${linkKo}`,
          `A notification from ${SITE_NAME}.${title ? `\n\n${title}` : ''}${linkEn}`
        ),
      };
  }
}
```

- [ ] **Step 2: 타입 체크 후 커밋**

Run: `npx tsc --noEmit`

```bash
git add lib/mail/templates/index.ts
git commit -m "feat(mail): 이벤트별 본문(한/영 병기)

회원별 언어 선호를 저장하는 자리가 없어 한 통에 두 언어를 함께 싣는다.
모르는 이벤트 키는 일반 문구로 떨어진다 — 레지스트리에 추가하고 본문을
빠뜨려도 발송이 통째로 깨지지 않는다."
```

---

### Task 8: 오케스트레이션 — `notifyEvent()`

**Files:**
- Create: `lib/mail/notify.ts`

**Interfaces:**
- Consumes: Task 1~7 전부, `lib/members.ts`의 `getUsersByIds`/`getGuardianEmailsForStudents`, `lib/calendar.ts`의 `getCalendarConfig`
- Produces: `NotifyInput`, `notifyEvent(eventKey: string, input: NotifyInput): Promise<void>`, `notifyEventAfterResponse(eventKey, input): void`

- [ ] **Step 1: 구현**

`lib/mail/notify.ts`:

```ts
/**
 * 알림 오케스트레이션 — 각 기능이 부르는 단 하나의 입구
 *
 * 호출부는 "무슨 일이 있었는지"만 말한다. 누구에게 보낼지·보낼 수 있는지·
 * 무슨 문구인지는 전부 이 아래에서 정해진다.
 *
 * 절대 throw 하지 않는다 — 메일 실패가 가입·등록을 실패시키면 안 된다.
 */

import 'server-only';
import { after } from 'next/server';
import { getCalendarConfig } from '@/lib/calendar';
import { getGuardianEmailsForStudents, getUsersByIds } from '@/lib/members';
import { query } from '@/lib/db';
import { getMailEvent, isEssential } from './events';
import { loadMailConfig } from './config';
import { resolveMailConfig, sendMail } from './mailer';
import { resolveRecipients, type RecipientCandidate } from './recipients';
import { decideQuota, quotaPercent } from './quota';
import { renderMailBody, type MailTemplateData } from './templates';
import {
  getUsageCounts,
  insertMailLogs,
  wasEventSentToday,
  type MailLogInsert,
} from '@/lib/d1/mailLog';
import type { MailAudience } from '@/types/mail';

export interface NotifyInput {
  /** 'user' 대상의 회원 id들. 원생이면 보호자가 자동으로 더해진다. */
  userIds?: string[];
  /** 회원이 아닌 수신자(문의자 등). allowNonMember 이벤트에서 쓴다. */
  directEmails?: string[];
  /** 답장을 이 주소로 받고 싶을 때(문의 접수 → 문의자) */
  replyTo?: string;
  /** 템플릿 치환값 */
  data?: MailTemplateData;
}

interface MemberRow {
  id: string;
  name: string | null;
  email: string;
  role: string;
  email_opt_in: 0 | 1;
}

/**
 * 'user' 대상 후보를 만든다 — 당사자 + (원생이면) 연결된 보호자.
 *
 * 원생은 미성년이라 메일을 잘 보지 않는다. 수업 등록 확인이 원생에게만 가면
 * 학부모는 등록된 줄 모른다(기존 cron 리마인더도 이미 이렇게 동작한다).
 */
async function collectUserCandidates(
  userIds: string[],
  directEmails: string[]
): Promise<RecipientCandidate[]> {
  const candidates: RecipientCandidate[] = directEmails.map((email) => ({ email }));
  if (!userIds.length) return candidates;

  const placeholders = userIds.map(() => '?').join(', ');
  const members = await query<MemberRow[]>(
    `SELECT id, name, email, role, email_opt_in FROM users WHERE id IN (${placeholders})`,
    userIds
  );
  for (const m of members) {
    candidates.push({ email: m.email, optIn: m.email_opt_in !== 0 });
  }

  // 원생의 보호자 — 보호자 자신의 수신 설정으로 판정한다
  const studentIds = members.filter((m) => m.role === 'student').map((m) => m.id);
  if (studentIds.length) {
    const guardianMap = await getGuardianEmailsForStudents(studentIds);
    const guardianEmails = new Set<string>();
    for (const list of guardianMap.values()) for (const e of list) guardianEmails.add(e);

    if (guardianEmails.size) {
      const emails = Array.from(guardianEmails);
      const ph = emails.map(() => '?').join(', ');
      const guardians = await query<{ email: string; email_opt_in: 0 | 1 }[]>(
        `SELECT email, email_opt_in FROM users WHERE email IN (${ph})`,
        emails
      );
      const optInByEmail = new Map(
        guardians.map((g) => [g.email.toLowerCase(), g.email_opt_in !== 0])
      );
      for (const email of emails) {
        candidates.push({ email, optIn: optInByEmail.get(email.toLowerCase()) ?? true });
      }
    }
  }
  return candidates;
}

async function notifyAudience(
  eventKey: string,
  audience: MailAudience,
  input: NotifyInput,
  timeZone: string
): Promise<void> {
  const def = getMailEvent(eventKey);
  if (!def || !def.audiences.includes(audience)) return;

  const config = await loadMailConfig();
  const candidates =
    audience === 'user'
      ? await collectUserCandidates(input.userIds ?? [], input.directEmails ?? [])
      : [];

  const { addresses, skipped } = resolveRecipients({
    def,
    audience,
    switches: config.events,
    candidates,
    staffTo: config.staffTo,
  });

  const body = renderMailBody(eventKey, audience, input.data ?? {});
  const logs: MailLogInsert[] = skipped.map((s) => ({
    eventKey,
    audience,
    toAddress: s.email ?? '(없음)',
    subject: body.subject,
    body: null,
    status: 'skipped',
    detail: s.reason,
  }));

  if (!addresses.length) {
    await insertMailLogs(logs);
    return;
  }

  // ── 한도 판정 (수신자 수 단위)
  const essential = isEssential(def, audience);
  const usage = await getUsageCounts(timeZone);
  const decision = decideQuota(usage, config.quota, addresses.length, essential);

  if (!decision.allow) {
    logs.push(
      ...addresses.map((to): MailLogInsert => ({
        eventKey,
        audience,
        toAddress: to,
        subject: body.subject,
        body: null,
        status: 'quota_blocked',
        detail: `${decision.reason}-limit`,
      }))
    );
    await insertMailLogs(logs);
    await maybeWarnQuota(usage, config.quota, timeZone);
    return;
  }

  // ── 발송
  const resolved = resolveMailConfig(config);
  const bulk = def.bulk === true && addresses.length > 1;
  const batchId = bulk ? `${eventKey}-${Date.now()}` : null;
  const storedBody = def.redactBody ? null : body.text;

  if (bulk) {
    // 수신자끼리 주소가 보이지 않게 BCC로. to에는 발신 주소를 넣는다.
    const result = await sendMail(resolved, {
      to: [resolved.provider === 'none' ? '' : resolved.from].filter(Boolean),
      bcc: addresses,
      subject: body.subject,
      text: body.text,
      replyTo: input.replyTo,
    });
    logs.push(
      ...addresses.map((to, i): MailLogInsert => ({
        eventKey,
        audience,
        toAddress: to,
        subject: body.subject,
        // 100명분 본문 중복을 피한다 — 대표 행 하나에만 저장
        body: i === 0 ? storedBody : null,
        status: result.ok ? 'sent' : 'failed',
        detail: result.detail ?? null,
        provider: resolved.provider,
        providerId: result.providerId ?? null,
        batchId,
        quotaDaily: result.quotaDaily ?? null,
        quotaMonthly: result.quotaMonthly ?? null,
      }))
    );
  } else {
    for (const to of addresses) {
      const result = await sendMail(resolved, {
        to: [to],
        subject: body.subject,
        text: body.text,
        replyTo: input.replyTo,
      });
      logs.push({
        eventKey,
        audience,
        toAddress: to,
        subject: body.subject,
        body: storedBody,
        status: result.ok ? 'sent' : 'failed',
        detail: result.detail ?? null,
        provider: resolved.provider,
        providerId: result.providerId ?? null,
        quotaDaily: result.quotaDaily ?? null,
        quotaMonthly: result.quotaMonthly ?? null,
      });
    }
  }

  await insertMailLogs(logs);
  if (decision.warn) await maybeWarnQuota(usage, config.quota, timeZone);
}

/** 한도 경고 — 하루 한 번만. 경고 메일 자체가 한도를 먹는다. */
async function maybeWarnQuota(
  usage: { dailySent: number; monthlySent: number },
  limits: { dailyLimit: number; monthlyLimit: number; warnAtPercent: number },
  timeZone: string
): Promise<void> {
  try {
    if (await wasEventSentToday('quota.warning', timeZone)) return;
    await notifyAudience(
      'quota.warning',
      'staff',
      {
        data: {
          percent: quotaPercent(usage.dailySent, limits.dailyLimit),
          dailySent: usage.dailySent,
          dailyLimit: limits.dailyLimit,
          monthlySent: usage.monthlySent,
          monthlyLimit: limits.monthlyLimit,
        },
      },
      timeZone
    );
  } catch (error) {
    console.error('[mail] 한도 경고 발송 실패:', error);
  }
}

/**
 * 이벤트 하나를 알린다. 정의된 모든 대상(user·staff)에게 순서대로.
 * 실패해도 던지지 않는다.
 */
export async function notifyEvent(
  eventKey: string,
  input: NotifyInput = {}
): Promise<void> {
  try {
    const def = getMailEvent(eventKey);
    if (!def) {
      console.warn(`[mail] 알 수 없는 이벤트: ${eventKey}`);
      return;
    }
    const { timezone } = await getCalendarConfig();
    for (const audience of def.audiences) {
      await notifyAudience(eventKey, audience, input, timezone);
    }
  } catch (error) {
    console.error(`[mail] notifyEvent(${eventKey}) 실패:`, error);
  }
}

/**
 * 사용자 요청에서 부를 때 — 응답을 붙잡지 않는다.
 * 메일 서버가 느려도 가입·등록 화면이 기다리지 않는다.
 *
 * cron 라우트에서는 쓰지 말 것. 응답 후 함수가 끝나면 발송이 잘린다.
 */
export function notifyEventAfterResponse(
  eventKey: string,
  input: NotifyInput = {}
): void {
  after(async () => {
    await notifyEvent(eventKey, input);
  });
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: `email_opt_in` 컬럼이 아직 없어도 SQL은 문자열이라 타입 오류는 없다. Task 11에서 컬럼을 만든다.

- [ ] **Step 3: 커밋**

```bash
git add lib/mail/notify.ts
git commit -m "feat(mail): notifyEvent — 각 기능이 부르는 단 하나의 입구

호출부는 무슨 일이 있었는지만 말한다. 원생에게 가는 메일은 보호자에게도
함께 가고(원생은 메일을 잘 보지 않는다), 보호자 수신 여부는 보호자
자신의 설정으로 판정한다. 단체 발송은 BCC 한 통 + 수신자당 로그 1행."
```

---

### Task 9: 관리 API

**Files:**
- Create: `app/api/admin/mail/route.ts`
- Create: `app/api/admin/mail/test/route.ts`
- Create: `app/api/admin/mail/log/route.ts`

**Interfaces:**
- Consumes: Task 2·3·6, `@/auth`의 `auth`, `@/lib/isAdmin`의 `isAdmin`
- Produces: REST 엔드포인트 3개

- [ ] **Step 1: 설정 GET/PUT**

`app/api/admin/mail/route.ts`:

```ts
/**
 * 메일 설정 API — GET(마스킹 조회) / PUT(부분 저장)
 *
 * 시크릿은 응답에 담지 않고(…Set 불리언만), 빈 값으로 덮어쓰지 않는다.
 * 주소 형식이 틀리면 400으로 거절한다 — 조용히 버리면 운영자는 저장됐다고 믿는다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { isValidEmail, loadMailConfig, saveMailConfig, toPublicMailConfig } from '@/lib/mail/config';
import { getUsageCounts } from '@/lib/d1/mailLog';
import { getCalendarConfig } from '@/lib/calendar';

function forbidden() {
  return NextResponse.json(
    { success: false, error: '관리자 권한이 필요합니다.' },
    { status: 403 }
  );
}

export async function GET() {
  try {
    const session = await auth();
    if (!isAdmin(session)) return forbidden();

    const config = await loadMailConfig();
    const { timezone } = await getCalendarConfig();
    const usage = await getUsageCounts(timezone).catch(() => ({
      dailySent: 0,
      monthlySent: 0,
    }));

    return NextResponse.json({
      success: true,
      config: toPublicMailConfig(config),
      usage,
    });
  } catch (error) {
    console.error('메일 설정 GET 오류:', error);
    return NextResponse.json(
      { success: false, error: '설정 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!isAdmin(session)) return forbidden();

    const body = (await request.json()) as Record<string, unknown>;

    // 주소 검증 — 틀리면 저장하지 않는다
    for (const field of ['from', 'replyTo'] as const) {
      const v = body[field];
      if (typeof v === 'string' && v.trim() && !isValidEmail(v)) {
        return NextResponse.json(
          { success: false, error: `${field} 주소 형식이 올바르지 않습니다: ${v}` },
          { status: 400 }
        );
      }
    }
    if (Array.isArray(body.staffTo)) {
      const bad = body.staffTo.find(
        (v) => typeof v !== 'string' || (v.trim() && !isValidEmail(v))
      );
      if (bad !== undefined) {
        return NextResponse.json(
          { success: false, error: `운영진 주소 형식이 올바르지 않습니다: ${String(bad)}` },
          { status: 400 }
        );
      }
    }

    const saved = await saveMailConfig(body);
    return NextResponse.json({ success: true, config: toPublicMailConfig(saved) });
  } catch (error) {
    console.error('메일 설정 PUT 오류:', error);
    return NextResponse.json(
      { success: false, error: '설정 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: 테스트 발송**

`app/api/admin/mail/test/route.ts`:

```ts
/**
 * 테스트 발송 — 저장본을 대상으로 보낸다
 *
 * 화면의 미저장 값을 받지 않는다. "빈 값 = 유지" 규칙과 얽히면
 * 테스트는 되는데 저장본은 다른 상태가 될 수 있다.
 *
 * 메일 설정은 조용히 실패하는 자리다. 저장 직후 눌러볼 수 있는 확인 경로가
 * 없으면 틀린 비밀번호를 실제 가입이 유실될 때에야 알게 된다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { loadMailConfig } from '@/lib/mail/config';
import { resolveMailConfig, sendMail } from '@/lib/mail/mailer';
import { isValidEmail } from '@/lib/mail/config';

/** 오타 난 설정으로 연타하면 상대 SMTP 서버가 이쪽을 차단할 수 있다. */
const attempts = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const list = (attempts.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_ATTEMPTS) {
    attempts.set(userId, list);
    return true;
  }
  list.push(now);
  attempts.set(userId, list);
  return false;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }
    const userId = session?.user?.id ?? 'unknown';
    if (rateLimited(userId)) {
      return NextResponse.json(
        { success: false, error: '테스트 발송이 너무 잦습니다. 10분 뒤에 다시 시도해 주세요.' },
        { status: 429 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as { to?: string };
    const config = await loadMailConfig();
    const to = (body.to ?? '').trim() || config.staffTo[0] || '';
    if (!to || !isValidEmail(to)) {
      return NextResponse.json(
        { success: false, error: '받는 주소를 입력해 주세요.' },
        { status: 400 }
      );
    }

    const resolved = resolveMailConfig(config);
    if (resolved.provider === 'none') {
      return NextResponse.json(
        { success: false, error: `발송 설정이 완료되지 않았습니다 (${resolved.reason}).` },
        { status: 400 }
      );
    }

    // 도착한 메일만 보고도 어느 설정이 동작했는지 알 수 있게 본문에 적는다.
    const result = await sendMail(resolved, {
      to: [to],
      subject: '[KTDOC] 메일 설정 테스트',
      text: [
        '이 메일이 보이면 발송 설정이 정상입니다.',
        '',
        `발송 방식: ${resolved.provider}`,
        `보내는 주소: ${resolved.fromName} <${resolved.from}>`,
        `답장 받을 주소: ${resolved.replyTo || '(미설정)'}`,
        `받는 주소: ${to}`,
        '',
        'If you can read this, the email configuration works.',
      ].join('\n'),
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: '발송에 실패했습니다.', detail: result.detail },
        { status: 502 }
      );
    }
    return NextResponse.json({ success: true, to, provider: resolved.provider });
  } catch (error) {
    console.error('메일 테스트 발송 오류:', error);
    return NextResponse.json(
      { success: false, error: '테스트 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: 내역 검색**

`app/api/admin/mail/log/route.ts`:

```ts
/**
 * 발송 내역 검색 — GET /api/admin/mail/log
 *
 * 쿼리: from, to, eventKey, status, q, page, pageSize, id(단건 상세)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import {
  getBatchBody,
  getMailLogById,
  searchMailLog,
} from '@/lib/d1/mailLog';
import type { MailLogStatus } from '@/types/mail';

const STATUSES: MailLogStatus[] = ['sent', 'failed', 'skipped', 'quota_blocked'];

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!isAdmin(session)) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const idParam = url.searchParams.get('id');
    if (idParam) {
      const row = await getMailLogById(Number(idParam));
      if (!row) {
        return NextResponse.json(
          { success: false, error: '기록을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }
      // 단체 발송은 대표 행에만 본문이 있다 — 같은 batch에서 끌어온다.
      const body =
        row.body ?? (row.batch_id ? await getBatchBody(row.batch_id) : null);
      return NextResponse.json({ success: true, row: { ...row, body } });
    }

    const statusParam = url.searchParams.get('status');
    const result = await searchMailLog({
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
      eventKey: url.searchParams.get('eventKey') ?? undefined,
      status: STATUSES.includes(statusParam as MailLogStatus)
        ? (statusParam as MailLogStatus)
        : undefined,
      q: url.searchParams.get('q') ?? undefined,
      page: Number(url.searchParams.get('page') ?? 1),
      pageSize: Number(url.searchParams.get('pageSize') ?? 50),
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('메일 내역 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '내역 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: 타입 체크 후 커밋**

Run: `npx tsc --noEmit`

```bash
git add app/api/admin/mail/
git commit -m "feat(mail): 관리 API (설정·테스트 발송·내역 검색)

테스트 발송은 저장본을 대상으로 한다 — 화면의 미저장 값을 받으면
'빈 값 = 유지' 규칙과 얽혀 테스트는 되는데 저장본은 다른 상태가 된다.
주소 형식은 400으로 거절한다(조용히 버리면 저장됐다고 믿는다)."
```

---

### Task 10: 관리 화면 + 메뉴 등록

**Files:**
- Modify: `types/permissions.ts` (MenuKey에 `'settings.mail'` 추가)
- Modify: `lib/admin/menu-registry.ts` (노드 1개 추가)
- Create: `app/admin/mail/page.tsx`
- Create: `app/admin/mail/MailSettingsClient.tsx`
- Create: `app/admin/mail/mail.css`
- Modify: `locale/ko.json`, `locale/en.json` (`admin.nav.settings.mail`)

**Interfaces:**
- Consumes: Task 1(레지스트리·타입), Task 9(API)

- [ ] **Step 1: 메뉴 키 등록**

`types/permissions.ts`의 `MenuKey` 유니온에서 `| 'settings.ai'` 다음 줄에 추가:

```ts
  | 'settings.mail'
```

- [ ] **Step 2: 레지스트리에 노드 추가**

`lib/admin/menu-registry.ts`에서 `settings.ai` 줄(약 133행) 바로 다음에:

```ts
  // 이메일: 발송 방법·발신 정보·어떤 일에 메일을 보낼지·발송 내역.
  // 시크릿(API 키·SMTP 비밀번호)을 다루므로 admin 전용으로 fail-closed.
  { key: 'settings.mail', href: '/admin/mail', label: '이메일 설정', iconKey: 'bell', group: 'ops', defaultRoles: ['admin'] },
```

> `iconKey`는 레지스트리가 이미 쓰는 값 중에서 고른다. 사용 가능한 키 목록은
> 파일 상단 타입 정의나 아이콘 렌더러에서 확인하고, 없으면 `'globe'`를 쓴다.

- [ ] **Step 3: locale 키 추가**

`locale/ko.json`:
```json
"admin.nav.settings.mail": "이메일 설정",
```
`locale/en.json`:
```json
"admin.nav.settings.mail": "Email",
```

- [ ] **Step 4: 서버 페이지**

`app/admin/mail/page.tsx`:

```tsx
/**
 * 이메일 설정 — 관리자 전용
 *
 * 발송 방법·발신 정보·이벤트 스위치·발송 내역 네 탭.
 * 레이아웃과 권한은 콘솔 셸이 강제하지만, 여기서도 한 번 더 막는다(fail-closed).
 */

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import MailSettingsClient from './MailSettingsClient';
import './mail.css';

export const dynamic = 'force-dynamic';

export default async function AdminMailPage() {
  const session = await auth();
  if (!isAdmin(session)) redirect('/admin');
  return <MailSettingsClient />;
}
```

- [ ] **Step 5: 클라이언트 화면**

`app/admin/mail/MailSettingsClient.tsx` — 요구사항(생김새는 콘솔의 기존 설정 화면과 맞추되, 동작은 이것을 갖춘다):

**탭 1 · 발송 방법**
- 라디오: `미설정(환경변수)` / `Resend` / `SMTP`
- Resend 선택 시: API 키 입력. `resendApiKeySet`이 true면 placeholder `저장됨 — 변경할 때만 입력`, 값은 항상 빈 칸으로 시작. 옆에 `키 삭제` 버튼(`clearResendApiKey: true` 전송)
- SMTP 선택 시에만: host / port / secure 체크박스 / username / password(같은 규칙, `clearSmtpPassword`)
- 포트 안내문: `465 = TLS (보안 연결 켬) · 587 = STARTTLS (보안 연결 끔). 25는 쓰지 않습니다.`
- **테스트 발송**: 받는 주소 입력 + 버튼. 실패 시 서버가 준 `detail`을 그대로 `<pre>`로 노출. 버튼 옆에 `저장한 뒤 눌러 주세요` 안내

**탭 2 · 발신 정보**
- 보내는 주소(`from`) — placeholder에 `mail.도메인 형식을 권장합니다`
- 표시 이름(`fromName`)
- 답장 받을 주소(`replyTo`) — 설명: `고객이 답장하면 이 주소로 옵니다. 인증이 필요 없어 늘 쓰시는 메일 주소를 넣으셔도 됩니다.`
- 운영진 알림 주소(`staffTo`) — 여러 줄 입력(줄바꿈으로 분리) 또는 칩 추가 UI
- 한도(`quota.dailyLimit` / `monthlyLimit` / `warnAtPercent`) — 기본값 옆에 `Resend 무료 기준` 표기

**탭 3 · 무엇을 보낼지**
- `MAIL_EVENT_GROUPS`를 순회하며 그룹별 섹션, 각 그룹 안에서 해당 `MAIL_EVENTS` 행
- 열: `회원` / `운영진`. 열 머리에 `원생에게 보내는 메일은 연결된 보호자에게도 함께 갑니다.`
- `def.audiences`에 없는 대상은 `—` 표시
- `isEssential(def, audience)`이면 스위치 대신 `필수` 배지 + title 속성으로 `받지 않으면 계정을 사용할 수 없어 끌 수 없습니다`
- 저장은 `{ events: {...} }` 전체를 PUT

**탭 4 · 발송 내역**
- 상단 게이지 2개: `오늘 n / dailyLimit`, `이번 달 n / monthlyLimit`. `quotaPercent`가 `warnAtPercent` 이상이면 경고색
- 필터: 기간(from/to date) · 이벤트 종류(select, `MAIL_EVENTS`에서) · 상태(select)
- 검색 입력 → `q`
- 표: 날짜 / 종류(label) / 받는 사람 / 제목 / 상태 배지. `batch_id`가 같은 연속 행은 `단체 발송 · n명`으로 접어서 표시
- 행 클릭 → 상세 패널(`?id=`). 본문이 null이고 이벤트가 `redactBody`면 `보안을 위해 본문을 저장하지 않는 메일입니다.` 표시
- 페이지 번호식 페이지네이션

**공통**
- 문구는 `useT()`로 `admin.mail.*` 키코드 + 한국어 fallback
- 저장 버튼은 탭별로 그 탭의 키만 PUT (부분 업데이트)
- 저장 성공/실패 토스트

- [ ] **Step 6: 스타일**

`app/admin/mail/mail.css` — 콘솔 토큰만 사용:
- 배경 `var(--surface-2)`, 전경 `rgba(var(--fg-rgb), α)`
- 금색 텍스트는 `var(--soft-gold-text)`, 배경·보더는 `var(--soft-gold)`
- 게이지 정상 = `var(--accent-color)`, 경고 = 경고색 지정 시 라이트 블록 보정 함께 추가
- 상태 배지: sent/failed/skipped/quota_blocked 네 가지

- [ ] **Step 7: 검증**

```bash
npm run lint:theme   # 0건
npx tsc --noEmit
npm run lint
```
그리고 **상단바 토글로 라이트·다크 두 테마를 눈으로 확인**한다.

- [ ] **Step 8: 커밋**

```bash
git add types/permissions.ts lib/admin/menu-registry.ts app/admin/mail/ locale/ko.json locale/en.json
git commit -m "feat(mail): 이메일 설정 화면 (발송 방법·발신 정보·이벤트·내역)

이벤트 탭은 레지스트리를 순회해 그린다 — 새 알림을 추가해도 화면 코드를
건드리지 않는다. 시크릿 입력칸은 저장 여부만 표시하고 값은 항상 빈 칸으로
시작한다. 테스트 발송 실패는 서버가 준 원인을 그대로 보여준다."
```

---

### Task 11: 회원 개인 수신 설정

**Files:**
- Create: `migrations/0037_mail_opt_in.sql` (번호 확인)
- Create: `app/api/account/notifications/route.ts`
- Modify: 회원 대시보드 또는 계정 화면에 스위치 추가

**Interfaces:**
- Produces: `PUT /api/account/notifications` — body `{ emailOptIn: boolean }`

- [ ] **Step 1: 마이그레이션**

`migrations/0037_mail_opt_in.sql`:

```sql
-- 0037: 회원 이메일 수신 설정 (MySQL)
--
-- 기본값 1 — 기존 회원 전원이 받는 상태로 시작한다.
-- essential 이벤트(가입 확인·임시 비밀번호)는 이 값을 보지 않는다.
--
-- 적용: node scripts/mysqlMigrate.mjs migrations/0037_mail_opt_in.sql

ALTER TABLE users ADD COLUMN email_opt_in TINYINT(1) NOT NULL DEFAULT 1;
```

- [ ] **Step 2: 적용**

Run: `node scripts/mysqlMigrate.mjs migrations/0037_mail_opt_in.sql`

> MySQL은 dev/prod 공유 원격이다 — 적용하면 운영에도 즉시 반영된다.

- [ ] **Step 3: API**

`app/api/account/notifications/route.ts`:

```ts
/**
 * 회원 이메일 수신 설정 — GET/PUT
 *
 * 스위치 하나. 끄면 일반 알림이 오지 않지만, 가입 확인·임시 비밀번호처럼
 * 못 받으면 계정을 못 쓰는 메일은 계속 나간다.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
  }
  const rows = await query<{ email_opt_in: 0 | 1 }[]>(
    'SELECT email_opt_in FROM users WHERE id = ?',
    [session.user.id]
  );
  return NextResponse.json({
    success: true,
    emailOptIn: (rows[0]?.email_opt_in ?? 1) !== 0,
  });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { emailOptIn?: unknown };
  if (typeof body.emailOptIn !== 'boolean') {
    return NextResponse.json({ success: false, error: '잘못된 요청입니다.' }, { status: 400 });
  }
  await query('UPDATE users SET email_opt_in = ? WHERE id = ?', [
    body.emailOptIn ? 1 : 0,
    session.user.id,
  ]);
  return NextResponse.json({ success: true, emailOptIn: body.emailOptIn });
}
```

- [ ] **Step 4: 화면 스위치**

회원 대시보드(`app/admin/page.tsx`)의 알림 온보딩 카드 근처, 또는 프로필 화면
(`/admin/profile`)에 토글 하나를 추가한다. 문구:

- 라벨: `이메일 알림 받기`
- 설명: `수업 등록·공연 안내 같은 알림을 이메일로 받습니다. 꺼도 가입 확인과 비밀번호 안내는 계속 발송됩니다.`
- 키코드: `admin.mail.optIn.label` / `admin.mail.optIn.help` (ko/en 양쪽)

기존 카드 컴포넌트 패턴을 따르고, 두 테마 확인.

- [ ] **Step 5: 커밋**

```bash
git add migrations/0037_mail_opt_in.sql app/api/account/notifications/ app/admin/
git commit -m "feat(mail): 회원 이메일 수신 스위치

원장이 켠 알림이라도 회원이 스스로 끌 수 있게 한다(과하다는 민원과
스팸 신고를 동시에 막는 최소선). 가입 확인·임시 비밀번호처럼 못 받으면
계정을 못 쓰는 메일은 이 값을 보지 않는다."
```

---

### Task 12: 기존 발송 지점 이관

**Files:**
- Modify: `app/api/feedback/route.ts`
- Modify: `app/api/applications/route.ts`
- Modify: `app/api/cron/event-reminders/route.ts`
- Delete: `lib/mail.ts`

- [ ] **Step 1: 문의 라우트 이관**

`app/api/feedback/route.ts`에서 `nodemailer` import와 transporter 생성 블록
(약 75~100행)을 제거하고, 저장 성공 직후에:

```ts
import { notifyEventAfterResponse } from '@/lib/mail/notify';

// …DB 저장 성공 후
notifyEventAfterResponse('feedback.created', {
  directEmails: email ? [email] : [],
  replyTo: email || undefined,
  data: { name, email, phone, message },
});
```

기존의 "메일 실패해도 접수는 성공" 처리를 유지한다. 응답에서 메일 성공 여부를
쓰던 필드가 있으면 제거하거나 `true`로 고정한다(발송이 응답 이후로 옮겨졌다).

- [ ] **Step 2: 공연 신청 라우트 이관**

`app/api/applications/route.ts`에서 같은 방식으로:

```ts
notifyEventAfterResponse('application.created', {
  directEmails: applicantEmail ? [applicantEmail] : [],
  replyTo: applicantEmail || undefined,
  data: {
    name: applicantName,
    email: applicantEmail,
    phone: applicantPhone,
    title: eventTitle,
  },
});
```

변수명은 해당 파일의 실제 이름에 맞춘다.

- [ ] **Step 3: cron 리마인더 이관**

`app/api/cron/event-reminders/route.ts`:
- `import { sendMail, isMailConfigured } from '@/lib/mail'` 제거
- BCC 수집 로직(`emails` Set 구성)을 제거하고 `notifyEvent`에 위임 —
  `getEventCheckins`로 얻은 `studentIds`를 `userIds`로 넘기면 보호자는
  `notifyEvent`가 붙인다

```ts
import { notifyEvent } from '@/lib/mail/notify';

// 이벤트 루프 안에서 — cron은 after()를 쓰지 않는다(응답 후 종료되면 발송이 잘린다)
await notifyEvent('event.reminder', {
  userIds: studentIds,
  data: {
    title: event.title_ko,
    when: formatWhen(event),   // 기존 buildBody가 쓰던 값 활용
    where: event.location ?? '',
  },
});
results.push({ eventId: event.id, title: event.title_ko, recipients: studentIds.length, sent: true });
```

응답의 `mailConfigured` 필드는 제거한다(설정은 이제 화면에서 본다).

- [ ] **Step 4: 옛 모듈 삭제**

```bash
git rm lib/mail.ts
```

- [ ] **Step 5: 검증**

```bash
npx tsc --noEmit
npm run lint
grep -rn "from '@/lib/mail'" --include=*.ts --include=*.tsx app/ lib/
```
마지막 grep은 **결과가 없어야** 한다(`@/lib/mail/...` 하위 경로는 별개).

- [ ] **Step 6: 커밋**

```bash
git add -A app/api lib
git commit -m "refactor(mail): 흩어진 발송 코드 3곳을 공용 모듈로 이관

feedback·applications는 각자 nodemailer transport를 만들고 있었고,
cron은 지메일 앱 비밀번호에 묶여 있었다(만료되면 조용히 죽는다).
셋 다 notifyEvent 한 줄로 바꾸고 lib/mail.ts를 걷어낸다.
cron은 after()를 쓰지 않는다 — 응답 후 종료되면 발송이 잘린다."
```

---

### Task 13: 새 이벤트 연결

**Files:**
- Modify: `app/api/register/route.ts` (`member.signup`)
- Modify: 가입 승인 처리 라우트 (`member.approved`)
- Modify: 임시 비밀번호 발급 라우트 (`member.temp_password`)
- Modify: 수업 배정 라우트 (`enrollment.created`)
- Modify: `app/api/library/checkins/**` (`checkin.created`)
- Modify: 신청서 제출 라우트 (`form.submitted`)

- [ ] **Step 1: 연결 지점 확인**

```bash
grep -rn "setTempPassword" --include=*.ts app/api | head
grep -rn "status = 'active'\|approved_at" --include=*.ts app/api | head
ls app/api/library/checkins app/api/forms
```
각 라우트에서 **본작업이 성공한 직후** 지점을 찾는다.

- [ ] **Step 2: 회원가입**

`app/api/register/route.ts`에서 사용자 생성 성공 직후:

```ts
import { notifyEventAfterResponse } from '@/lib/mail/notify';

notifyEventAfterResponse('member.signup', {
  userIds: [newUserId],
  data: { name, email, phone: phone ?? '' },
});
```

- [ ] **Step 3: 가입 승인**

승인 처리(`status`를 `active`로 바꾸는 곳) 직후:

```ts
notifyEventAfterResponse('member.approved', {
  userIds: [targetUserId],
  data: { name: targetName, url: `${process.env.AUTH_URL ?? ''}/admin` },
});
```

- [ ] **Step 4: 임시 비밀번호**

`setTempPassword(...)` 호출 직후, **평문 임시 비밀번호가 아직 메모리에 있는 자리**에서:

```ts
notifyEventAfterResponse('member.temp_password', {
  userIds: [targetUserId],
  data: { name: targetName, tempPassword: plainTempPassword },
});
```

> 이 이벤트는 `redactBody: true`라 발송 내역에 본문이 저장되지 않는다.
> 로그에 평문 비밀번호가 쌓이지 않는지 Task 13 검증에서 확인한다.

- [ ] **Step 5: 수업 등록 · 체크인 · 신청서**

각 라우트의 성공 직후에 같은 형식으로:

```ts
notifyEventAfterResponse('enrollment.created', {
  userIds: [studentId],
  data: { name: studentName, title: programTitle, schedule: scheduleText ?? '' },
});

notifyEventAfterResponse('checkin.created', {
  userIds: [userId],
  data: { name: userName, title: eventTitle, when: eventWhen ?? '', where: eventWhere ?? '' },
});

notifyEventAfterResponse('form.submitted', {
  userIds: submitterUserId ? [submitterUserId] : [],
  directEmails: submitterEmail ? [submitterEmail] : [],
  data: { name: submitterName, title: formTitle },
});
```

변수명은 각 파일의 실제 이름에 맞춘다.

- [ ] **Step 6: 통합 검증**

`/admin/mail`에서 설정을 마치고(테스트 발송 성공 확인) 아래를 실제로 해본다:

1. 회원가입 → 본인 + 운영진 주소에 도착
2. 이벤트 탭에서 `수업 등록 · 회원`을 끄고 수업 배정 → 회원에게 안 오고, 내역에 `건너뜀 · switch-off`
3. 회원 화면에서 이메일 수신 끄기 → 일반 알림 안 옴 / 임시 비밀번호는 옴
4. 임시 비밀번호 발급 → 메일 도착, **내역 상세에 본문이 없음**
5. 내역 탭에서 주소로 검색 → 해당 행이 나옴
6. 게이지 숫자가 실제 발송 건수와 일치

- [ ] **Step 7: 전체 테스트 + 커밋**

```bash
npm test
npm run lint
npm run lint:theme
npx tsc --noEmit
```

```bash
git add -A app/api
git commit -m "feat(mail): 가입·승인·임시비번·수업등록·체크인·신청서 알림 연결

임시 비밀번호는 지금까지 발급 후 전달 수단이 없어 구두로 알려주고 있었다 —
이제 메일로 나간다. 본문에 평문이 실리므로 발송 내역에는 남기지 않는다."
```

---

## Self-Review

**Spec coverage** — 설계 문서의 각 절을 태스크에 대응시킨 결과:

| 스펙 절 | 태스크 |
|---|---|
| §1 이관 대상 3곳 | Task 12 |
| §2 확정 결정 4가지 | Task 1(채널 축·레지스트리), Task 7(본문 고정), Task 2(staffTo), Task 11(옵트아웃) |
| §3 아키텍처·파일 구조 | Task 1~8 |
| §4 이벤트 레지스트리·redactBody | Task 1, Task 13 Step 4 |
| §5 설정 스키마·시크릿 규칙 | Task 2, Task 9 |
| §6 수신자 3중 관문·보호자 정의 | Task 4, Task 8 `collectUserCandidates` |
| §7 로그·사용량·한도·단체 발송 | Task 5, Task 6, Task 8 |
| §8 오류 처리·after() | Task 3(throw 안 함), Task 8(after / cron 예외) |
| §9 관리 화면 4탭 | Task 10 |
| §10 회원 화면 | Task 11 |
| §11 도메인·DNS | 코드 작업 아님 — 운영 준비물. Task 10의 `from` placeholder 안내로 반영 |
| §12 테스트 | Task 2·4·5의 테스트 파일 |
| §13 범위 밖 | 계획에 없음(의도적) |
| §14 구현 주의 | Global Constraints + Task 6·11의 번호 확인 스텝 |

**Placeholder scan** — "TBD"·"적절히 처리"·"테스트 작성" 같은 표현 없음. Task 10의
화면은 코드 대신 동작 요구사항 목록으로 명세했다(생김새는 기존 콘솔 화면을 따르므로
스타일을 통째로 지정하는 것이 오히려 어긋난다). Task 12·13은 기존 파일의 실제 변수명이
파일마다 다르므로 삽입 위치와 코드 형태를 주고 "실제 이름에 맞춘다"를 명시했다.

**Type consistency** — 이름을 태스크 간 대조한 결과:
- `MailConfig`·`MailAudience`·`MailEventSwitches`·`MailLogStatus` — Task 1 정의, Task 2·3·4·6·8에서 동일 사용
- `resolveMailConfig`/`sendMail` — Task 3 정의, Task 8·9에서 동일 시그니처
- `resolveRecipients({ def, audience, switches, candidates, staffTo })` — Task 4 정의, Task 8 호출 일치
- `decideQuota(usage, limits, recipientCount, essential)` — Task 5 정의, Task 8 호출 일치
- `insertMailLogs(rows)`·`getUsageCounts(timeZone)`·`wasEventSentToday(key, tz)` — Task 6 정의, Task 8 호출 일치
- `renderMailBody(eventKey, audience, data)` — Task 7 정의, Task 8 호출 일치
- `isEssential(def, audience)` — Task 1 정의, Task 4·8 사용
