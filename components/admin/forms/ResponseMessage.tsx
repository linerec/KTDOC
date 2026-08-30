'use client';

/**
 * ResponseMessage — 이 신청을 하신 분께 메일 한 통
 *
 * 메모 바로 아래에 둔다. 위는 **우리끼리 남기는 기록**이고 여기는 **밖으로
 * 나가는 말**이다. 두 칸이 나란히 있으면 헷갈리기 쉬워서, 헷갈림의 결과가
 * 되돌릴 수 없는 쪽(발송)에 안전장치를 건다:
 *
 *  1. 보내기 전에 **어디로 가는지**를 주소까지 보여 준다. 신청서에 적힌 주소와
 *     회원 계정 주소, 보호자 주소가 다를 수 있고 실제로 다르다.
 *  2. '보내기'는 곧바로 보내지 않는다 — 받는 사람·제목·본문을 그대로 다시
 *     보여 주고 한 번 더 확인받는다. 메일은 취소가 없다.
 *  3. 보낸 뒤에는 **정말 나갔는지**를 그대로 말한다. 실패했는데 "보냈습니다"를
 *     띄우면 오지 않을 답장을 기다리게 된다.
 *
 * 쓰다 만 글은 브라우저에 남겨 둔다 — 길게 쓰다 실수로 화면을 옮기면 다시 쓸
 * 마음이 나지 않는다. 다만 **첨부는 남지 않는다** — 파일은 브라우저에 담아 둘
 * 수 없고, 담아 둔 척하면 다음에 와서 붙은 줄 알고 그냥 보낸다.
 *
 * 첨부의 판정(개수·크기·형식)은 lib/mail/attachments.ts 한 곳에 있다. 여기서
 * 하는 일은 **고르는 순간에 그 판정을 보여 주는 것**이다 — 보내기를 누른 뒤에야
 * "너무 큽니다"를 만나면, 방금 쓴 글을 두고 파일부터 다시 고민하게 된다.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatInboxWhen } from '@/components/admin/notify/timeFormat';
import { uploadFilesDirect } from '@/lib/uploadClient';
import {
  checkAttachments,
  describeAttachmentProblem,
  formatAttachmentSize,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_MB,
  MAX_ATTACHMENTS_TOTAL_BYTES,
  MAX_ATTACHMENTS_TOTAL_MB,
  type MailAttachmentNote,
} from '@/lib/mail/attachments';
import type { MailLogStatus } from '@/types/mail';

interface Recipient {
  key: string;
  email: string;
  name: string | null;
  role: 'applicant' | 'account' | 'guardian';
  note: string;
  defaultOn: boolean;
  blocked: 'opted-out' | 'invalid-address' | null;
}

interface Sending {
  ready: boolean;
  reason: 'no-provider' | 'switch-off' | 'no-recipients' | null;
  replyTo: string;
  fromName: string;
  from: string;
}

interface HistoryItem {
  id: number;
  eventKey: string;
  eventLabel: string;
  handwritten: boolean;
  to: string;
  subject: string;
  body: string | null;
  bodyRedacted: boolean;
  status: MailLogStatus;
  detail: string | null;
  /** 그때 함께 나간 파일들 — 이름·크기만 남는다(내용은 보관하지 않는다) */
  attachments: MailAttachmentNote[];
  createdAt: string;
}

interface Loaded {
  recipients: Recipient[];
  defaultKeys: string[];
  sending: Sending;
  history: HistoryItem[];
}

const BLOCK_TEXT: Record<NonNullable<Recipient['blocked']>, string> = {
  'opted-out': '이메일 수신을 꺼두신 분입니다 — 전화로 연락해 주세요',
  'invalid-address': '주소 형식이 올바르지 않습니다',
};

const STATUS_TEXT: Record<MailLogStatus, string> = {
  sent: '보냄',
  failed: '실패',
  skipped: '보내지 않음',
  quota_blocked: '한도 초과',
};

/**
 * 자주 쓰는 첫 문장. 빈 화면 앞에서 멈추지 않게 하는 것이 목적이라,
 * 인사와 맺음말만 채우고 **가운데는 비워 둔다** — 하고 싶은 말은 사람이 쓴다.
 */
