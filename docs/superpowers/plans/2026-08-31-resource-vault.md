# 공연 자료함 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 운영진이 공연 음원을 미리 올려 두고, 현장에서 `ktdoc.org/473128` + 숫자 비밀번호로 재생·다운로드·메일 전달할 수 있게 한다.

**Architecture:** 순수 판정 모듈(번호·비밀번호·토큰·차단·게이트)을 먼저 쌓고 시험으로 잠근 뒤, D1·R2·라우트·화면을 그 위에 얹는다. **R2 키는 클라이언트로 절대 나가지 않고** 재생·다운로드는 우리 라우트가 Range 중계한다.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · node:test · Plain CSS · D1(콘텐츠) · R2(파일) · bcryptjs 불사용(§비밀번호는 가역 암호)

**Spec:** `docs/superpowers/specs/2026-08-31-resource-vault-design.md`

## Global Constraints

- **R2 키(`r2_key`)가 API 응답·HTML·클라이언트 번들에 실리는 자리가 하나도 없어야 한다.** 버킷이 공개(`pub-….r2.dev`)라 키 = 영구 접근이다.
- **presigned GET을 쓰지 않는다.** 서명 주소 안에 키가 들어 있어 만료가 무의미해진다.
- 파일 상한 **100MB**, 허용 형식 **`audio/` · `image/` · `application/pdf`**.
- 번호는 **`/^[1-9]\d{5}$/`** (6자리, 앞자리 0 없음). 비밀번호는 **`/^\d{4,8}$/`**.
- 관리 메뉴 키는 **`resources`**, 그룹 **`show`**, `defaultRoles: ['admin']`.
- **API 라우트 첫 줄의 권한 판정 = 페이지의 판정 = 업로드 타겟의 판정** (전부 `isAdmin(session)`).
- 새 문구는 전부 `t('키', '한국어 기본값')` 폴백 + `locale/ko.json`·`en.json` **양쪽에** 추가.
- 공개 화면 CSS는 공개 사이트 테마 규칙(역할 토큰, 리터럴 금지, 두 테마 확인). `app/globals.css` **파일 끝에 한 덩어리로** 추가.
- 완료 전 `npm test` · `npx tsc --noEmit` · `npm run lint:theme` · `npm run lint:i18n` 전부 통과.
- 커밋은 각 Task 끝에서. **푸시·머지·배포는 하지 않는다.**

### 스펙에서 바뀐 이름 하나

스펙의 `lib/resources/accessToken.ts`는 **`lib/resources/tokens.ts`** 로 만든다. 잠금 쿠키 서명·받기 링크 토큰·IP 해시가 모두 같은 HMAC 관용구라 한 모듈에 두는 편이 응집도가 높다. 파일 하나, 시험 하나.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `types/resources.ts` | 도메인 타입(Vault·Item·AccessLog). 클라이언트도 import 한다 |
| `lib/resources/code.ts` | 번호 형식·생성 |
| `lib/resources/passcode.ts` | 비밀번호 형식·생성·AES-GCM 암복호·대조 |
| `lib/resources/tokens.ts` | 잠금 쿠키 서명/검증 · 받기 링크 토큰 · IP 해시 |
| `lib/resources/rateLimit.ts` | 무차별 대입 차단 판정 |
| `lib/resources/gate.ts` | **"이 요청이 이 자료함을 열어도 되는가"의 단일 판정자** |
| `lib/resources/stream.ts` | R2 Range 중계 (server-only) |
| `lib/d1/resources.ts` | D1 조회·저장 |
| `migrations/0042_resources.sql` | 표 3개 |
| `app/[code]/page.tsx` | 공개 진입 — 번호 해석·게이트·화면 분기 |
| `components/resources/ResourceLockScreen.tsx` | 숫자 키패드 |
| `components/resources/ResourceVaultView.tsx` | 목록·재생·다운로드·메일 |
| `app/api/resources/[code]/unlock/route.ts` | 비밀번호 대조 → 쿠키 |
| `app/api/resources/[code]/items/[itemId]/file/route.ts` | 재생·다운로드 중계(`?dl=1`이면 attachment) |
| `app/api/resources/[code]/email/route.ts` | 받기 링크 발송 |
| `app/admin/resources/page.tsx` | 목록 |
| `app/admin/resources/[id]/page.tsx` | 상세 |
| `components/admin/resources/VaultList.tsx` | 목록·새로 만들기 |
| `components/admin/resources/VaultDetail.tsx` | 상세 전체(설정·파일·기록) |
| `app/api/admin/resources/route.ts` | GET 목록 / POST 생성 |
| `app/api/admin/resources/[id]/route.ts` | GET 상세 / PATCH 수정 / DELETE |
| `app/api/admin/resources/[id]/items/route.ts` | POST 업로드 마무리 / PATCH 순서 |
| `app/api/admin/resources/[id]/items/[itemId]/route.ts` | PATCH 이름 / DELETE |

**재생과 다운로드를 라우트 하나(`file`)로 합친 이유**: 게이트 판정·Range 처리가 완전히 같고 다른 것은 `Content-Disposition` 한 줄뿐이다. 두 라우트로 나누면 같은 판정이 두 벌이 된다.

---

## Task 1: 번호 (`lib/resources/code.ts`)

**Files:**
- Create: `lib/resources/code.ts`
- Test: `lib/resources/code.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `RESOURCE_CODE_LENGTH: 6` · `isValidResourceCode(v: string): boolean` · `generateResourceCode(pick?: () => number): string`

- [ ] **Step 1: 실패하는 시험을 쓴다**

`lib/resources/code.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RESOURCE_CODE_LENGTH,
  generateResourceCode,
  isValidResourceCode,
} from './code.ts';

test('여섯 자리 숫자만 번호다', () => {
  assert.equal(isValidResourceCode('473128'), true);
  assert.equal(isValidResourceCode('100000'), true);
  assert.equal(isValidResourceCode('999999'), true);
});

test('앞자리 0은 번호가 아니다 — 전화로 불러 줄 때 사라진다', () => {
  assert.equal(isValidResourceCode('047312'), false);
  assert.equal(isValidResourceCode('000000'), false);
});

test('길이가 다르거나 숫자가 아니면 번호가 아니다', () => {
  for (const bad of ['4731', '4731289', '', '47a128', '47 128', '473128 ', ' 473128', '-47312']) {
    assert.equal(isValidResourceCode(bad), false, `${JSON.stringify(bad)}은 번호가 아니어야 한다`);
  }
});

test('문자열이 아닌 것을 받아도 던지지 않는다 — 주소에서 무엇이든 올 수 있다', () => {
  assert.equal(isValidResourceCode(undefined as unknown as string), false);
  assert.equal(isValidResourceCode(null as unknown as string), false);
  assert.equal(isValidResourceCode(473128 as unknown as string), false);
});

test('생성한 번호는 언제나 스스로의 검증을 통과한다', () => {
  for (let i = 0; i < 500; i++) {
    assert.equal(isValidResourceCode(generateResourceCode()), true);
  }
});

test('경계값 — 뽑기 함수가 하한·상한을 주면 그대로 나온다', () => {
  assert.equal(generateResourceCode(() => 100000), '100000');
  assert.equal(generateResourceCode(() => 999999), '999999');
});

