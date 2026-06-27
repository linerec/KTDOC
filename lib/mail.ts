/**
 * 공용 메일 발송 (Gmail SMTP / nodemailer)
 *
 * 신청·피드백 라우트에 흩어져 있던 전송 설정을 한 곳으로. 자격증명(GMAIL_USER·
 * GMAIL_APP_PASSWORD)이 없으면 조용히 건너뛴다(개발/미설정 환경에서 크래시 방지).
 */

import nodemailer, { type Transporter } from 'nodemailer';

export function isMailConfigured(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

let cached: Transporter | null = null;

function getTransport(): Transporter | null {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');
  if (!user || !pass) return null;
  if (!cached) {
    cached = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
    });
  }
  return cached;
}

interface SendMailOptions {
  to?: string | string[];
  /** 수신자 노출을 막아야 할 단체 발송에 사용(개인정보 보호) */
  bcc?: string | string[];
  subject: string;
  text: string;
  html?: string;
}

/** 메일 1건 발송. 성공 true, 자격증명 없음/실패 false. 예외를 던지지 않는다. */
export async function sendMail(opts: SendMailOptions): Promise<boolean> {
  const t = getTransport();
  if (!t) {
    console.warn('[mail] GMAIL 자격증명 없음 — 발송 건너뜀:', opts.subject);
    return false;
  }
  try {
    await t.sendMail({
      from: `"KTDOC 춤누리" <${process.env.GMAIL_USER}>`,
      to: opts.to ?? process.env.GMAIL_USER,
      bcc: opts.bcc,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return true;
  } catch (err) {
    console.error('[mail] 발송 실패:', opts.subject, err);
    return false;
  }
}
