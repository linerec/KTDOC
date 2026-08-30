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
  /** 이 비율(%)을 넘으면 경고 */
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
  /** 답장 받을 주소. 인증 불필요 — 늘 쓰는 메일함을 넣는다. */
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
  /** 첨부 흔적 JSON — [{"name","size"}]. 첨부가 없었으면 null. */
  attachments: string | null;
  created_at: string;
}

/** 사용량 게이지가 쓰는 집계값 */
export interface MailUsage {
  dailySent: number;
  monthlySent: number;
}
