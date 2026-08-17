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
  /** 실패 사유 — 테스트 발송 화면과 발송 내역이 그대로 보여준다 */
  detail?: string;
  /** provider가 준 메시지 id (추적용) */
  providerId?: string;
  /** Resend가 헤더로 알려준 그 시점의 사용량 (자체 집계와 대조용) */
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
    if (!config.smtp.host.trim()) {
      return { provider: 'none', reason: 'smtp-no-host' };
    }
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
    const body = await res.text().catch(() => '');
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
 */
export async function sendMail(
  resolved: ResolvedMailConfig,
  message: MailMessage
): Promise<SendMailResult> {
  if (resolved.provider === 'none') {
    console.warn(
      `[mail] 미설정(${resolved.reason}) — 발송 건너뜀: ${message.subject}`
    );
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