test('길이 상수는 실제 길이와 같다', () => {
  assert.equal(generateResourceCode().length, RESOURCE_CODE_LENGTH);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test lib/resources/code.test.ts`
Expected: FAIL — `Cannot find module './code.ts'`

- [ ] **Step 3: 최소 구현**

`lib/resources/code.ts`:

```ts
/**
 * 자료함 번호 — 사람이 전화로 불러 주고, 주소창에 치는 여섯 자리 (순수 함수)
 *
 * 앞자리 0을 뺀 이유는 실용이다. "공사칠일이팔"을 받아 적는 사람은 앞의 0을
 * 흘리고, 스프레드시트에 붙이면 0이 사라진다. 90만 가지에서 10만 가지를
 * 버리는 대신 **불러 준 대로 쳐도 맞는** 번호가 된다.
 *
 * 번호 자체는 비밀이 아니다 — 여섯 자리는 봇이 몇 시간이면 다 훑는다.
 * 보호는 비밀번호(lib/resources/passcode.ts)와 차단(lib/resources/rateLimit.ts)이
 * 맡는다. 이 파일은 "형태가 번호인가"만 본다.
 */

import { randomInt } from 'node:crypto';

export const RESOURCE_CODE_LENGTH = 6;

const CODE_RE = /^[1-9]\d{5}$/;

/** 주소에서 온 값이 번호 형태인가. 무엇이 와도 던지지 않는다. */
export function isValidResourceCode(value: string): boolean {
  return typeof value === 'string' && CODE_RE.test(value);
}

/**
 * 새 번호 하나. 중복 회피는 부르는 쪽(D1)이 한다 — 이 파일은 D1을 모른다.
 * `pick`을 주입받는 이유는 시험이 경계값을 고정할 수 있어야 해서다.
 */
export function generateResourceCode(pick: () => number = () => randomInt(100000, 1000000)): string {
  return String(pick());
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `node --test lib/resources/code.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/resources/code.ts lib/resources/code.test.ts
git commit -m "feat(resources): 자료함 번호는 앞자리 0을 쓰지 않는다 — 불러 준 대로 쳐도 맞게"
```

---

## Task 2: 비밀번호 (`lib/resources/passcode.ts`)

**Files:**
- Create: `lib/resources/passcode.ts`
- Test: `lib/resources/passcode.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `PASSCODE_MIN: 4` · `PASSCODE_MAX: 8` · `isValidPasscode(v: string): boolean` · `generatePasscode(length?: number, pick?: (max: number) => number): string` · `encryptPasscode(plain: string, secret: string): string` · `decryptPasscode(enc: string, secret: string): string | null` · `passcodeMatches(enc: string, input: string, secret: string): boolean`

- [ ] **Step 1: 실패하는 시험을 쓴다**

`lib/resources/passcode.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PASSCODE_MAX,
  PASSCODE_MIN,
  decryptPasscode,
  encryptPasscode,
  generatePasscode,
  isValidPasscode,
  passcodeMatches,
} from './passcode.ts';

const SECRET = 'test-secret-abcdefghijklmnopqrstuvwxyz';

test('네 자리에서 여덟 자리 숫자만 비밀번호다', () => {
  assert.equal(isValidPasscode('1234'), true);
  assert.equal(isValidPasscode('12345678'), true);
  assert.equal(isValidPasscode('0000'), true, '비밀번호는 앞자리 0을 허용한다 — 주소가 아니라 입력이다');
  assert.equal(isValidPasscode('123'), false);
  assert.equal(isValidPasscode('123456789'), false);
  assert.equal(isValidPasscode('12a4'), false);
  assert.equal(isValidPasscode(''), false);
  assert.equal(isValidPasscode(undefined as unknown as string), false);
});

test('상수와 실제 경계가 어긋나지 않는다', () => {
  assert.equal(isValidPasscode('9'.repeat(PASSCODE_MIN)), true);
  assert.equal(isValidPasscode('9'.repeat(PASSCODE_MAX)), true);
  assert.equal(isValidPasscode('9'.repeat(PASSCODE_MIN - 1)), false);
  assert.equal(isValidPasscode('9'.repeat(PASSCODE_MAX + 1)), false);
});

test('생성한 비밀번호는 스스로의 검증을 통과한다', () => {
  for (let i = 0; i < 200; i++) {
    assert.equal(isValidPasscode(generatePasscode()), true);
  }
  assert.equal(generatePasscode().length, 6, '기본 길이는 여섯 자리');
  assert.equal(generatePasscode(4).length, 4);
  assert.equal(generatePasscode(8).length, 8);
});

test('암호화한 것을 다시 읽을 수 있다 — 원장이 번호를 다시 확인해야 한다', () => {
  const enc = encryptPasscode('473128', SECRET);
  assert.equal(decryptPasscode(enc, SECRET), '473128');
});

test('같은 비밀번호라도 암호문은 매번 다르다 — 같은 값을 쓴 자료함이 드러나면 안 된다', () => {
  const a = encryptPasscode('1234', SECRET);
  const b = encryptPasscode('1234', SECRET);
  assert.notEqual(a, b);
  assert.equal(decryptPasscode(a, SECRET), '1234');
  assert.equal(decryptPasscode(b, SECRET), '1234');
});

test('다른 열쇠로는 읽히지 않는다 — 던지지 않고 null', () => {
  const enc = encryptPasscode('1234', SECRET);
  assert.equal(decryptPasscode(enc, 'another-secret-value-here-0000000'), null);
});

test('변조된 암호문은 null — GCM 태그가 잡는다', () => {
  const enc = encryptPasscode('1234', SECRET);
  const parts = enc.split('.');
  const flipped = Buffer.from(parts[3], 'base64url');
  flipped[0] ^= 0xff;
  parts[3] = flipped.toString('base64url');
  assert.equal(decryptPasscode(parts.join('.'), SECRET), null);
});

test('망가진 모양은 전부 null이고 던지지 않는다', () => {
  for (const bad of ['', 'x', 'v1.a.b', 'v9.a.b.c', 'v1...', undefined as unknown as string]) {
    assert.equal(decryptPasscode(bad, SECRET), null);
  }
});

test('대조는 맞을 때만 참이다', () => {
  const enc = encryptPasscode('473128', SECRET);
  assert.equal(passcodeMatches(enc, '473128', SECRET), true);
  assert.equal(passcodeMatches(enc, '473129', SECRET), false);
  assert.equal(passcodeMatches(enc, '', SECRET), false);
  assert.equal(passcodeMatches('망가진값', '473128', SECRET), false);
});

test('길이가 다른 입력에도 대조가 던지지 않는다 — timingSafeEqual 함정', () => {
  const enc = encryptPasscode('1234', SECRET);
  assert.equal(passcodeMatches(enc, '12345678', SECRET), false);
  assert.equal(passcodeMatches(enc, '1', SECRET), false);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test lib/resources/passcode.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 최소 구현**

`lib/resources/passcode.ts`:

```ts
/**
 * 자료함 비밀번호 — 해시가 아니라 **가역 암호**로 둔다 (순수 함수)
 *
 * 정석은 bcrypt 해시다. 여기서 벗어나는 이유:
 *
 * 이건 계정 암호가 아니라 **남에게 알려주려고 만든 출입 번호**다. 원장이
 * 나중에 "그 자료함 번호 뭐였지"를 다시 확인하는 것이 정상 업무다. 해시로
 * 두면 잊을 때마다 재설정해야 하고, 그 순간 **이미 알려준 현장 담당자가 전부
 * 막힌다.** 공연 당일에 그 일이 벌어지면 시스템째로 버려진다.
 *
 * 그리고 여기서는 해시가 지키는 것이 실제로 없다. D1이 유출되는 시나리오에서는
 * `resource_items.r2_key`가 함께 나가고, 우리 버킷은 공개라 그 키만으로 파일을
 * 받을 수 있다. 비밀번호만 해시로 지켜 봐야 지킬 것이 남지 않는다.
 *
 * 대신 화면이 "계정 비밀번호와 다른 번호를 쓰세요"를 말하고, 생성 버튼을
 * 직접 입력보다 앞에 둔다.
 *
 * 형식: `v1.<iv>.<tag>.<ciphertext>` (전부 base64url)
 */

import { createDecipheriv, createCipheriv, hkdfSync, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const PASSCODE_MIN = 4;
export const PASSCODE_MAX = 8;

const PASSCODE_RE = new RegExp(`^\\d{${PASSCODE_MIN},${PASSCODE_MAX}}$`);
const VERSION = 'v1';
const IV_BYTES = 12;

/** 숫자 네 자리에서 여덟 자리. 앞자리 0을 허용한다 — 주소가 아니라 입력이다. */
export function isValidPasscode(value: string): boolean {
  return typeof value === 'string' && PASSCODE_RE.test(value);
}

/** 무작위 비밀번호. 화면의 '생성' 버튼이 쓴다. */
export function generatePasscode(
  length = 6,
  pick: (maxExclusive: number) => number = (max) => randomInt(0, max)
): string {
  let out = '';
  for (let i = 0; i < length; i++) out += String(pick(10));
  return out;
}

/**
 * AUTH_SECRET에서 이 용도만의 열쇠를 뽑는다.
 * 다른 용도(업로드 티켓·잠금 쿠키)와 같은 비밀을 쓰지만 **열쇠는 갈라 둔다** —
 * 한 곳의 서명값이 다른 곳에서 그대로 통하면 안 된다.
 */
function keyFrom(secret: string): Buffer {
  return Buffer.from(hkdfSync('sha256', secret, 'ktdoc-resource-passcode', 'aes-256-gcm', 32));
}

export function encryptPasscode(plain: string, secret: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(secret), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join('.');
}

/**
 * 읽어 낸다. 읽히지 않으면 **null이고 던지지 않는다** — AUTH_SECRET이 바뀐
 * 배포에서 관리 화면 전체가 500으로 죽으면 안 된다. 화면은 null을 받아
 * "다시 설정해 주세요"로 드러낸다.
 */
export function decryptPasscode(enc: string, secret: string): string | null {
  if (typeof enc !== 'string') return null;
  const parts = enc.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  const [, ivB64, tagB64, ctB64] = parts;
  if (!ivB64 || !tagB64 || !ctB64) return null;

  try {
    const decipher = createDecipheriv('aes-256-gcm', keyFrom(secret), Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    const out = Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64url')), decipher.final()]);
    return out.toString('utf8');
  } catch {
    // 태그 불일치(변조·다른 열쇠)도 여기로 온다 — 구분해서 알려 줄 이유가 없다
    return null;
  }
}

/** 입력이 저장된 비밀번호와 같은가. 길이가 달라도 던지지 않는다. */
export function passcodeMatches(enc: string, input: string, secret: string): boolean {
  const actual = decryptPasscode(enc, secret);
  if (actual === null || typeof input !== 'string') return false;
  const a = Buffer.from(actual, 'utf8');
  const b = Buffer.from(input, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `node --test lib/resources/passcode.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/resources/passcode.ts lib/resources/passcode.test.ts
git commit -m "feat(resources): 자료함 비밀번호는 해시가 아니라 다시 읽을 수 있게 — 잊으면 알려준 사람이 다 막힌다"
```

---

## Task 3: 잠금 쿠키·받기 링크·IP 해시 (`lib/resources/tokens.ts`)

**Files:**
- Create: `lib/resources/tokens.ts`
- Test: `lib/resources/tokens.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `UNLOCK_TTL_MS: number` (6시간) · `LINK_TTL_MS: number` (24시간)
  - `unlockCookieName(vaultId: number): string`
  - `signUnlockCookie(vaultId: number, secret: string, now?: number): string`
  - `verifyUnlockCookie(token: string, vaultId: number, secret: string, now?: number): { vaultId: number; exp: number } | null`
  - `signLinkToken(vaultId: number, epoch: number, secret: string, now?: number): string`
  - `verifyLinkToken(token: string, secret: string, now?: number): { vaultId: number; epoch: number; exp: number } | null`
  - `hashIp(ip: string | null, secret: string): string | null`

- [ ] **Step 1: 실패하는 시험을 쓴다**

`lib/resources/tokens.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LINK_TTL_MS,
  UNLOCK_TTL_MS,
  hashIp,
  signLinkToken,
  signUnlockCookie,
  unlockCookieName,
  verifyLinkToken,
  verifyUnlockCookie,
} from './tokens.ts';

const SECRET = 'test-secret-abcdefghijklmnopqrstuvwxyz';
const T0 = 1_700_000_000_000;

test('쿠키 이름은 자료함마다 다르다 — 하나를 풀어도 옆 자료함은 잠겨 있다', () => {
  assert.equal(unlockCookieName(12), 'rv_12');
  assert.notEqual(unlockCookieName(12), unlockCookieName(13));
});

test('서명한 쿠키는 같은 자료함에서 열린다', () => {
  const token = signUnlockCookie(12, SECRET, T0);
  const claims = verifyUnlockCookie(token, 12, SECRET, T0 + 1000);
  assert.equal(claims?.vaultId, 12);
  assert.equal(claims?.exp, T0 + UNLOCK_TTL_MS);
});

test('다른 자료함의 쿠키로는 열리지 않는다 — 값을 옮겨 붙여도', () => {
  const token = signUnlockCookie(12, SECRET, T0);
  assert.equal(verifyUnlockCookie(token, 13, SECRET, T0 + 1000), null);
});

test('만료된 쿠키는 열리지 않는다 (경계 포함)', () => {
  const token = signUnlockCookie(12, SECRET, T0);
  assert.notEqual(verifyUnlockCookie(token, 12, SECRET, T0 + UNLOCK_TTL_MS - 1), null);
  assert.equal(verifyUnlockCookie(token, 12, SECRET, T0 + UNLOCK_TTL_MS + 1), null);
});

test('서명이 다르면 열리지 않는다', () => {
  const token = signUnlockCookie(12, SECRET, T0);
  assert.equal(verifyUnlockCookie(token, 12, 'other-secret-aaaaaaaaaaaaaaaaaaaa', T0), null);
});

test('본문을 고치면 서명이 깨진다', () => {
  const token = signUnlockCookie(12, SECRET, T0);
  const [payload, sig] = token.split('.');
  const tampered = Buffer.from(
    JSON.stringify({ vaultId: 13, exp: T0 + UNLOCK_TTL_MS }),
    'utf8'
  ).toString('base64url');
  assert.equal(verifyUnlockCookie(`${tampered}.${sig}`, 13, SECRET, T0), null);
  assert.notEqual(payload, tampered);
});

test('망가진 모양은 전부 null이고 던지지 않는다', () => {
  for (const bad of ['', 'x', 'a.b.c', '.', undefined as unknown as string]) {
    assert.equal(verifyUnlockCookie(bad, 12, SECRET, T0), null);
    assert.equal(verifyLinkToken(bad, SECRET, T0), null);
  }
});

test('받기 링크 토큰은 자료함과 세대(epoch)를 함께 담는다', () => {
  const token = signLinkToken(7, 3, SECRET, T0);
  const claims = verifyLinkToken(token, SECRET, T0 + 1000);
  assert.equal(claims?.vaultId, 7);
  assert.equal(claims?.epoch, 3);
  assert.equal(claims?.exp, T0 + LINK_TTL_MS);
});

test('받기 링크는 24시간 뒤 죽는다', () => {
  const token = signLinkToken(7, 3, SECRET, T0);
  assert.notEqual(verifyLinkToken(token, SECRET, T0 + LINK_TTL_MS - 1), null);
  assert.equal(verifyLinkToken(token, SECRET, T0 + LINK_TTL_MS + 1), null);
});

test('IP 해시는 같은 주소에 같은 값, 다른 주소에 다른 값', () => {
  assert.equal(hashIp('203.0.113.9', SECRET), hashIp('203.0.113.9', SECRET));
  assert.notEqual(hashIp('203.0.113.9', SECRET), hashIp('203.0.113.10', SECRET));
});

test('IP 해시에 원문이 남지 않는다', () => {
  const h = hashIp('203.0.113.9', SECRET);
  assert.equal(typeof h, 'string');
  assert.ok(!h!.includes('203.0.113.9'));
});

test('IP를 모르면 null — 없는 값을 지어내지 않는다', () => {
  assert.equal(hashIp(null, SECRET), null);
  assert.equal(hashIp('', SECRET), null);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test lib/resources/tokens.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 최소 구현**

`lib/resources/tokens.ts`:

```ts
/**
 * 자료함의 서명들 — 잠금 쿠키 · 받기 링크 · IP 해시 (순수 함수)
 *
 * 셋 다 같은 관용구(HMAC-SHA256 over base64url JSON)라 한 곳에 둔다.
 * lib/r2/uploadTicket.ts와 같은 모양이고, 같은 이유로 저장소를 두지 않는다 —
 * 서명 자체가 근거다. 자료함을 열 때마다 D1에 세션 행을 쓰고 청소하는 일을
 * 만들지 않는다.
 *
 * 세 용도의 **열쇠를 갈라 둔다**(HKDF info). 잠금 쿠키 값을 받기 링크 자리에
 * 붙여 넣어도 통하지 않아야 한다.
 */

import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';

/** 한 번 풀면 6시간. 공연 한 판을 덮고, 밤새 열려 있지는 않다. */
export const UNLOCK_TTL_MS = 6 * 60 * 60 * 1000;

/** 메일로 보낸 받기 링크는 하루. 현장 담당자가 당일에 쓰는 물건이다. */
export const LINK_TTL_MS = 24 * 60 * 60 * 1000;

type Purpose = 'unlock' | 'link';

function keyFor(secret: string, purpose: Purpose): Buffer {
  return Buffer.from(hkdfSync('sha256', secret, 'ktdoc-resource', purpose, 32));
}

function sign(payload: string, secret: string, purpose: Purpose): string {
  return createHmac('sha256', keyFor(secret, purpose)).update(payload).digest('base64url');
}

function pack(claims: object, secret: string, purpose: Purpose): string {
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  return `${payload}.${sign(payload, secret, purpose)}`;
}

function unpack<T>(token: string, secret: string, purpose: Purpose): T | null {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const [payload, signature] = parts;
  const a = Buffer.from(signature);
  const b = Buffer.from(sign(payload, secret, purpose));
  // 길이가 다르면 timingSafeEqual이 던진다 — 길이 비교를 먼저(둘 다 '틀림'이다)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

/** 자료함마다 다른 쿠키 이름 — 하나를 풀어도 옆 자료함은 잠겨 있다. */
export function unlockCookieName(vaultId: number): string {
  return `rv_${vaultId}`;
}

export function signUnlockCookie(vaultId: number, secret: string, now = Date.now()): string {
  return pack({ vaultId, exp: now + UNLOCK_TTL_MS }, secret, 'unlock');
}

export function verifyUnlockCookie(
  token: string,
  vaultId: number,
  secret: string,
  now = Date.now()
): { vaultId: number; exp: number } | null {
  const claims = unpack<{ vaultId?: unknown; exp?: unknown }>(token, secret, 'unlock');
  if (!claims) return null;
  if (claims.vaultId !== vaultId) return null;
  if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) || claims.exp < now) return null;
  return { vaultId, exp: claims.exp };
}

export function signLinkToken(
  vaultId: number,
  epoch: number,
  secret: string,
  now = Date.now()
): string {
  return pack({ vaultId, epoch, exp: now + LINK_TTL_MS }, secret, 'link');
}

export function verifyLinkToken(
  token: string,
  secret: string,
  now = Date.now()
): { vaultId: number; epoch: number; exp: number } | null {
  const claims = unpack<{ vaultId?: unknown; epoch?: unknown; exp?: unknown }>(token, secret, 'link');
  if (!claims) return null;
  if (typeof claims.vaultId !== 'number' || typeof claims.epoch !== 'number') return null;
  if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) || claims.exp < now) return null;
  return { vaultId: claims.vaultId, epoch: claims.epoch, exp: claims.exp };
}

/**
 * 접근 기록에 남길 IP 지문.
 *
 * 원문을 남기지 않는 이유는 개인정보 최소화다. 우리가 답해야 하는 질문은
 * "같은 사람이 몇 번 두드렸나"이지 "그 사람이 어디 사나"가 아니다.
 */
export function hashIp(ip: string | null, secret: string): string | null {
  if (typeof ip !== 'string' || !ip) return null;
  return createHmac('sha256', keyFor(secret, 'unlock')).update(`ip:${ip}`).digest('base64url').slice(0, 22);
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `node --test lib/resources/tokens.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/resources/tokens.ts lib/resources/tokens.test.ts
git commit -m "feat(resources): 잠금 쿠키는 자료함마다 따로 — 하나를 풀어도 옆은 잠겨 있다"
```

---

## Task 4: 무차별 대입 차단 (`lib/resources/rateLimit.ts`)

**Files:**
- Create: `lib/resources/rateLimit.ts`
- Test: `lib/resources/rateLimit.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `FAIL_WINDOW_MS` · `IP_FAIL_LIMIT: 10` · `VAULT_FAIL_LIMIT: 60` · `IP_BLOCK_MS` · `VAULT_BLOCK_MS` · `FailureSample { ipHash: string | null; at: number }` · `RateLimitVerdict { blocked: boolean; reason: 'ip' | 'vault' | null; retryAfterMs: number }` · `evaluateRateLimit(input: { now: number; ipHash: string | null; failures: FailureSample[] }): RateLimitVerdict`

- [ ] **Step 1: 실패하는 시험을 쓴다**

`lib/resources/rateLimit.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FAIL_WINDOW_MS,
  IP_BLOCK_MS,
  IP_FAIL_LIMIT,
  VAULT_BLOCK_MS,
  VAULT_FAIL_LIMIT,
  evaluateRateLimit,
  type FailureSample,
} from './rateLimit.ts';

const NOW = 1_700_000_000_000;
const IP = 'ipA';

function fails(count: number, ipHash: string | null, startOffset = -1000): FailureSample[] {
  return Array.from({ length: count }, (_, i) => ({ ipHash, at: NOW + startOffset - i * 1000 }));
}

test('실패가 없으면 통과한다', () => {
  const v = evaluateRateLimit({ now: NOW, ipHash: IP, failures: [] });
  assert.equal(v.blocked, false);
  assert.equal(v.reason, null);
  assert.equal(v.retryAfterMs, 0);
});

test('한도 직전까지는 통과한다 — 손이 미끄러진 사람을 막지 않는다', () => {
  const v = evaluateRateLimit({ now: NOW, ipHash: IP, failures: fails(IP_FAIL_LIMIT - 1, IP) });
  assert.equal(v.blocked, false);
});

test('같은 IP가 한도만큼 틀리면 막힌다', () => {
  const v = evaluateRateLimit({ now: NOW, ipHash: IP, failures: fails(IP_FAIL_LIMIT, IP) });
  assert.equal(v.blocked, true);
  assert.equal(v.reason, 'ip');
  assert.ok(v.retryAfterMs > 0 && v.retryAfterMs <= IP_BLOCK_MS);
});

test('남의 IP가 틀린 것으로는 내가 막히지 않는다', () => {
  const v = evaluateRateLimit({ now: NOW, ipHash: IP, failures: fails(IP_FAIL_LIMIT, 'ipB') });
  assert.equal(v.blocked, false);
});

test('창 밖의 실패는 세지 않는다 — 어제 틀린 것으로 오늘 막지 않는다', () => {
  const old: FailureSample[] = Array.from({ length: IP_FAIL_LIMIT + 5 }, (_, i) => ({
    ipHash: IP,
    at: NOW - FAIL_WINDOW_MS - 1000 - i * 1000,
  }));
  assert.equal(evaluateRateLimit({ now: NOW, ipHash: IP, failures: old }).blocked, false);
});

test('창 경계 — 정확히 창 안이면 세고, 창 밖이면 세지 않는다', () => {
  const inside = Array.from({ length: IP_FAIL_LIMIT }, () => ({ ipHash: IP, at: NOW - FAIL_WINDOW_MS + 1 }));
  const outside = Array.from({ length: IP_FAIL_LIMIT }, () => ({ ipHash: IP, at: NOW - FAIL_WINDOW_MS - 1 }));
  assert.equal(evaluateRateLimit({ now: NOW, ipHash: IP, failures: inside }).blocked, true);
  assert.equal(evaluateRateLimit({ now: NOW, ipHash: IP, failures: outside }).blocked, false);
});

test('여러 IP를 동원해 훑으면 자료함 전체가 잠긴다', () => {
  const many: FailureSample[] = Array.from({ length: VAULT_FAIL_LIMIT }, (_, i) => ({
    ipHash: `ip${i}`,
    at: NOW - 1000 - i,
  }));
  const v = evaluateRateLimit({ now: NOW, ipHash: 'freshIp', failures: many });
  assert.equal(v.blocked, true);
  assert.equal(v.reason, 'vault');
  assert.ok(v.retryAfterMs > 0 && v.retryAfterMs <= VAULT_BLOCK_MS);
});

test('IP 차단이 자료함 차단보다 먼저 판정된다 — 더 좁은 사유를 말한다', () => {
  const failures: FailureSample[] = [
    ...fails(IP_FAIL_LIMIT, IP),
    ...Array.from({ length: VAULT_FAIL_LIMIT }, (_, i) => ({ ipHash: `ip${i}`, at: NOW - 500 - i })),
  ];
  assert.equal(evaluateRateLimit({ now: NOW, ipHash: IP, failures }).reason, 'ip');
});

test('IP를 모르면 IP 차단은 걸지 않는다 — 모르는 것으로 모두를 막으면 안 된다', () => {
  const v = evaluateRateLimit({ now: NOW, ipHash: null, failures: fails(IP_FAIL_LIMIT, null) });
  assert.equal(v.reason, null);
  assert.equal(v.blocked, false);
});

test('차단은 마지막 실패에서부터 센다 — 계속 두드리면 계속 막힌다', () => {
  const recent = [{ ipHash: IP, at: NOW }, ...fails(IP_FAIL_LIMIT - 1, IP)];
  const v = evaluateRateLimit({ now: NOW, ipHash: IP, failures: recent });
  assert.equal(v.retryAfterMs, IP_BLOCK_MS);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test lib/resources/rateLimit.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 최소 구현**

`lib/resources/rateLimit.ts`:

```ts
/**
 * 무차별 대입 차단 — "이 사람을 지금 들여보내도 되는가" (순수 함수)
 *
 * 번호는 여섯 자리(90만 가지), 비밀번호는 네 자리부터(1만 가지)다. 둘 다
 * 사람이 외울 수 있는 크기라, 기계가 순서대로 두드리는 것을 세지 않으면
 * 언젠가는 열린다.
 *
 * 두 겹으로 센다:
 *  - **같은 IP**가 짧은 시간에 여러 번 틀리면 그 IP를 잠깐 막는다.
 *  - 그것만으로는 여러 대를 동원한 훑기를 못 막으므로, **자료함 전체**의
 *    실패도 훨씬 높은 한도로 함께 본다.
 *
 * 자료함 전체를 잠그면 진짜 쓰는 사람도 막힌다 — 그래서 한도를 IP의 여섯 배로
 * 두고 잠금 시간은 절반으로 짧게 잡았다. 공격을 늦추는 것이 목적이지 완전히
 * 세우는 것이 아니다.
 *
 * 저장은 resource_access_log의 unlock_fail 행이 대신한다. 표를 따로 두지 않는
 * 이유는, 어차피 "누가 언제 두드렸나"를 저작권 때문에 남겨야 하기 때문이다.
 */

/** 실패를 세는 창 */
export const FAIL_WINDOW_MS = 10 * 60 * 1000;

/** 한 IP가 이만큼 틀리면 막는다 */
export const IP_FAIL_LIMIT = 10;

/** 자료함 전체가 이만큼 틀리면 잠근다(여러 IP 동원 대비) */
export const VAULT_FAIL_LIMIT = 60;

export const IP_BLOCK_MS = 10 * 60 * 1000;
export const VAULT_BLOCK_MS = 5 * 60 * 1000;

export interface FailureSample {
  /** 모를 수도 있다(프록시·직접 호출) */
  ipHash: string | null;
  /** epoch ms */
  at: number;
}

export interface RateLimitVerdict {
  blocked: boolean;
  reason: 'ip' | 'vault' | null;
  /** 화면에 "잠시 후 다시" 를 말할 때 쓴다. 통과면 0. */
  retryAfterMs: number;
}

const PASS: RateLimitVerdict = { blocked: false, reason: null, retryAfterMs: 0 };

export function evaluateRateLimit(input: {
  now: number;
  ipHash: string | null;
  failures: FailureSample[];
}): RateLimitVerdict {
  const { now, ipHash } = input;
  const since = now - FAIL_WINDOW_MS;
  const recent = (input.failures ?? []).filter((f) => f && f.at >= since && f.at <= now);
  if (!recent.length) return PASS;

  // ① 같은 IP — 더 좁은 사유이므로 먼저 본다.
  //    IP를 모르는 요청끼리는 묶지 않는다. "모른다"를 하나의 신원으로 치면
  //    프록시 뒤의 여러 사람이 서로를 막는다.
  if (ipHash) {
    const mine = recent.filter((f) => f.ipHash === ipHash);
    if (mine.length >= IP_FAIL_LIMIT) {
      const last = Math.max(...mine.map((f) => f.at));
      return { blocked: true, reason: 'ip', retryAfterMs: Math.max(1, last + IP_BLOCK_MS - now) };
    }
  }

  // ② 자료함 전체
  if (recent.length >= VAULT_FAIL_LIMIT) {
    const last = Math.max(...recent.map((f) => f.at));
    return { blocked: true, reason: 'vault', retryAfterMs: Math.max(1, last + VAULT_BLOCK_MS - now) };
  }

  return PASS;
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `node --test lib/resources/rateLimit.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/resources/rateLimit.ts lib/resources/rateLimit.test.ts
git commit -m "feat(resources): 번호를 기계가 훑지 못하게 — IP와 자료함 두 겹으로 센다"
```

---

## Task 5: 단일 게이트 (`lib/resources/gate.ts`)

**Files:**
- Create: `lib/resources/gate.ts`
- Test: `lib/resources/gate.test.ts`

**Interfaces:**
- Consumes: 없음 (검증이 끝난 사실만 받는다)
- Produces:
  - `GateNeed = 'view' | 'download' | 'email'`
  - `GateDenial = 'not_found' | 'inactive' | 'expired' | 'locked' | 'download_denied' | 'email_denied'`
  - `GateVaultFacts { id: number; active: boolean; expiresAt: string | null; allowDownload: boolean; allowEmail: boolean; linkEpoch: number }`
  - `GateVerdict = { ok: true; vaultId: number; via: 'cookie' | 'link' } | { ok: false; reason: GateDenial }`
  - `evaluateGate(input: { vault: GateVaultFacts | null; now: number; cookie: { vaultId: number } | null; link: { vaultId: number; epoch: number } | null; need: GateNeed }): GateVerdict`

- [ ] **Step 1: 실패하는 시험을 쓴다**

`lib/resources/gate.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGate, type GateVaultFacts } from './gate.ts';

const NOW = Date.parse('2026-09-01T12:00:00Z');

function vault(over: Partial<GateVaultFacts> = {}): GateVaultFacts {
  return {
    id: 5,
    active: true,
    expiresAt: null,
    allowDownload: true,
    allowEmail: true,
    linkEpoch: 2,
    ...over,
  };
}

test('없는 자료함은 not_found — 무엇을 물어도', () => {
  for (const need of ['view', 'download', 'email'] as const) {
    const v = evaluateGate({ vault: null, now: NOW, cookie: { vaultId: 5 }, link: null, need });
    assert.deepEqual(v, { ok: false, reason: 'not_found' });
  }
});

test('쿠키가 있으면 열린다', () => {
  const v = evaluateGate({ vault: vault(), now: NOW, cookie: { vaultId: 5 }, link: null, need: 'view' });
  assert.deepEqual(v, { ok: true, vaultId: 5, via: 'cookie' });
});

test('아무 열쇠도 없으면 잠겨 있다', () => {
  const v = evaluateGate({ vault: vault(), now: NOW, cookie: null, link: null, need: 'view' });
  assert.deepEqual(v, { ok: false, reason: 'locked' });
});

test('다른 자료함의 쿠키는 이 자료함을 열지 못한다', () => {
  const v = evaluateGate({ vault: vault(), now: NOW, cookie: { vaultId: 9 }, link: null, need: 'view' });
  assert.deepEqual(v, { ok: false, reason: 'locked' });
});

test('꺼 둔 자료함은 열쇠가 있어도 안 열린다 — 끄는 것이 즉시 듣지 않으면 끄는 의미가 없다', () => {
  const v = evaluateGate({ vault: vault({ active: false }), now: NOW, cookie: { vaultId: 5 }, link: null, need: 'view' });
  assert.deepEqual(v, { ok: false, reason: 'inactive' });
});

test('만료일이 지나면 열리지 않는다', () => {
  const v = evaluateGate({
    vault: vault({ expiresAt: '2026-08-31T23:59:59Z' }),
    now: NOW,
    cookie: { vaultId: 5 },
    link: null,
    need: 'view',
  });
  assert.deepEqual(v, { ok: false, reason: 'expired' });
});

test('만료일이 아직이면 열린다', () => {
  const v = evaluateGate({
    vault: vault({ expiresAt: '2026-09-30T00:00:00Z' }),
    now: NOW,
    cookie: { vaultId: 5 },
    link: null,
    need: 'view',
  });
  assert.equal(v.ok, true);
});

test('읽을 수 없는 만료일은 만료로 보지 않는다 — 잘못된 값 때문에 현장에서 막히면 안 된다', () => {
  const v = evaluateGate({
    vault: vault({ expiresAt: '언젠가' }),
    now: NOW,
    cookie: { vaultId: 5 },
    link: null,
    need: 'view',
  });
  assert.equal(v.ok, true);
});

test('세대가 맞는 받기 링크는 비밀번호 없이 연다', () => {
  const v = evaluateGate({
    vault: vault({ linkEpoch: 2 }),
    now: NOW,
    cookie: null,
    link: { vaultId: 5, epoch: 2 },
    need: 'view',
  });
  assert.deepEqual(v, { ok: true, vaultId: 5, via: 'link' });
});

test('무효화된(옛 세대) 링크는 죽는다', () => {
  const v = evaluateGate({
    vault: vault({ linkEpoch: 3 }),
    now: NOW,
    cookie: null,
    link: { vaultId: 5, epoch: 2 },
    need: 'view',
  });
  assert.deepEqual(v, { ok: false, reason: 'locked' });
});

test('다른 자료함을 가리키는 링크는 듣지 않는다', () => {
  const v = evaluateGate({
    vault: vault(),
    now: NOW,
    cookie: null,
    link: { vaultId: 9, epoch: 2 },
    need: 'view',
  });
  assert.deepEqual(v, { ok: false, reason: 'locked' });
});

test('다운로드를 막아 둔 자료함은 보기는 되고 받기는 안 된다', () => {
  const facts = { vault: vault({ allowDownload: false }), now: NOW, cookie: { vaultId: 5 }, link: null };
  assert.equal(evaluateGate({ ...facts, need: 'view' }).ok, true);
  assert.deepEqual(evaluateGate({ ...facts, need: 'download' }), { ok: false, reason: 'download_denied' });
});

test('메일을 막아 둔 자료함은 보내기만 안 된다', () => {
  const facts = { vault: vault({ allowEmail: false }), now: NOW, cookie: { vaultId: 5 }, link: null };
  assert.equal(evaluateGate({ ...facts, need: 'view' }).ok, true);
  assert.deepEqual(evaluateGate({ ...facts, need: 'email' }), { ok: false, reason: 'email_denied' });
});

test('잠긴 상태에서는 다운로드 금지보다 잠김이 먼저다 — 열쇠 없는 사람에게 설정을 알리지 않는다', () => {
  const v = evaluateGate({
    vault: vault({ allowDownload: false }),
    now: NOW,
    cookie: null,
    link: null,
    need: 'download',
  });
  assert.deepEqual(v, { ok: false, reason: 'locked' });
});

test('쿠키와 링크가 둘 다 있으면 쿠키가 이긴다', () => {
  const v = evaluateGate({
    vault: vault(),
    now: NOW,
    cookie: { vaultId: 5 },
    link: { vaultId: 5, epoch: 2 },
    need: 'view',
  });
  assert.equal(v.ok && v.via, 'cookie');
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test lib/resources/gate.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 최소 구현**

`lib/resources/gate.ts`:

```ts
/**
 * 자료함 게이트 — "이 요청이 이 자료함을 열어도 되는가"의 **단 하나의 판정자**
 *
 * 화면과 라우트가 각자 판단하면 언젠가 어긋나고, **어긋난 쪽은 늘 열려 있는
 * 쪽이다.** 신청서에서 겪은 그대로다. 그래서 잠금·만료·비활성·세대·허용 토글을
 * 전부 이 함수 하나가 본다. 부르는 쪽은 결과만 받는다.
 *
 * 서명 검증은 여기서 하지 않는다 — 이 함수는 **검증이 끝난 사실**만 받는다.
 * 그래야 순수하게 남고, 조합을 시험으로 잠글 수 있다.
 *
 * 판정 순서에 뜻이 있다: 존재 → 상태(꺼짐·만료) → 열쇠 → 그 동작의 허용.
 * 열쇠가 없는 사람에게는 "다운로드가 막혀 있다" 같은 **설정을 알리지 않는다.**
 */

export type GateNeed = 'view' | 'download' | 'email';

export type GateDenial =
  | 'not_found'
  | 'inactive'
  | 'expired'
  | 'locked'
  | 'download_denied'
  | 'email_denied';

export interface GateVaultFacts {
  id: number;
  active: boolean;
  /** ISO 문자열. 없으면 만료 없음 */
  expiresAt: string | null;
  allowDownload: boolean;
  allowEmail: boolean;
  linkEpoch: number;
}

export type GateVerdict =
  | { ok: true; vaultId: number; via: 'cookie' | 'link' }
  | { ok: false; reason: GateDenial };

export function evaluateGate(input: {
  vault: GateVaultFacts | null;
  now: number;
  /** 서명 검증이 끝난 잠금 쿠키 */
  cookie: { vaultId: number } | null;
  /** 서명 검증이 끝난 받기 링크 토큰 */
  link: { vaultId: number; epoch: number } | null;
  need: GateNeed;
}): GateVerdict {
  const { vault, now, cookie, link, need } = input;

  if (!vault) return { ok: false, reason: 'not_found' };
  if (!vault.active) return { ok: false, reason: 'inactive' };

  if (vault.expiresAt) {
    const at = Date.parse(vault.expiresAt);
    // 읽을 수 없는 값은 만료로 치지 않는다 — 잘못 들어간 문자열 하나로
    // 공연장에서 자료함이 통째로 막히는 것이 더 나쁘다.
    if (Number.isFinite(at) && at <= now) return { ok: false, reason: 'expired' };
  }

  const via: 'cookie' | 'link' | null =
    cookie && cookie.vaultId === vault.id
      ? 'cookie'
      : link && link.vaultId === vault.id && link.epoch === vault.linkEpoch
        ? 'link'
        : null;

  if (!via) return { ok: false, reason: 'locked' };

  if (need === 'download' && !vault.allowDownload) {
    return { ok: false, reason: 'download_denied' };
  }
  if (need === 'email' && !vault.allowEmail) {
    return { ok: false, reason: 'email_denied' };
  }

  return { ok: true, vaultId: vault.id, via };
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `node --test lib/resources/gate.test.ts`
Expected: PASS (15 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/resources/gate.ts lib/resources/gate.test.ts
git commit -m "feat(resources): 열어도 되는가는 한 곳에서만 판단한다 — 두 벌이 되면 열린 쪽이 이긴다"
```

---

## Task 6: 업로드 정책에 자료함을 등록한다

**Files:**
- Modify: `lib/r2/uploadPolicy.ts` (`UploadPolicy`에 `allowedTypePrefixes` 추가, `resource-items` 규칙 추가)
- Modify: `lib/r2/uploadPolicy.test.ts` (케이스 추가)
- Modify: `lib/r2/uploadTargets.ts` (`AUTHORIZE`에 `'resource-items': (s) => isAdmin(s)`)
- Modify: `lib/r2/directUpload.ts` (`createTickets`·`finalizeTicket`가 `allowedTypePrefixes`를 본다)
- Modify: `lib/uploadClient.ts` (`uploadFilesDirect`에 바이트 진행 콜백 추가)

**Interfaces:**
- Consumes: 없음
- Produces: `UploadPolicy.allowedTypePrefixes?: string[]` · 정책 키 `'resource-items'` · `uploadFilesDirect(target, files, onProgress?, onBytes?)`

- [ ] **Step 1: 실패하는 시험을 쓴다**

`lib/r2/uploadPolicy.test.ts` 끝에 추가:

```ts
test('자료함 파일 — 폴더는 자료함 id로 갈리고, 이미지 정규화를 하지 않는다', () => {
  const p = findUploadPolicy('/api/admin/resources/42/items');
  assert.ok(p);
  assert.equal(p.key, 'resource-items');
  assert.equal(p.folder, 'resources/42');
  assert.equal(p.imagesOnly, false);
  assert.equal(p.processImage, false, '음원을 WebP로 바꾸면 안 된다');
  assert.equal(p.keepOriginal, false, '올라온 것 자체가 원본이다 — 사본을 하나 더 두지 않는다');
  assert.equal(p.maxBytes, 100 * 1024 * 1024);
});

test('자료함은 음원·이미지·PDF만 받는다', () => {
  const p = findUploadPolicy('/api/admin/resources/1/items');
  assert.deepEqual(p?.allowedTypePrefixes, ['audio/', 'image/', 'application/pdf']);
});

test('형식 제한이 없는 정책은 undefined — 기존 규칙의 동작이 변하지 않는다', () => {
  assert.equal(findUploadPolicy('/api/upload')?.allowedTypePrefixes, undefined);
  assert.equal(
    findUploadPolicy('/api/admin/forms/1/responses/2/messages')?.allowedTypePrefixes,
    undefined
  );
});

test('자료함 id가 숫자가 아니면 등록된 주소가 아니다', () => {
  assert.equal(findUploadPolicy('/api/admin/resources/abc/items'), null);
  assert.equal(findUploadPolicy('/api/admin/resources//items'), null);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `node --test lib/r2/uploadPolicy.test.ts`
Expected: FAIL — `p.key`가 `undefined`(규칙 없음)

- [ ] **Step 3: 정책에 필드와 규칙을 더한다**

`lib/r2/uploadPolicy.ts`의 `UploadPolicy` 인터페이스에 추가:

```ts
  /**
   * 받아 줄 Content-Type 접두사. 비우면 제한 없음(기존 규칙의 동작 유지).
   *
   * imagesOnly가 "이미지만/아무거나" 두 갈래뿐이라 생겼다. 메일 첨부는 아무거나
   * 받아도 되지만 자료함은 음원·PDF·이미지만 받아야 한다 — 그 사이가 없었다.
   */
  allowedTypePrefixes?: string[];
```

`PolicyRule` 인터페이스에도 같은 줄(`allowedTypePrefixes?: string[];`)을 추가하고, `RULES` 배열의 `mail-attachment` 규칙 **뒤에** 추가:

```ts
  {
    /**
     * 공연 자료함의 파일 — 음원이 주인이다.
     *
     * processImage를 끄는 이유는 자명하지만(mp3를 WebP로 바꿀 수 없다) 이미지도
     * 손대지 않는다: 자료함의 이미지는 화면에 걸 썸네일이 아니라 **현장에서 보는
     * 큐시트·동선도**라, 장변 2000으로 줄이면 글씨가 뭉갠다.
     *
     * keepOriginal이 false인 것은 원본을 버린다는 뜻이 아니다 — processImage가
     * 꺼져 있으면 올라온 객체 자체가 결과이고, 사본을 하나 더 만들지 않는다.
     */
    key: 'resource-items',
    match: /^\/api\/admin\/resources\/(\d+)\/items$/,
    folder: (m) => `resources/${m[1]}`,
    processImage: false,
    imagesOnly: false,
    maxBytes: 100 * 1024 * 1024,
    allowedTypePrefixes: ['audio/', 'image/', 'application/pdf'],
  },
```

`toPolicy` 함수에 한 줄 추가(`imagesOnly` 줄 뒤):

```ts
    allowedTypePrefixes: rule.allowedTypePrefixes,
```

- [ ] **Step 4: 통과를 확인한다**

Run: `node --test lib/r2/uploadPolicy.test.ts`
Expected: PASS (기존 + 4 tests)

- [ ] **Step 5: 서명·마무리가 형식을 강제하게 한다**

`lib/r2/directUpload.ts`의 `createTickets` 안, `if (target.imagesOnly && …)` 블록 **바로 뒤**에 추가:

```ts
    if (
      target.allowedTypePrefixes &&
      !target.allowedTypePrefixes.some((p) => (file.type || '').startsWith(p))
    ) {
      return { ok: false, error: `이 자리에 올릴 수 없는 형식입니다: ${file.name}` };
    }
```

같은 파일 `finalizeTicket` 안, `if (target.imagesOnly && !contentType.startsWith('image/'))` 블록 **바로 뒤**에 추가:

```ts
  // 서명 때 신고한 형식을 믿지 않는다 — 실제로 올라온 것의 Content-Type을 다시 본다
  if (
    target.allowedTypePrefixes &&
    !target.allowedTypePrefixes.some((p) => contentType.startsWith(p))
  ) {
    await discard(key);
    return { ok: false, error: '이 자리에 올릴 수 없는 형식입니다.' };
  }
```

- [ ] **Step 6: 권한 규칙을 짝지어 등록한다**

`lib/r2/uploadTargets.ts`의 `AUTHORIZE`에 추가(`'mail-attachment'` 줄 뒤):

```ts
  // 자료함 파일 — 라우트(app/api/admin/resources/[id]/items)의 첫 줄과 같은 판정
  'resource-items': (s) => isAdmin(s),
```

- [ ] **Step 7: 큰 파일의 진행률을 볼 수 있게 한다**

`lib/uploadClient.ts`의 `uploadFilesDirect` 시그니처와 본문을 바꾼다:

```ts
export async function uploadFilesDirect(
  target: string,
  files: File[],
  onProgress?: (done: number, total: number) => void,
  /**
   * 지금 올라가는 파일 한 건의 바이트 진행. 100MB짜리 음원 하나를 올릴 때
   * "1/1"만 보이면 화면이 멈춘 것처럼 보이고, 사람은 새로고침을 누른다.
   */
  onBytes?: (index: number, sent: number, total: number) => void
): Promise<UploadedRef[]> {
  if (!files.length) return [];

  const tickets: Ticket[] = [];
  for (let i = 0; i < files.length; i += SIGN_BATCH) {
    tickets.push(...(await requestTickets(target, files.slice(i, i + SIGN_BATCH))));
  }
  if (tickets.length !== files.length) {
    throw new UploadError('업로드를 시작하지 못했습니다. 다시 시도해주세요.');
  }

  const refs: UploadedRef[] = [];
  for (let i = 0; i < files.length; i++) {
    await putToR2(files[i], tickets[i], onBytes ? (sent, total) => onBytes(i, sent, total) : undefined);
    refs.push({ ticket: tickets[i].ticket, name: files[i].name });
    onProgress?.(i + 1, files.length);
  }
  return refs;
}
```

- [ ] **Step 8: 전체 시험과 타입을 확인한다**

Run: `npm test && npx tsc --noEmit`
Expected: 전부 PASS, 타입 오류 없음

- [ ] **Step 9: 커밋**

```bash
git add lib/r2/uploadPolicy.ts lib/r2/uploadPolicy.test.ts lib/r2/uploadTargets.ts lib/r2/directUpload.ts lib/uploadClient.ts
git commit -m "feat(upload): 이미지만/아무거나 사이를 연다 — 자료함은 음원·PDF·이미지만"
```

---

## Task 7: D1 표와 조회 (`migrations/0042` · `lib/d1/resources.ts` · `types/resources.ts`)

**Files:**
- Create: `migrations/0042_resources.sql`
- Create: `types/resources.ts`
- Create: `lib/d1/resources.ts`
- Modify: `lib/d1/index.ts` (재수출)

**Interfaces:**
- Consumes: `lib/resources/code.ts`, `lib/resources/passcode.ts`, `lib/d1/client.ts`(`queryD1`·`executeD1`)
- Produces:
  - `types/resources.ts`: `ResourceVault` · `ResourceVaultSummary` · `ResourceItem` · `ResourceItemPublic` · `ResourceAccessAction` · `ResourceAccessEntry`
  - `lib/d1/resources.ts`: `listVaults()` · `getVaultById(id)` · `getVaultByCode(code)` · `createVault(input)` · `updateVault(id, patch)` · `deleteVault(id)` · `bumpLinkEpoch(id)` · `listItems(vaultId)` · `getItem(vaultId, itemId)` · `addItems(vaultId, rows)` · `updateItem(vaultId, itemId, patch)` · `deleteItem(vaultId, itemId)` · `reorderItems(vaultId, orderedIds)` · `logAccess(entry)` · `recentFailures(code, sinceIso)` · `listAccessLog(vaultId, limit)`

- [ ] **Step 1: 마이그레이션을 쓴다**

`migrations/0042_resources.sql`:

```sql
-- 공연 자료함 — 번호 하나로 여는 현장 자료실
--
-- 저작권 자료를 담는 자리다. r2_key는 절대 클라이언트로 나가지 않고,
-- 재생·다운로드는 우리 라우트가 중계한다(lib/resources/stream.ts).

CREATE TABLE IF NOT EXISTS resource_vaults (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  note TEXT,
  -- AES-256-GCM 암호문. 해시가 아닌 이유는 lib/resources/passcode.ts 머리말에.
  passcode_enc TEXT NOT NULL,
  event_id INTEGER,
  allow_download INTEGER NOT NULL DEFAULT 1,
  allow_email INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  -- 올리면 이미 나간 받기 링크가 전부 죽는다
  link_epoch INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_resource_vaults_code ON resource_vaults(code);
CREATE INDEX IF NOT EXISTS idx_resource_vaults_event ON resource_vaults(event_id);

CREATE TABLE IF NOT EXISTS resource_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vault_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  -- 브라우저가 읽어 보낸 값. 표시 전용이고 어떤 판정에도 쓰지 않는다.
  duration_seconds INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (vault_id) REFERENCES resource_vaults(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_resource_items_vault ON resource_items(vault_id, sort_order);

-- 언제 누구에게 나갔나. 성공만이 아니라 실패도 남긴다 —
-- 실패를 세는 것이 무차별 대입 차단의 저장소이기도 하다(lib/resources/rateLimit.ts).
CREATE TABLE IF NOT EXISTS resource_access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vault_id INTEGER,
  code TEXT,
  action TEXT NOT NULL,
  item_id INTEGER,
  ip_hash TEXT,
  user_agent TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_resource_access_code_time ON resource_access_log(code, created_at);
CREATE INDEX IF NOT EXISTS idx_resource_access_vault_time ON resource_access_log(vault_id, created_at);
```

- [ ] **Step 2: 타입을 쓴다**

`types/resources.ts`:

```ts
/**
 * 공연 자료함 도메인 타입.
 *
 * `ResourceItem`과 `ResourceItemPublic`을 **일부러 갈라 둔다.** 공개 화면으로
 * 내려가는 모양에는 `r2Key`가 없다 — 타입이 그것을 막는다. 버킷이 공개라
 * 키 하나가 새면 비밀번호가 무의미해진다.
 */

export type ResourceAccessAction =
  | 'unlock'
  | 'unlock_fail'
  | 'link_open'
  | 'play'
  | 'download'
  | 'email_sent'
  | 'passcode_view';

export interface ResourceVault {
  id: number;
  code: string;
  title: string;
  note: string | null;
  /** 암호문 그대로. 화면으로 보내기 전에 반드시 벗겨 내거나 복호할 것 */
  passcodeEnc: string;
  eventId: number | null;
  allowDownload: boolean;
  allowEmail: boolean;
  active: boolean;
  expiresAt: string | null;
  linkEpoch: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 목록 한 줄 — 비밀번호를 담지 않는다 */
export interface ResourceVaultSummary {
  id: number;
  code: string;
  title: string;
  eventId: number | null;
  allowDownload: boolean;
  allowEmail: boolean;
  active: boolean;
  expiresAt: string | null;
  itemCount: number;
  totalBytes: number;
  lastOpenedAt: string | null;
  recentFailCount: number;
  createdAt: string;
}

export interface ResourceItem {
  id: number;
  vaultId: number;
  title: string;
  r2Key: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  durationSeconds: number | null;
  sortOrder: number;
  createdAt: string;
}

/** 브라우저로 내려가는 모양 — r2Key가 없다 */
export interface ResourceItemPublic {
  id: number;
  title: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  durationSeconds: number | null;
  sortOrder: number;
}

export interface ResourceAccessEntry {
  id: number;
  vaultId: number | null;
  code: string | null;
  action: ResourceAccessAction;
  itemId: number | null;
  ipHash: string | null;
  userAgent: string | null;
  detail: string | null;
  createdAt: string;
}

/** ResourceItem에서 공개용으로 깎는다 — 이 함수를 지나지 않고 내보내지 말 것 */
export function toPublicItem(item: ResourceItem): ResourceItemPublic {
  return {
    id: item.id,
    title: item.title,
    fileName: item.fileName,
    contentType: item.contentType,
    sizeBytes: item.sizeBytes,
    durationSeconds: item.durationSeconds,
    sortOrder: item.sortOrder,
  };
}
```

- [ ] **Step 3: D1 접근층을 쓴다**

`lib/d1/resources.ts` — 기존 `lib/d1/faq.ts`의 관용구(행 매핑 함수 + `queryD1`/`executeD1`)를 따른다. 먼저 `lib/d1/faq.ts`를 읽어 `queryD1`·`executeD1`의 정확한 시그니처와 매핑 스타일을 확인한 뒤, 위 **Produces**에 적힌 함수 전부를 구현한다. 필수 사항:

- `createVault`는 `generateResourceCode()`로 번호를 뽑고, `code` UNIQUE 충돌이 나면 **최대 10회 다시 뽑는다.** 10회 모두 실패하면 던진다(90만 가지에서 10회 연속 충돌은 사실상 표가 가득 찼다는 뜻이다).
- `listVaults()`는 `resource_items`를 `LEFT JOIN`해 `itemCount`·`totalBytes`를 구하고, `resource_access_log`에서 마지막 `unlock`/`link_open` 시각과 최근 10분 `unlock_fail` 수를 구한다. **`passcode_enc`를 select 하지 않는다.**
- `recentFailures(code, sinceIso)`는 `{ ipHash, at }[]`를 돌려준다(`at`은 epoch ms). `rateLimit.ts`의 `FailureSample` 모양 그대로.
- `reorderItems(vaultId, orderedIds)`는 `batchD1`로 한 번에 쓴다.
- `logAccess`는 **던지지 않는다.** 기록 실패가 재생을 막으면 안 된다 — `try/catch`로 삼키고 `console.error`만 남긴다.

- [ ] **Step 4: 재수출한다**

`lib/d1/index.ts` 끝에 추가:

```ts
export {
  listVaults,
  getVaultById,
  getVaultByCode,
  createVault,
  updateVault,
  deleteVault,
  bumpLinkEpoch,
  listItems,
  getItem,
  addItems,
  updateItem,
  deleteItem,
  reorderItems,
  logAccess,
  recentFailures,
  listAccessLog,
} from './resources';
```

- [ ] **Step 5: 원격 D1에 적용한다**

Run: `npm run d1:migrate`
Expected: `0042_resources` 적용됨. **표를 더하기만 하므로 기존 데이터·기능은 건드리지 않는다.**

- [ ] **Step 6: 표가 생겼는지 확인한다**

Run: `node scripts/d1Query.mjs "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'resource%'"`
Expected: `resource_vaults`, `resource_items`, `resource_access_log` 세 줄

- [ ] **Step 7: 타입을 확인하고 커밋한다**

```bash
npx tsc --noEmit
git add migrations/0042_resources.sql types/resources.ts lib/d1/resources.ts lib/d1/index.ts
git commit -m "feat(resources): 자료함 표 셋 — 키를 담는 자리와 내보내는 자리를 타입으로 가른다"
```

---

## Task 8: 메뉴·아이콘·권한·번역

**Files:**
- Modify: `types/permissions.ts` (`MenuKey`에 `'resources'`)
- Modify: `lib/admin/menu-registry.ts` (노드 1개)
- Modify: `lib/admin/menu-icons.tsx` (`vault` 아이콘)
- Modify: `locale/ko.json`, `locale/en.json`

**Interfaces:**
- Consumes: 없음
- Produces: 메뉴 키 `'resources'`, 아이콘 키 `'vault'`

- [ ] **Step 1: MenuKey에 키를 더한다**

`types/permissions.ts`의 `MenuKey` 유니온에 `| 'resources'`를 추가한다(`'participation'` 근처, 공연 그룹 키들과 함께).

- [ ] **Step 2: 아이콘을 그린다**

`lib/admin/menu-icons.tsx`에 함수를 추가하고 맵에 `vault:`로 등록한다:

```tsx
function IconVault() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 8.5v-1M12 16.5v1M8.5 12h-1M16.5 12h1" />
    </svg>
  );
}
```

- [ ] **Step 3: 메뉴를 등록한다**

`lib/admin/menu-registry.ts`의 `MENU_REGISTRY`에서 `participation` 줄 **뒤**에 추가:

```ts
  // 공연 자료함: 음원을 미리 올려 두고 현장에서 번호 하나(ktdoc.org/473128)로 연다.
  // 자료실 그룹이 아니라 여기 두는 이유는 콘텐츠 관리가 아니라 **공연 운영 도구**이기 때문이다.
  // 저작권 자료를 담으므로 admin 전용으로 fail-closed.
  { key: 'resources', href: '/admin/resources', label: '공연 자료함', iconKey: 'vault', group: 'show', defaultRoles: ['admin'] },
```

- [ ] **Step 4: 번역을 넣는다**

`locale/ko.json`에 `"admin.nav.resources": "공연 자료함"`, `locale/en.json`에 `"admin.nav.resources": "Show Files"` 를 추가한다(각 파일의 `admin.nav.*` 키들 사이, 알파벳 순서를 지키는 파일이면 그 순서를 따른다).

- [ ] **Step 5: 확인하고 커밋한다**

Run: `npx tsc --noEmit && npm run lint:i18n`
Expected: 타입 오류 없음, i18n 린트 통과(키 수 +1, ko/en 일치)

```bash
git add types/permissions.ts lib/admin/menu-registry.ts lib/admin/menu-icons.tsx locale/ko.json locale/en.json
git commit -m "feat(resources): 자료함은 자료실이 아니라 공연 옆에 — 콘텐츠가 아니라 운영 도구다"
```

---

## Task 9: 관리 API

**Files:**
- Create: `app/api/admin/resources/route.ts`
- Create: `app/api/admin/resources/[id]/route.ts`
- Create: `app/api/admin/resources/[id]/items/route.ts`
- Create: `app/api/admin/resources/[id]/items/[itemId]/route.ts`

**Interfaces:**
- Consumes: `lib/d1/resources.ts`, `lib/resources/passcode.ts`, `lib/r2/readUploads.ts`, `lib/r2/uploadTargets.ts`(`uploadTargetByKey`), `lib/isAdmin.ts`
- Produces: 아래 계약. 응답 봉투는 사이트 관례대로 `{ success, data?, error? }`.

| 메서드·주소 | 본문 | 응답 |
|---|---|---|
| `GET /api/admin/resources` | — | `{ vaults: ResourceVaultSummary[] }` |
| `POST /api/admin/resources` | `{ title, note?, passcode, eventId?, allowDownload?, allowEmail?, expiresAt? }` | `{ vault: { id, code } }` |
| `GET /api/admin/resources/[id]` | — | `{ vault, items, log, passcode }` — `passcode`는 복호값 또는 `null` |
| `PATCH /api/admin/resources/[id]` | `{ title?, note?, passcode?, eventId?, allowDownload?, allowEmail?, active?, expiresAt?, revokeLinks? }` | `{ ok: true }` |
| `DELETE /api/admin/resources/[id]` | — | `{ ok: true }` — R2 객체도 함께 지운다 |
| `POST /api/admin/resources/[id]/items` | `{ uploads: [{ ticket, name }], durations?: Record<string, number> }` | `{ items: ResourceItem[] }` |
| `PATCH /api/admin/resources/[id]/items` | `{ orderedIds: number[] }` | `{ ok: true }` |
| `PATCH /api/admin/resources/[id]/items/[itemId]` | `{ title }` | `{ ok: true }` |
| `DELETE /api/admin/resources/[id]/items/[itemId]` | — | `{ ok: true }` — R2 객체도 지운다 |

- [ ] **Step 1: 모든 라우트의 첫 줄을 같은 판정으로 연다**

각 라우트 파일 맨 위에 공통으로:

```ts
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';

async function guard() {
  const session = await auth();
  if (!isAdmin(session)) {
    return { session: null, deny: NextResponse.json({ success: false, error: '권한이 없습니다.' }, { status: 403 }) };
  }
  return { session, deny: null };
}
```

**이 판정은 `lib/r2/uploadTargets.ts`의 `'resource-items': (s) => isAdmin(s)` 와 같은 함수다** — 한쪽만 고치면 어긋난다.

- [ ] **Step 2: 목록·생성 라우트를 쓴다**

`app/api/admin/resources/route.ts`. `POST`는:
1. `isValidPasscode(body.passcode)` 아니면 400 `'비밀번호는 숫자 4~8자리로 정해 주세요.'`
2. `title`이 비면 400
3. `encryptPasscode(passcode, process.env.AUTH_SECRET!)`
4. `createVault(...)` → `{ id, code }`

- [ ] **Step 3: 상세·수정·삭제 라우트를 쓴다**

`app/api/admin/resources/[id]/route.ts`.

`GET`은 `getVaultById` → `passcodeEnc`를 **응답에서 벗기고** `decryptPasscode` 결과를 `passcode` 필드로 따로 싣는다. 복호가 `null`이면 그대로 `null`(화면이 "다시 설정해 주세요"를 띄운다). 복호해 보여줄 때 `logAccess({ action: 'passcode_view', … })`.

`PATCH`에서 `passcode`가 오면 형식 검증 후 다시 암호화한다. `revokeLinks: true`면 `bumpLinkEpoch(id)`.

`DELETE`는 `listItems`로 키를 모아 `deleteFromR2`를 각각 부른 뒤 `deleteVault`. **R2를 먼저 지운다** — D1 행을 먼저 지우면 키를 잃어 고아 객체가 남는다.

- [ ] **Step 4: 파일 마무리 라우트를 쓴다**

`app/api/admin/resources/[id]/items/route.ts`의 `POST`:

```ts
import { readUploads } from '@/lib/r2/readUploads';
import { uploadTargetByKey } from '@/lib/r2/uploadTargets';

// …guard 통과 후
const vault = await getVaultById(id);
if (!vault) return NextResponse.json({ success: false, error: '자료함을 찾을 수 없습니다.' }, { status: 404 });

const target = uploadTargetByKey('resource-items', `resources/${id}`);
if (!target) return NextResponse.json({ success: false, error: '업로드 설정을 찾지 못했습니다.' }, { status: 500 });

const intake = await readUploads(request, { target, userId: session.user.id, maxFiles: 20 });
if (!intake.uploads.length) {
  return NextResponse.json({ success: false, error: intake.error ?? '올릴 파일이 없습니다.' }, { status: 400 });
}
```

그 다음 `intake.uploads`를 `addItems`로 넣는다. `title`의 기본값은 **확장자를 뗀 원본 파일명**(`upload.originalName.replace(/\.[^.]+$/, '')`), `sortOrder`는 현재 최대값 + 1부터. `durations`는 `intake.field('durations')`를 JSON 파싱해 파일명으로 맞춘다(없으면 `null`).

`uploadTargetByKey`가 `lib/r2/uploadTargets.ts`에 없으면 `uploadPolicyByKey`를 감싸는 형태로 추가한다(`findUploadTarget`과 같은 `withAuthorize`를 지난다).

`PATCH`는 `{ orderedIds }`를 받아 `reorderItems`.

- [ ] **Step 5: 파일 개별 라우트를 쓴다**

`app/api/admin/resources/[id]/items/[itemId]/route.ts`. `PATCH`는 이름만, `DELETE`는 `getItem` → `deleteFromR2(item.r2Key)` → `deleteItem`.

- [ ] **Step 6: 타입을 확인하고 커밋한다**

```bash
npx tsc --noEmit
git add app/api/admin/resources
git commit -m "feat(resources): 관리 API — 지울 때는 R2를 먼저, 그래야 고아 객체가 남지 않는다"
```

---

## Task 10: 관리 화면

**Files:**
- Create: `app/admin/resources/page.tsx` (서버 — `requireMenuAccess('resources')`)
- Create: `app/admin/resources/[id]/page.tsx` (서버)
- Create: `components/admin/resources/VaultList.tsx` (클라이언트)
- Create: `components/admin/resources/VaultDetail.tsx` (클라이언트)
- Modify: `app/globals.css` (파일 끝에 `/* ── 공연 자료함(관리) ── */` 블록)

**Interfaces:**
- Consumes: Task 9의 API, `components/*/ShareQrCard.tsx`, `lib/uploadClient.ts`(`uploadFilesDirect`), `lib/i18n/useT`
- Produces: 없음(화면)

- [ ] **Step 1: 목록 페이지**

`app/admin/resources/page.tsx`는 `requireMenuAccess('resources')`로 스스로를 지키고 `listVaults()` 결과를 `VaultList`에 넘긴다. 기존 `app/admin/glossary/page.tsx`의 뼈대를 그대로 따른다(먼저 읽을 것).

`VaultList`가 그리는 것: 번호(큰 글자·복사 버튼) · 제목 · 파일 수 · 총 용량 · 상태 뱃지(활성/꺼짐/만료) · 마지막 열람 · 최근 실패 경고. 상단에 「새 자료함」 버튼 → 모달(제목·비밀번호[생성 버튼 우선]·다운로드 허용·메일 허용·만료일).

비밀번호 입력 옆에 반드시: `계정 비밀번호와 다른 번호를 쓰세요.`

- [ ] **Step 2: 상세 페이지**

`app/admin/resources/[id]/page.tsx` → `VaultDetail`. 네 구역:

1. **번호와 QR** — 번호 큰 글자 + 복사, `<ShareQrCard title={vault.title} path={`/${vault.code}`} />`
2. **비밀번호** — 기본은 `••••••`, 「보기」를 눌러야 드러남. 복호 실패면 「다시 설정해 주세요」. 「새로 만들기」 버튼
3. **파일** — 목록(순서 ↑↓ 버튼, 이름 인라인 편집, 삭제), 「파일 올리기」
4. **설정과 기록** — 다운로드/메일/활성 토글, 만료일, 「받기 링크 모두 무효화」, 접근 기록 표

- [ ] **Step 3: 업로드를 붙인다**

`VaultDetail`의 업로드는 `uploadImageFiles`가 아니라 **`uploadFilesDirect`** 를 쓴다(그쪽은 50MB 상한을 강제한다):

```ts
import { uploadFilesDirect, formatFileSize } from '@/lib/uploadClient';

async function readDuration(file: File): Promise<number | null> {
  if (!file.type.startsWith('audio/')) return null;
  return new Promise((resolve) => {
    const el = document.createElement('audio');
    const url = URL.createObjectURL(file);
    const done = (v: number | null) => { URL.revokeObjectURL(url); resolve(v); };
    el.preload = 'metadata';
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? Math.round(el.duration) : null);
    el.onerror = () => done(null);
    el.src = url;
  });
}

async function upload(files: File[]) {
  const durations: Record<string, number> = {};
  for (const f of files) {
    const d = await readDuration(f);
    if (d !== null) durations[f.name] = d;
  }
  const refs = await uploadFilesDirect(
    `/api/admin/resources/${vaultId}/items`,
    files,
    (done, total) => setProgress({ done, total, bytes: null }),
    (index, sent, total) => setProgress((p) => ({ ...p, bytes: { index, sent, total } }))
  );
  const res = await fetch(`/api/admin/resources/${vaultId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploads: refs, durations: JSON.stringify(durations) }),
  });
  // …응답 처리
}
```

- [ ] **Step 4: CSS를 붙인다**

`app/globals.css` **파일 끝**에 한 덩어리로. 관리 콘솔 규칙: 아이보리 전경은 `rgba(var(--fg-rgb), α)`, 표면은 `var(--surface-2)`, 금색 텍스트는 `var(--soft-gold-text)`/`var(--accent-text)`. 번호를 크게 보이는 자리는 `font-variant-numeric: tabular-nums; letter-spacing: .12em`.

- [ ] **Step 5: 확인하고 커밋한다**

Run: `npx tsc --noEmit && npm run lint:theme && npm run lint:i18n`

```bash
git add app/admin/resources components/admin/resources app/globals.css
git commit -m "feat(resources): 자료함 관리 화면 — 번호와 QR이 맨 위에 있다"
```

---

## Task 11: 파일 중계 (`lib/resources/stream.ts` · file 라우트)

**Files:**
- Create: `lib/resources/stream.ts`
- Create: `app/api/resources/[code]/items/[itemId]/file/route.ts`

**Interfaces:**
- Consumes: `lib/r2/client.ts`(`r2Client`·`R2_BUCKET`), `lib/resources/gate.ts`, `lib/d1/resources.ts`
- Produces: `streamFromR2(key: string, opts: { range: string | null; contentType: string; fileName: string; download: boolean }): Promise<Response>`

- [ ] **Step 1: 중계 모듈을 쓴다**

`lib/resources/stream.ts`:

```ts
/**
 * R2 → 브라우저 중계 (server-only)
 *
 * 왜 서명된 R2 주소를 쓰지 않는가: 우리 버킷은 공개(pub-….r2.dev)다. 서명
 * 주소 안에는 **객체 키가 들어 있고**, 키를 한 번 본 사람은 공개 주소를 조립해
 * 영구히 받을 수 있다. 서명의 만료가 아무 소용이 없다. 그래서 저작권 자료는
 * 키를 절대 내보내지 않고 여기서 흘려보낸다.
 *
 * Range를 그대로 R2에 넘기는 이유는 **구간 이동(시크)** 이다. 음원 재생에서
 * 브라우저는 206을 기대하고, 전체를 200으로만 주면 진행바를 끌 수 없다.
 */

import 'server-only';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET } from '@/lib/r2/client';

export async function streamFromR2(
  key: string,
  opts: { range: string | null; contentType: string; fileName: string; download: boolean }
): Promise<Response> {
  const out = await r2Client.send(
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key, Range: opts.range ?? undefined })
  );
  const body = out.Body as { transformToWebStream?: () => ReadableStream } | undefined;
  if (!body?.transformToWebStream) {
    return new Response('파일을 읽지 못했습니다.', { status: 502 });
  }

  const headers = new Headers({
    'Content-Type': opts.contentType || out.ContentType || 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    // 저작권 자료다 — CDN·프록시에 남기지 않는다
    'Cache-Control': 'private, no-store, max-age=0',
    'Content-Disposition': `${opts.download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(opts.fileName)}`,
  });
  if (out.ContentLength !== undefined) headers.set('Content-Length', String(out.ContentLength));
  if (out.ContentRange) headers.set('Content-Range', out.ContentRange);

  return new Response(body.transformToWebStream(), {
    status: out.ContentRange ? 206 : 200,
    headers,
  });
}
```

- [ ] **Step 2: 라우트를 쓴다**

`app/api/resources/[code]/items/[itemId]/file/route.ts`의 `GET`:

1. `code` 형식 검증 → 아니면 404
2. `getVaultByCode(code)` → 게이트 사실 조립
3. 쿠키 `unlockCookieName(vault.id)` → `verifyUnlockCookie`, 쿼리 `?k=` → `verifyLinkToken`
4. `evaluateGate({ …, need: searchParams.get('dl') === '1' ? 'download' : 'view' })`
5. 거절이면 `locked`→401, `download_denied`→403, 나머지→404
6. `getItem(vault.id, itemId)` → 없으면 404
7. `logAccess({ action: dl ? 'download' : 'play', … })` — **Range 요청 중 `bytes=0-`이 아닌 것은 기록하지 않는다.** 시크 한 번에 기록이 수십 줄 쌓이면 표를 못 읽는다
8. `streamFromR2(item.r2Key, { range: request.headers.get('range'), contentType: item.contentType, fileName: item.fileName, download: dl })`

`export const dynamic = 'force-dynamic';` 를 반드시 둔다.

- [ ] **Step 3: 타입을 확인하고 커밋한다**

```bash
npx tsc --noEmit
git add lib/resources/stream.ts app/api/resources
git commit -m "feat(resources): 파일은 우리가 흘려보낸다 — 키는 브라우저에 닿지 않는다"
```

---

## Task 12: 공개 화면과 잠금 해제

**Files:**
- Create: `app/[code]/page.tsx`
- Create: `components/resources/ResourceLockScreen.tsx`
- Create: `components/resources/ResourceVaultView.tsx`
- Create: `app/api/resources/[code]/unlock/route.ts`
- Modify: `app/globals.css` (`/* ── 공연 자료함(공개) ── */` 블록)
- Modify: `locale/ko.json`, `locale/en.json`

**Interfaces:**
- Consumes: Task 1~5, 11
- Produces: 없음(화면)

- [ ] **Step 1: 진입 페이지**

`app/[code]/page.tsx`:

```tsx
export const dynamic = 'force-dynamic';

export default async function ResourceCodePage({ params, searchParams }: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  const { code } = await params;
  if (!isValidResourceCode(code)) notFound();
  const vault = await getVaultByCode(code);
  if (!vault) notFound();
  // …게이트 판정 → 잠겨 있으면 <ResourceLockScreen code={code} />
  //                열려 있으면 <ResourceVaultView … items={items.map(toPublicItem)} />
}
```

`?k=` 토큰이 유효하면 쿠키를 굽고 **`redirect(`/${code}`)`** 로 토큰을 주소에서 지운다. 쿠키를 서버 컴포넌트에서 굽지 못하므로, 토큰 처리는 라우트 핸들러 `app/api/resources/[code]/unlock/route.ts`의 `GET`으로 보내고 거기서 `Set-Cookie` + `redirect` 한다. 즉 메일 링크는 처음부터 **`/api/resources/473128/unlock?k=…`** 를 가리키게 만든다(Task 13).

**중요**: 잠긴 화면에서는 `vault.title`을 넘기지 않는다.

- [ ] **Step 2: 키패드**

`components/resources/ResourceLockScreen.tsx` (클라이언트):

- 상태: `digits: string`, `busy`, `shake`
- 버튼 1~9, 0, ⌫, 확인. 각 버튼 `min-height: 64px`
- `<input inputMode="numeric" autoComplete="off">`를 숨겨 두지 말고, 물리 키보드는 `useEffect`의 `keydown` 리스너로 받는다(0~9, Backspace, Enter)
- 입력 표시는 `digits.length` 만큼 `●` — **빈 칸을 미리 그리지 않는다**
- 확인 → `POST /api/resources/{code}/unlock` `{ passcode }`
- 실패 시 `shake` 클래스 300ms + `다시 확인해 주세요.` — **남은 시도를 알리지 않는다**
- 429 응답이면 `잠시 후 다시 시도해 주세요.`
- 성공 시 `router.refresh()`

- [ ] **Step 3: 잠금 해제 라우트**

`app/api/resources/[code]/unlock/route.ts`:

`POST` 흐름:
1. `isValidResourceCode` → 아니면 404
2. `hashIp(request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null, secret)`
3. `recentFailures(code, new Date(Date.now() - FAIL_WINDOW_MS).toISOString())` → `evaluateRateLimit`
4. 차단이면 **먼저 400ms 기다린 뒤** 429 + `Retry-After`
5. `getVaultByCode` → 없으면 (기록 남기고) 404
6. `passcodeMatches(vault.passcodeEnc, body.passcode, secret)`
7. 틀리면 `logAccess('unlock_fail')` + 400ms 지연 + 401
8. 맞으면 `logAccess('unlock')` + `Set-Cookie` (`HttpOnly`, `Secure`(프로덕션), `SameSite=Lax`, `Path=/`, `Max-Age=UNLOCK_TTL_MS/1000`)

`GET` 흐름(메일 링크 전용): `?k=` 토큰 검증 → 게이트 → 통과면 `logAccess('link_open')` + 쿠키 + `redirect(`/${code}`)`. 실패면 `redirect(`/${code}`)`(잠긴 화면이 뜬다).

지연은 상수로: `const FAIL_DELAY_MS = 400;`

- [ ] **Step 4: 열린 화면**

`components/resources/ResourceVaultView.tsx` (클라이언트):

- 제목 · 안내 메모 · 목록
- 각 항목: 순번 · 제목 · 길이(`mm:ss`) · 용량 · ▶ 버튼 · ⬇ 버튼(`allowDownload`일 때)
- `<audio ref={…} controls preload="none">` 하나를 재사용하고 `src`를 `/api/resources/{code}/items/{id}/file`로 바꾼다. 다른 곡을 누르면 이전 것이 자동으로 멈춘다(같은 엘리먼트라 저절로)
- 다운로드는 `<a href="…/file?dl=1" download>` — 새 탭이 아니라 같은 창
- `allowEmail`이면 하단에 이메일 입력 + 「받기 링크 보내기」
- 문구는 전부 `useT('resources.…', '한국어')`

- [ ] **Step 5: 공개 CSS**

`app/globals.css` 끝에 추가. **공개 사이트 테마 규칙**: 지면 `var(--ground)`, 표면 `var(--surface-2)`, 전경 `var(--text-color)`/`var(--text-muted)`, 리터럴 금지. 페이지 상단 여백은 `padding-top: var(--page-offset-tight)`.

키패드 버튼:

```css
.rv-key {
  min-height: 64px;
  font-size: 1.5rem;
  font-variant-numeric: tabular-nums;
  background: var(--surface-2);
  color: var(--text-color);
  border: 1px solid rgba(var(--fg-rgb), 0.14);
  border-radius: 12px;
}
.rv-key:active { background: rgba(var(--fg-rgb), 0.08); }
@keyframes rv-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
.rv-dots.is-wrong { animation: rv-shake .3s ease-in-out; }
@media (prefers-reduced-motion: reduce) { .rv-dots.is-wrong { animation: none; } }
```

- [ ] **Step 6: 번역 키를 넣는다**

`locale/ko.json`·`en.json` 양쪽에 `resources.lock.title`·`resources.lock.hint`·`resources.lock.wrong`·`resources.lock.blocked`·`resources.play`·`resources.download`·`resources.email.label`·`resources.email.send`·`resources.email.sent` 등 화면에서 쓴 키를 전부 추가한다.

- [ ] **Step 7: 확인하고 커밋한다**

Run: `npx tsc --noEmit && npm run lint:theme && npm run lint:i18n && npm test`

```bash
git add app/\[code\] components/resources app/api/resources app/globals.css locale
git commit -m "feat(resources): 번호 하나로 여는 화면 — 잠긴 자리는 제목조차 말하지 않는다"
```

---

## Task 13: 받기 링크 메일

**Files:**
- Modify: `lib/mail/events.ts` (`resource.link` 이벤트)
- Modify: `lib/mail/templates/index.ts` (본문 1개)
- Create: `app/api/resources/[code]/email/route.ts`

**Interfaces:**
- Consumes: `lib/mail/notify.ts`(`notifyEvent`), `lib/resources/tokens.ts`(`signLinkToken`), `lib/seoBusiness`(`SITE_URL`)
- Produces: 메일 이벤트 키 `'resource.link'`

- [ ] **Step 1: 이벤트를 등록한다**

`lib/mail/events.ts`의 `MAIL_EVENTS` 배열 끝(`print.feedback` 뒤)에 추가:

```ts
  {
    key: 'resource.link',
    label: '공연 자료 받기 링크',
    description:
      '자료함 화면에서 현장 담당자가 자기 주소를 넣고 요청했을 때. 파일을 붙이지 않고 하루짜리 받기 링크만 보냅니다. 요청한 본인에게만 가고, 링크는 언제든 관리 화면에서 무효화할 수 있습니다.',
    group: 'show',
    audiences: ['user'],
    // 요청한 그 자리에서 "보냈습니다"를 보는 메일이다. 스위치로 끄면
    // 보내신 분은 갔다고 믿은 채 기다린다 — 그래서 끌 수 없다.
    essential: ['user'],
    // 현장 담당자는 우리 회원이 아니다
    allowNonMember: true,
    defaultOn: { user: true },
  },
```

- [ ] **Step 2: 본문을 쓴다**

`lib/mail/templates/index.ts`의 `default:` **앞**에 추가:

```ts
    // 자료함 받기 링크. 파일은 붙이지 않는다 — 링크는 용량 제한이 없고,
    // 나간 뒤에도 무효화할 수 있다.
    case 'resource.link:user':
      return {
        subject: `[${SITE_NAME}] 공연 자료 — ${title}`,
        text: bilingual(
          `요청하신 공연 자료입니다.\n\n${title}\n\n아래 주소를 열면 비밀번호 없이 바로 재생·저장하실 수 있습니다.\n${s(data, 'link')}\n\n이 링크는 24시간 뒤 만료됩니다. 자료의 저작권은 학원과 원저작자에게 있으니 다른 곳에 다시 공유하지 말아 주세요.`,
          `Here are the show files you requested.\n\n${title}\n\nOpen the link below to play or save them — no passcode needed.\n${s(data, 'link')}\n\nThe link expires in 24 hours. These files are copyrighted; please do not share them further.`
        ),
      };
```

- [ ] **Step 3: 발송 라우트를 쓴다**

`app/api/resources/[code]/email/route.ts`의 `POST`:

1. 번호 형식 → `getVaultByCode` → 게이트 `need: 'email'` (쿠키/링크 필요 — **잠긴 사람은 메일을 못 보낸다**)
2. 이메일 형식 검증(간단한 `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)
3. `signLinkToken(vault.id, vault.linkEpoch, secret)` → `${SITE_URL}/api/resources/${code}/unlock?k=${token}`
4. `await notifyEvent('resource.link', { directEmails: [email], data: { title: vault.title, link } })`
5. `logAccess({ action: 'email_sent', detail: email, … })`
6. 결과의 `sent`가 0이면 `{ success: false, error: '메일을 보내지 못했습니다.' }` — **사람이 누른 자리라 결과를 그대로 말한다**

같은 주소로 10분 내 3회를 넘기면 429(발송 남용 방지). `resource_access_log`의 `email_sent` 를 센다.

- [ ] **Step 4: 실제로 한 통 보내 본다**

로컬 dev 서버에서 자료함을 열고 `owenkdev@gmail.com`으로 보낸다. **원장님 주소로 보내지 않는다.**
받은 링크를 다른 브라우저(시크릿 창)에서 열어 비밀번호 없이 열리는지 확인.
관리 화면에서 「받기 링크 모두 무효화」를 누른 뒤 같은 링크가 잠긴 화면으로 떨어지는지 확인.

- [ ] **Step 5: 커밋**

```bash
npx tsc --noEmit && npm run lint:i18n
git add lib/mail/events.ts lib/mail/templates/index.ts app/api/resources
git commit -m "feat(resources): 현장 담당자에겐 파일이 아니라 링크를 — 용량이 없고, 되돌릴 수 있다"
```

---

## Task 14: 전체 검증과 문서

**Files:**
- Modify: `CLAUDE.md` (새 절)

- [ ] **Step 1: 자동 검증 전부**

```bash
npm test && npx tsc --noEmit && npm run lint:theme && npm run lint:i18n && npm run lint
```
Expected: 전부 통과

- [ ] **Step 2: 브라우저로 실제 흐름을 확인한다**

`npm run dev` 후 Playwright로:

1. `/admin/resources` — 자료함 만들기(제목·비밀번호 생성)
2. 상세에서 mp3 2개 업로드 → 순서 바꾸기 → 이름 편집
3. QR이 그려지는지, 번호 복사가 되는지
4. 시크릿 창에서 `/{번호}` → 잠긴 화면에 **제목이 없는지**
5. 틀린 비밀번호 → 흔들림, 남은 시도가 안 보이는지
6. 맞는 비밀번호 → 목록, ▶ 재생, **진행바를 끌어 구간 이동**
7. ⬇ 다운로드 → 파일명이 원본 이름인지
8. 개발자 도구 Network·HTML에서 **`r2.dev`·`r2_key` 문자열이 한 번도 나오지 않는지** (가장 중요)
9. 다운로드 끄기 → 버튼이 사라지고 주소를 직접 쳐도 403인지
10. 자료함 끄기 → 즉시 안 열리는지
11. 두 테마(라이트·다크) 모두 확인

- [ ] **Step 3: 무차별 대입을 실제로 두드려 본다**

```bash
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/resources/<번호>/unlock \
    -H 'Content-Type: application/json' -d '{"passcode":"0000"}'
done
```
Expected: 앞의 아홉 번은 401, 열 번째부터 429

- [ ] **Step 4: CLAUDE.md에 절을 더한다**

「공연 자료함 — 번호로 여는 자리는 키를 내보내지 않는다」 절. 담을 것: ① 버킷이 공개라 `r2_key`가 나가면 끝이라는 사실과 그래서 presigned GET도 안 쓴다는 것 ② 게이트는 `lib/resources/gate.ts` 하나뿐이라는 것 ③ 비밀번호가 해시가 아닌 이유 ④ 새 업로드 자리를 만들면 `uploadPolicy`·`uploadTargets` 두 곳에 한 줄씩이라는 기존 규칙이 여기에도 적용된다는 것.

- [ ] **Step 5: 마지막 커밋**

```bash
git add CLAUDE.md
git commit -m "docs: 공연 자료함 — 번호로 여는 자리는 키를 내보내지 않는다"
```

- [ ] **Step 6: 푸시하지 않는다**

브랜치 `feat/resource-vault`에 커밋만 쌓아 두고 멈춘다. 사용자가 아침에 검토한 뒤 머지·배포를 결정한다.

---

## Self-Review

**스펙 대조** — §1 자료함 묶음(T7·T10) · §2 결정 6건(전부) · §3 키 비노출(T11·T14 Step 2-8) · §4 표 셋(T7) · §5 모듈 경계(T1~T5·T11, `accessToken.ts`→`tokens.ts` 개명 명시) · §6 가역 암호(T2·T9) · §7 공개 화면·API·차단(T11·T12) · §8 관리(T8~T10) · §9 시험(각 Task + T14) · §10 범위 밖(계획에 없음 — 맞다) · §11 배포(T7 Step 5, T14 Step 6)

**빠진 것 하나 발견 → 채움**: 스펙 §8은 「받기 링크 모두 무효화」를 별도 라우트로 적었으나, 계획에서는 `PATCH /api/admin/resources/[id]`의 `revokeLinks: true`로 합쳤다(같은 표의 같은 행을 고치는 일이라 라우트를 나눌 이유가 없다). 스펙 §8의 라우트 목록보다 이 계획이 우선한다.

**타입 일관성** — `GateVaultFacts.linkEpoch`(T5) ↔ `ResourceVault.linkEpoch`(T7) ↔ `signLinkToken(vaultId, epoch, …)`(T3) 이름 일치. `FailureSample { ipHash, at }`(T4) ↔ `recentFailures()` 반환(T7) 일치. `toPublicItem`(T7)이 `ResourceItemPublic`(T7)을 낳고 T12가 그것만 받는다.
