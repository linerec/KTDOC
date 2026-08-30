/**
 * 업로드 티켓 — "이 파일을 여기에 올려도 좋다"는 짧은 허가증 (순수 함수)
 *
 * 브라우저가 R2로 직접 올리게 되면서, 서버는 파일을 보지 못한 채 두 번 판단한다:
 * 서명할 때 한 번, 다 올라온 뒤 기록할 때 한 번. 그 사이를 잇는 것이 티켓이다.
 *
 * 티켓이 없으면 두 번째 판단이 클라이언트의 말을 그대로 믿어야 한다 — "이 키를
 * 올렸으니 기록해 주세요"에서 키를 바꿔 부르면 남의 파일을 제 기록에 붙일 수
 * 있다. 서명이 그 말을 **우리가 방금 한 말**로 묶어 준다.
 *
 * 저장소를 두지 않는다(HMAC 자체가 근거다) — 티켓 한 장 때문에 D1에 표를 만들면
 * 업로드마다 쓰기가 생기고, 그 표를 청소하는 일이 또 생긴다.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface UploadTicketClaims {
  /** R2 객체 키(원본이 올라갈 자리) */
  key: string;
  /** 등록소 키 — 다른 용도로 돌려쓰지 못하게 묶는다 */
  target: string;
  /** 서명할 때 못박은 Content-Type. R2 서명에도 같은 값이 들어간다. */
  contentType: string;
  /** 클라이언트가 신고한 크기(바이트). 최종 확인은 업로드 후 실측으로 한다. */
  size: number;
  /** 티켓을 받은 사람 */
  user: string;
  /** 만료 시각(epoch ms) */
  exp: number;
}

export type TicketFailure =
  | 'malformed'
  | 'bad-signature'
  | 'expired'
  | 'wrong-user'
  | 'wrong-target';

function encode(claims: UploadTicketClaims): string {
  return Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/** 티켓 한 장. 형태는 `<payload>.<signature>` — 쿠키도 헤더도 아니라 본문에 실린다. */
export function signTicket(claims: UploadTicketClaims, secret: string): string {
  const payload = encode(claims);
  return `${payload}.${sign(payload, secret)}`;
}

export interface VerifyOptions {
  secret: string;
  /** 지금 시각(테스트가 시간을 고정할 수 있게 주입받는다) */
  now?: number;
  /** 이 사람의 티켓이어야 한다 */
  user?: string;
  /** 이 용도의 티켓이어야 한다 */
  target?: string;
}

export type VerifyResult =
  | { ok: true; claims: UploadTicketClaims }
  | { ok: false; reason: TicketFailure };

export function verifyTicket(token: string, options: VerifyOptions): VerifyResult {
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'malformed' };

  const [payload, signature] = parts;
  const expected = sign(payload, options.secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  // 길이가 다르면 timingSafeEqual이 던진다 — 길이 비교를 먼저(둘 다 '틀림'이다)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad-signature' };
  }

  let claims: UploadTicketClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!claims?.key || !claims.target) return { ok: false, reason: 'malformed' };

  const now = options.now ?? Date.now();
  if (!Number.isFinite(claims.exp) || claims.exp < now) return { ok: false, reason: 'expired' };
  if (options.user !== undefined && claims.user !== options.user) {
    return { ok: false, reason: 'wrong-user' };
  }
  if (options.target !== undefined && claims.target !== options.target) {
    return { ok: false, reason: 'wrong-target' };
  }
  return { ok: true, claims };
}

/**
 * R2 객체 키를 만든다.
 *
 * 이름 규칙은 lib/r2/upload.ts(uploadToR2)와 같다 — 같은 버킷에 두 경로로
 * 들어오는 파일이 서로 다른 규칙을 갖게 두지 않는다. 난수 접미사가 있는 이유도
 * 같다: 같은 밀리초에 같은 이름이 올라와도 앞 객체를 덮어쓰지 않게.
 */
export function buildObjectKey(folder: string, filename: string, now = Date.now()): string {
  const safe = (filename.split(/[\\/]/).pop() ?? 'file').replace(/[^a-zA-Z0-9.-]/g, '_');
  const unique = Math.random().toString(36).slice(2, 8);
  return `${trimSlashes(folder)}/${now}-${unique}-${safe || 'file'}`;
}

/**
 * 원본이 누울 자리. 표시용 파생본과 **다른 접두사**에 둔다 —
 * 대시보드에서 한눈에 갈리고, 나중에 보관 정책(수명·요금제)을 접두사 단위로
 * 걸 수 있다.
 */
export function originalKeyFor(displayKey: string): string {
  return `originals/${displayKey}`;
}

function trimSlashes(s: string): string {
  return s.replace(/^\/+|\/+$/g, '');
}

/** 파생본 키 — 정규화가 확장자를 바꾸면(webp) 키도 따라간다. */
export function derivativeKeyFor(originalDisplayKey: string, newFilename: string): string {
  const dir = originalDisplayKey.split('/').slice(0, -1).join('/');
  const base = originalDisplayKey.split('/').pop() ?? '';
  // 원본 키의 timestamp-random 접두사를 유지해 두 파일이 눈으로 이어지게 한다
  const prefix = base.match(/^(\d+-[a-z0-9]+)-/)?.[1];
  const safe = newFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return dir ? `${dir}/${prefix ? `${prefix}-` : ''}${safe}` : safe;
}