const QUICK: { id: string; label: string; subject: string; body: (name: string) => string }[] = [
  {
    id: 'confirm',
    label: '확인 부탁',
    subject: 'KTDOC 신청서 확인 부탁드립니다',
    body: (name) =>
      `안녕하세요, ${name} 님.\n\n보내주신 신청서 잘 받았습니다. 확인이 필요한 부분이 있어 연락드립니다.\n\n\n\n답장 주시면 이어서 안내드리겠습니다. 감사합니다.`,
  },
  {
    id: 'class',
    label: '수업 안내',
    subject: 'KTDOC 수업 안내드립니다',
    body: (name) =>
      `안녕하세요, ${name} 님.\n\n신청해 주신 수업에 대해 안내드립니다.\n\n\n\n궁금하신 점은 이 메일로 답장 주세요. 감사합니다.`,
  },
  {
    id: 'payment',
    label: '수강료 안내',
    subject: 'KTDOC 수강료 안내',
    body: (name) =>
      `안녕하세요, ${name} 님.\n\n수강료를 안내드립니다.\n\n\n\n확인 후 알려주시면 등록을 마무리하겠습니다. 감사합니다.`,
  },
];

interface ResponseMessageProps {
  formId: number;
  responseId: number;
  studentName: string;
  /** 보낼 주소가 없을 때 대안을 말해 주기 위해 */
  phone: string | null;
}

