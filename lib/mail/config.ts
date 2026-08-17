/**
 * 메일 설정 — 스키마·기본값·깊은 병합·시크릿 마스킹 (순수 함수만)
 *
 * D1 접근은 store.ts가 맡는다. 이 파일이 순수해야 시험이 붙는다
 * (node --test는 '@/' 별칭을 값 import로 해석하지 못한다).
 *
 * 읽을 때 항상 기본값과 깊은 병합한다 — 나중에 필드를 추가해도 옛 저장본이
 * 깨지지 않는다. 시크릿은 응답에 담지 않고, 빈 값으로 덮어쓰지 않는다
 * (매번 재입력을 요구하면 다른 칸을 고칠 때마다 키가 지워진다).
 */

import type {
  MailConfig,
  MailEventSwitches,
  MailProvider,
  PublicMailConfig,
  SmtpConfig,
} from '@/types/mail';

/** D1 site_settings의 키 */
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
      // 채널 한 겹을 그대로 보존한다 — 나중에 push가 붙으면 이 자리에 늘어난다.
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
      monthlyLimit: int(
        q.monthlyLimit,
        DEFAULT_MAIL_CONFIG.quota.monthlyLimit,
        1,
        10_000_000
      ),
      warnAtPercent: int(
        q.warnAtPercent,
        DEFAULT_MAIL_CONFIG.quota.warnAtPercent,
        1,
        100
      ),
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
  if (typeof p.fromName === 'string') {
    next.fromName = p.fromName.trim().slice(0, 100);
  }
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
    if (typeof s.port === 'number') {
      next.smtp.port = int(s.port, next.smtp.port, 1, 65535);
    }
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
      next.quota.monthlyLimit = int(
        q.monthlyLimit,
        next.quota.monthlyLimit,
        1,
        10_000_000
      );
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
