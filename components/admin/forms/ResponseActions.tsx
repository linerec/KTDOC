'use client';

/**
 * ResponseActions — 응답 하나를 처리한다
 *
 * 상태 바꾸기 · 메모 · 민감정보 펼치기 · 회원 연결 · 수업 배정.
 * 상태 전이에 규칙을 두지 않는다 — 옛 시스템의 문제는 자유 전이가 아니라
 * 무기록이었다. 무엇을 하든 이력에 남는다.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MANUAL_RESPONSE_STATUSES,
  RESPONSE_STATUS_LABEL,
} from '@/lib/forms/responseLabels';
import type { ResponseStatus } from '@/types/forms';

const STATUS_CHOICES: Array<{ value: ResponseStatus; label: string }> =
  MANUAL_RESPONSE_STATUSES.map((s) => ({ value: s, label: RESPONSE_STATUS_LABEL[s] }));

interface MemberHit {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  status: string;
}

interface ResponseActionsProps {
  formId: number;
  responseId: number;
  status: ResponseStatus;
  hasMedical: boolean;
  linkedUserId: string | null;
  linkedUserName: string | null;
  studentName: string;
  email: string | null;
}

export default function ResponseActions({
  formId,
  responseId,
  status,
  hasMedical,
  linkedUserId,
  linkedUserName,
  studentName,
  email,
}: ResponseActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [nextStatus, setNextStatus] = useState<ResponseStatus>(status);
  const [note, setNote] = useState('');

  const [medical, setMedical] = useState<Array<{ key: string; label: string; value: string }> | null>(
    null
  );

  const [query, setQuery] = useState(studentName || email || '');
  const [hits, setHits] = useState<MemberHit[] | null>(null);

  const base = `/api/admin/forms/${formId}/responses/${responseId}`;

  async function send(url: string, init?: RequestInit) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(url, init);
      const json = await res.json();
      setBusy(false);
      if (!res.ok || !json.success) {
        setMsg({ kind: 'err', text: json.error || '처리하지 못했습니다.' });
        return null;
      }
      return json.data;
    } catch {
      setBusy(false);
      setMsg({ kind: 'err', text: '연결이 끊어졌습니다.' });
      return null;
    }
  }

  async function saveStatus() {
    if (nextStatus === status && !note.trim()) {
      setMsg({ kind: 'err', text: '바뀐 것이 없습니다.' });
      return;
    }
    const ok = await send(base, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus, note }),
    });
    if (ok) {
      setNote('');
      setMsg({ kind: 'ok', text: '저장했습니다.' });
      router.refresh();
    }
  }

  async function reveal() {
    const data = await send(`${base}/reveal`, { method: 'POST' });
    if (data) setMedical(data.items ?? []);
  }

  async function search() {
    if (query.trim().length < 2) {
      setMsg({ kind: 'err', text: '두 글자 이상 입력해 주세요.' });
      return;
    }
    const data = await send(`${base}/link-member?q=${encodeURIComponent(query.trim())}`);
    if (data) setHits(data.members ?? []);
  }

  async function link(userId: string) {
    const ok = await send(`${base}/link-member`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (ok) {
      setHits(null);
      setMsg({ kind: 'ok', text: '회원과 연결했습니다.' });
      router.refresh();
    }
  }

  async function promote() {
    if (!window.confirm('이 학생을 신청한 과목의 수업 명단에 넣을까요?')) return;
    const data = await send(`${base}/promote`, { method: 'POST' });
    if (data) {
      setMsg({
        kind: 'ok',
        text:
          `수업 ${data.enrolled}개에 배정했습니다.` +
          (data.skipped > 0 ? ` (수업이 연결되지 않은 과목 ${data.skipped}개는 건너뛰었습니다.)` : ''),
      });
      router.refresh();
    }
  }

  return (
    <div className="resp-actions">
      {msg && (
        <div
          className={`admin-alert ${msg.kind === 'ok' ? 'admin-alert-success' : 'admin-alert-error'}`}
          role="status"
        >
          {msg.text}
        </div>
      )}

      {/* ── 처리 상태 ── */}
      <section className="admin-card resp-panel">
        <h2 className="resp-panel-title">처리</h2>
        <div className="admin-field opt-field-narrow">
          <label htmlFor="ra-status">상태</label>
          <select
            id="ra-status"
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value as ResponseStatus)}
          >
            {STATUS_CHOICES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
            {status === 'enrolled' && <option value="enrolled">수업 배정됨</option>}
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="ra-note">메모 (통화 결과·유의사항)</label>
          <textarea
            id="ra-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="예: 8/14 통화. 오고무는 취소하고 무용만 등록 원함."
          />
        </div>
        <button type="button" className="admin-btn admin-btn-primary" onClick={saveStatus} disabled={busy}>
          저장
        </button>
      </section>

      {/* ── 건강 특이사항 ── */}
      {hasMedical && (
        <section className="admin-card resp-panel">
          <h2 className="resp-panel-title">건강 및 특이사항</h2>
          {medical === null ? (
            <>
              <p className="admin-field-help">
                이 신청에는 건강 관련 내용이 적혀 있습니다. 여는 순간{' '}
                <strong>누가 언제 열었는지 기록됩니다.</strong>
              </p>
              <button type="button" className="admin-btn admin-btn-outline" onClick={reveal} disabled={busy}>
                내용 보기
              </button>
            </>
          ) : medical.length === 0 ? (
            <p className="admin-field-help">표시할 내용이 없습니다.</p>
          ) : (
            <div className="resp-medical-body">
              {medical.map((m) => (
                <div key={m.key}>
                  <h3 className="resp-answer-label">{m.label}</h3>
                  <p className="resp-answer-value">{m.value}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── 회원 연결 ── */}
      <section className="admin-card resp-panel">
        <h2 className="resp-panel-title">회원 연결</h2>
        {linkedUserId ? (
          <p className="admin-field-help">
            <strong>{linkedUserName ?? '회원'}</strong> 님과 연결되어 있습니다. 다른 회원으로 바꾸려면
            아래에서 다시 찾아 연결하세요.
          </p>
        ) : (
          <p className="admin-field-help">
            아직 회원과 연결되지 않았습니다. <strong>연결해야 수업 명단에 넣을 수 있습니다.</strong>
          </p>
        )}

        <div className="opt-add">
          <div className="admin-field">
            <label htmlFor="ra-q">이름 또는 이메일로 찾기</label>
            <input
              id="ra-q"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  search();
                }
              }}
            />
          </div>
          <button type="button" className="admin-btn admin-btn-outline" onClick={search} disabled={busy}>
            찾기
          </button>
        </div>

        {hits !== null && (
          <div className="resp-hits">
            {hits.length === 0 ? (
              <p className="admin-field-help">
                찾은 회원이 없습니다. 아직 가입하지 않은 분일 수 있습니다 — 회원 관리에서 계정을 만든 뒤
                다시 연결해 주세요.
              </p>
            ) : (
              hits.map((m) => (
                <div key={m.id} className="resp-hit">
                  <span>
                    <strong>{m.name ?? '(이름 없음)'}</strong>
                    <span className="admin-cell-sub">
                      {m.email} · {m.role} · {m.status}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="admin-btn admin-btn-sm admin-btn-outline"
                    onClick={() => link(m.id)}
                    disabled={busy}
                  >
                    이 회원으로 연결
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {/* ── 수업 배정 ── */}
      <section className="admin-card resp-panel">
        <h2 className="resp-panel-title">수업 배정</h2>
        <p className="admin-field-help">
          신청한 과목마다 수업 명단에 넣습니다. 여러 번 눌러도 중복되지 않습니다.
          {status === 'enrolled' && ' 이미 배정된 신청입니다 — 과목이 바뀌었다면 다시 눌러 맞출 수 있습니다.'}
        </p>
        <button
          type="button"
          className="admin-btn admin-btn-gold"
          onClick={promote}
          disabled={busy || !linkedUserId}
        >
          수업 명단에 넣기
        </button>
        {!linkedUserId && (
          <p className="admin-field-help">먼저 위에서 회원을 연결해 주세요.</p>
        )}
      </section>
    </div>
  );
}