export default function ResponseMessage({
  formId,
  responseId,
  studentName,
  phone,
}: ResponseMessageProps) {
  const router = useRouter();
  const base = `/api/admin/forms/${formId}/responses/${responseId}/messages`;
  const draftKey = `ktdoc.responseMessage.${responseId}`;

  const [data, setData] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [openItem, setOpenItem] = useState<number | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  /**
   * 초안을 아직 읽지 않았을 때 저장 이펙트가 돌면, 복원되기 전의 빈 값으로
   * 저장본을 지운다. 상태로 둬야 복원된 값이 화면에 반영된 **다음 렌더**에서
   * 저장이 시작된다(ref로 두면 같은 커밋에서 빈 값이 먼저 지나간다).
   */
  const [draftRestored, setDraftRestored] = useState(false);

  const load = useCallback(
    async (keepPicked: boolean) => {
      try {
        const res = await fetch(base, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setLoadError(json.error || '불러오지 못했습니다.');
          return;
        }
        const next = json.data as Loaded;
        setData(next);
        setLoadError('');
        if (!keepPicked) setPicked(next.defaultKeys);
      } catch {
        setLoadError('연결이 끊어졌습니다.');
      }
    },
    [base]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  // 쓰다 만 글 복원 — 브라우저에만 남는다(서버에 초안을 두지 않는다).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw) as { subject?: string; body?: string };
        if (d.subject) setSubject(d.subject);
        if (d.body) setBody(d.body);
      }
    } catch {
      /* 초안이 깨졌으면 조용히 빈 화면으로 시작한다 */
    }
    setDraftRestored(true);
  }, [draftKey]);

  useEffect(() => {
    if (!draftRestored) return;
    try {
      if (subject || body) {
        window.localStorage.setItem(draftKey, JSON.stringify({ subject, body }));
      } else {
        window.localStorage.removeItem(draftKey);
      }
    } catch {
      /* 저장 공간이 막혀 있어도 글쓰기를 막지는 않는다 */
    }
  }, [draftRestored, draftKey, subject, body]);

  const recipients = data?.recipients ?? [];
  const openRecipients = recipients.filter((r) => !r.blocked);
  const chosen = recipients.filter((r) => picked.includes(r.key) && !r.blocked);
  const canWrite = Boolean(data?.sending.ready);
  const canSend = canWrite && chosen.length > 0 && subject.trim() !== '' && body.trim() !== '';
  const totalAttached = files.reduce((sum, f) => sum + f.size, 0);
  const gaugePercent = Math.min(100, (totalAttached / MAX_ATTACHMENTS_TOTAL_BYTES) * 100);

  const toggle = (key: string) => {
    setPicked((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    setConfirming(false);
  };

  /**
   * 고른 파일을 더한다. 한도를 넘기면 **더하지 않고 이유를 말한다** — 일부만
   * 조용히 받으면 어느 파일이 빠졌는지 모른 채 보내게 된다.
   */
  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const merged = [...files];
    for (const f of Array.from(list)) {
      // 같은 파일을 두 번 고르는 실수는 조용히 걸러 준다(이름+크기가 같으면 같은 파일)
      if (!merged.some((m) => m.name === f.name && m.size === f.size)) merged.push(f);
    }
    const problem = checkAttachments(merged.map((f) => ({ name: f.name, size: f.size })));
    if (problem) {
      setFileError(describeAttachmentProblem(problem));
      return;
    }
    setFileError('');
    setFiles(merged);
    setResult(null);
    setConfirming(false);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFileError('');
    setConfirming(false);
  };

  const applyQuick = (id: string) => {
    const q = QUICK.find((x) => x.id === id);
    if (!q) return;
    setSubject(q.subject);
    setBody(q.body(studentName));
    setResult(null);
    setConfirming(false);
  };

  async function send() {
    setSending(true);
    setResult(null);
    try {
      // 첨부는 이 라우트를 지나지 않는다 — 브라우저가 R2로 곧장 올리고,
      // 여기에는 "올렸습니다"라는 티켓만 실어 보낸다(Vercel 본문 4.5MB 회피).
      // 서버가 그 파일을 다시 읽어 메일에 싣고, 보낸 뒤 지운다.
      const uploads = await uploadFilesDirect(base, files);

      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          body: body.trim(),
          to: picked,
          uploads,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setResult({ kind: 'err', text: json.error || '보내지 못했습니다.' });
        setConfirming(false);
        return;
      }
      setResult({ kind: 'ok', text: json.data?.message || '보냈습니다.' });
      setSubject('');
      setBody('');
      setFiles([]);
      setFileError('');
      setConfirming(false);
      setShowHistory(true);
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        /* 지우지 못해도 발송은 끝났다 */
      }
      await load(true);
      // 처리 이력에도 한 줄 남았으므로 왼쪽 본문을 다시 그린다.
      router.refresh();
    } catch (err) {
      // 첨부를 올리다 실패했으면 메일은 아직 나가지 않았다 — 그 사실을 그대로 말한다
      const message =
        err instanceof Error && err.name === 'UploadError'
          ? `${err.message} (메일은 아직 보내지 않았습니다.)`
          : '연결이 끊어졌습니다. 보내졌는지 아래 내역에서 확인해 주세요.';
      setResult({ kind: 'err', text: message });
      setConfirming(false);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="admin-card resp-panel resp-mail">
      <h2 className="resp-panel-title">메일 보내기</h2>
      <p className="resp-mail-lead">
        여기 쓴 내용은 <strong>실제로 신청하신 분께 메일로 나갑니다.</strong> 내부 기록은 위
        메모에 남겨 주세요.
      </p>

      {loadError && (
        <div className="admin-alert admin-alert-error" role="alert">
          {loadError}
        </div>
      )}

      {!data && !loadError && <p className="admin-field-help">불러오는 중…</p>}

      {data && (
        <>
          {/* ── 못 보내는 상태라면 이유부터 ── */}
          {data.sending.reason === 'no-provider' && (
            <div className="admin-alert admin-alert-error" role="alert">
              메일 발송이 아직 설정되지 않았습니다. 관리자에게 이메일 설정(발신 주소·API 키)을
              요청해 주세요.
            </div>
          )}
          {data.sending.reason === 'switch-off' && (
            <div className="admin-alert admin-alert-error" role="alert">
              이메일 설정에서 ‘신청 건 개별 메시지’가 꺼져 있어 보낼 수 없습니다. 관리자에게 켜
              달라고 요청해 주세요.
            </div>
          )}
          {data.sending.reason === 'no-recipients' && (
            <div className="admin-alert admin-alert-error" role="alert">
              {recipients.length === 0 ? (
                <>
                  이 신청에는 이메일 주소가 없습니다.
                  {phone ? ` 전화(${phone})로 연락하시거나, ` : ' '}
                  위에서 회원과 연결하면 계정 주소로 보낼 수 있습니다.
                </>
              ) : (
                <>
                  보낼 수 있는 주소가 없습니다 — 아래 주소가 모두 막혀 있습니다.
                  {phone ? ` 전화(${phone})로 연락해 주세요.` : ''}
                </>
              )}
            </div>
          )}

          {/* ── 받는 사람 ── */}
          {recipients.length > 0 && (
            <div className="resp-mail-to">
              <span className="resp-mail-label">받는 사람</span>
              {recipients.map((r) => (
                <label
                  key={r.key}
                  className={`resp-mail-rcpt${r.blocked ? ' is-blocked' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={!r.blocked && picked.includes(r.key)}
                    onChange={() => toggle(r.key)}
                    disabled={Boolean(r.blocked) || sending}
                  />
                  <span className="resp-mail-rcpt-body">
                    <span className="resp-mail-rcpt-name">
                      {r.name ?? studentName}
                      {r.role === 'guardian' && <span className="resp-mail-tag">보호자</span>}
                    </span>
                    <span className="resp-mail-rcpt-mail">{r.email}</span>
                    <span className="admin-cell-sub">
                      {r.blocked ? BLOCK_TEXT[r.blocked] : r.note}
                    </span>
                  </span>
                </label>
              ))}
              {openRecipients.length > 1 && (
                <p className="admin-field-help">
                  체크한 분들께 <strong>각각 따로</strong> 갑니다 — 서로의 주소는 보이지 않습니다.
                </p>
              )}
            </div>
          )}

          {/* ── 쓰기 / 확인 ── */}
          {canWrite && !confirming && (
            <>
              <div className="resp-mail-quick">
                <span className="resp-mail-label">빠른 시작</span>
                <div className="resp-mail-quick-row">
                  {QUICK.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      className="resp-mail-chip"
                      onClick={() => applyQuick(q.id)}
                      disabled={sending}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="admin-field">
                <label htmlFor="rm-subject">제목</label>
                <input
                  id="rm-subject"
                  type="text"
                  value={subject}
                  maxLength={200}
                  placeholder="예: KTDOC 수업 안내드립니다"
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={sending}
                />
              </div>

              <div className="admin-field">
                <label htmlFor="rm-body">내용</label>
                <textarea
                  id="rm-body"
                  rows={8}
                  value={body}
                  maxLength={4000}
                  placeholder={`안녕하세요, ${studentName} 님.\n\n`}
                  onChange={(e) => setBody(e.target.value)}
                  disabled={sending}
                />
              </div>

              <div className="resp-mail-files">
                <span className="resp-mail-label">첨부</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  hidden
                  onChange={(e) => {
                    addFiles(e.target.files);
                    // 같은 파일을 지웠다가 다시 고를 수 있게 입력값을 비운다
                    e.target.value = '';
                  }}
                />
                {files.length > 0 && (
                  <ul className="resp-mail-file-list">
                    {files.map((f, i) => (
                      <li key={`${f.name}-${f.size}-${i}`} className="resp-mail-file">
                        <span className="resp-mail-file-name">{f.name}</span>
                        <span className="resp-mail-file-size">
                          {formatAttachmentSize(f.size)}
                        </span>
                        <button
                          type="button"
                          className="resp-mail-file-remove"
                          onClick={() => removeFile(i)}
                          disabled={sending}
                          aria-label={`${f.name} 빼기`}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="resp-mail-file-actions">
                  <button
                    type="button"
                    className="resp-mail-chip"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || files.length >= MAX_ATTACHMENTS}
                  >
                    파일 고르기
                  </button>
                  <span className="admin-cell-sub">
                    {files.length > 0
                      ? `${files.length}개 · 합계 ${formatAttachmentSize(totalAttached)} / ${MAX_ATTACHMENTS_TOTAL_MB}MB`
                      : `${MAX_ATTACHMENTS}개까지, 파일 하나 ${MAX_ATTACHMENT_MB}MB·합계 ${MAX_ATTACHMENTS_TOTAL_MB}MB까지`}
                  </span>
                </div>
                {files.length > 0 && (
                  <div
                    className="resp-mail-file-gauge"
                    role="presentation"
                    data-warn={totalAttached > MAX_ATTACHMENTS_TOTAL_BYTES * 0.8 ? 'true' : undefined}
                  >
                    <span style={{ width: `${gaugePercent}%` }} />
                  </div>
                )}
                {fileError && (
                  <p className="resp-mail-file-error" role="alert">
                    {fileError}
                  </p>
                )}
              </div>

              <p className="admin-field-help">
                쓰신 그대로 나갑니다(자동 번역·자동 인사말 없음). 맨 끝에 ‘{data.sending.fromName}’
                서명이 붙습니다. 답장은 <strong>{data.sending.replyTo || data.sending.from}</strong>
                으로 옵니다.
                {files.length > 0 && ' 첨부한 파일은 이 화면을 벗어나면 다시 골라야 합니다.'}
              </p>

              <button
                type="button"
                className="admin-btn admin-btn-gold"
                onClick={() => {
                  setResult(null);
                  setConfirming(true);
                }}
                disabled={!canSend || sending}
              >
                보내기
              </button>
              {!canSend && (subject.trim() || body.trim()) && chosen.length === 0 && (
                <p className="admin-field-help">받는 사람을 한 명 이상 골라 주세요.</p>
              )}
            </>
          )}

          {canWrite && confirming && (
            <div className="resp-mail-confirm">
              <p className="resp-mail-confirm-title">이대로 보냅니다 — 보낸 메일은 되돌릴 수 없습니다.</p>
              <dl className="resp-mail-confirm-head">
                <div>
                  <dt>받는 사람</dt>
                  <dd>
                    {chosen.map((r) => (
                      <span key={r.key} className="resp-mail-confirm-to">
                        {r.name ?? studentName} &lt;{r.email}&gt;
                      </span>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt>제목</dt>
                  <dd>{subject}</dd>
                </div>
                {files.length > 0 && (
                  <div>
                    <dt>첨부</dt>
                    <dd>
                      {files.map((f, i) => (
                        <span key={`${f.name}-${i}`}>
                          {f.name} ({formatAttachmentSize(f.size)})
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
              <pre className="resp-mail-preview">{body}</pre>
              <div className="resp-mail-confirm-actions">
                <button
                  type="button"
                  className="admin-btn admin-btn-gold"
                  onClick={send}
                  disabled={sending}
                >
                  {sending ? '보내는 중…' : `네, ${chosen.length}명에게 보냅니다`}
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-outline"
                  onClick={() => setConfirming(false)}
                  disabled={sending}
                >
                  고쳐 쓰기
                </button>
              </div>
            </div>
          )}

          {result && (
            <div
              className={`admin-alert ${result.kind === 'ok' ? 'admin-alert-success' : 'admin-alert-error'}`}
              role="status"
            >
              {result.text}
            </div>
          )}

          {/* ── 보낸 내역 ── */}
          <div className="resp-mail-history">
            <button
              type="button"
              className="resp-more-toggle"
              onClick={() => setShowHistory((v) => !v)}
              aria-expanded={showHistory}
            >
              보낸 메일 {data.history.length}건 {showHistory ? '▾' : '▸'}
            </button>
            {showHistory &&
              (data.history.length === 0 ? (
                <p className="admin-field-help">아직 이 주소로 나간 메일이 없습니다.</p>
              ) : (
                <>
                  <p className="admin-field-help">
                    위 주소로 나간 메일 전부입니다 — 접수 확인처럼 자동으로 나간 것도 함께
                    보입니다. 눌러서 내용을 볼 수 있습니다.
                  </p>
                  <ul className="resp-mail-log">
                    {data.history.map((h) => (
                      <li key={h.id} className={h.status === 'sent' ? '' : 'is-failed'}>
                        <button
                          type="button"
                          className="resp-mail-log-head"
                          onClick={() => setOpenItem((v) => (v === h.id ? null : h.id))}
                          aria-expanded={openItem === h.id}
                        >
                          <span className="resp-mail-log-when">
                            {formatInboxWhen(h.createdAt, 'ko')}
                          </span>
                          <span className="resp-mail-log-subject">{h.subject}</span>
                          <span className="resp-mail-log-meta">
                            {h.handwritten ? '직접 쓴 메일' : h.eventLabel} ·{' '}
                            {STATUS_TEXT[h.status]}
                          </span>
                        </button>
                        {openItem === h.id && (
                          <div className="resp-mail-log-body">
                            <p className="admin-cell-sub">받는 사람: {h.to}</p>
                            {h.status !== 'sent' && h.detail && (
                              <p className="admin-cell-sub">사유: {h.detail}</p>
                            )}
                            {h.attachments.length > 0 && (
                              <p className="admin-cell-sub">
                                첨부:{' '}
                                {h.attachments
                                  .map((a) => `${a.name} (${formatAttachmentSize(a.size)})`)
                                  .join(', ')}
                              </p>
                            )}
                            {h.body ? (
                              <pre className="resp-mail-preview">{h.body}</pre>
                            ) : (
                              <p className="admin-field-help">
                                {h.bodyRedacted
                                  ? '보안을 위해 본문을 저장하지 않는 메일입니다.'
                                  : '저장된 본문이 없습니다.'}
                              </p>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              ))}
          </div>
        </>
      )}
    </section>
  );
}
