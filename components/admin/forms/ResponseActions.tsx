'use client';

/**
 * ResponseActions — 응답 하나를 처리한다
 *
 * **평소에 하는 일은 버튼 하나다.** 예전에는 승인 → 회원 연결 → 배정 세 번을
 * 순서대로 눌러야 했는데 순서를 알려주는 곳이 없었다. 실제로 같은 사람이 하룻밤에
 * 세 가지 다른 순서로 눌렀고, 한 건은 '승인'에서 멈춰 목록에는 초록 배지로
 * 끝난 것처럼 보였다.
 *
 * 결제가 없어서 '승인'은 아무 일도 하지 않는다 — 승인해도 신청자에게 연락이 가지
 * 않고, 승인 없이도 배정된다(실측: 승인 9초 뒤 배정). 이름표일 뿐이라 평소 흐름에서
 * 뺐다. 남는 것은 "누구인가"와 "수업에 넣는다" 둘뿐이다.
 *
 * 예외(추가 확인·거절·취소)는 접어 둔다 — 5일간 한 번도 쓰이지 않았지만
 * 정원 초과·환불 같은 상황에서 필요하다. 자주 쓰는 것과 가끔 쓰는 것을 나눈다.
 *
 * 상태 전이에 규칙을 두지 않는 것은 그대로다 — 옛 시스템의 문제는 자유 전이가
 * 아니라 무기록이었다. 무엇을 하든 이력에 남는다.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RESPONSE_STATUS_LABEL } from '@/lib/forms/responseLabels';
import type { ResponseStatus } from '@/types/forms';

/**
 * '다르게 처리하기'에 담는 예외 상태.
 * 'accepted'(승인)는 뺐다 — 코드상 아무 일도 하지 않는데 목록에서 초록 배지로 떠서
 * 처리가 끝난 것처럼 보이게 만들었다. 평소 흐름은 '수업에 넣기' 하나다.
 */
const EXCEPTION_STATUSES: ResponseStatus[] = ['needs_info', 'declined', 'cancelled', 'new'];

const STATUS_CHOICES: Array<{ value: ResponseStatus; label: string }> =
  EXCEPTION_STATUSES.map((s) => ({ value: s, label: RESPONSE_STATUS_LABEL[s] }));

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

  // 서버가 상태를 바꾸고 나면(배정하면 '배정 완료'가 된다) 드롭다운도 따라와야 한다.
  // 이게 없으면 배정 직후 화면에 남아 있는 옛 값('승인')으로 '저장'을 누르는 순간
  // 방금 끝낸 배정이 되돌아간 것처럼 상태가 뒤로 간다.
  useEffect(() => {
    setNextStatus(status);
  }, [status]);

  const [medical, setMedical] = useState<Array<{ key: string; label: string; value: string }> | null>(
    null
  );

  const [query, setQuery] = useState(studentName || email || '');
  const [hits, setHits] = useState<MemberHit[] | null>(null);

  /** 이미 연결된 신청에서 '다른 회원으로 바꾸기'를 눌렀을 때만 찾기 UI를 편다. */
  const [relink, setRelink] = useState(false);
  /** 평소 흐름을 벗어나는 처리(추가 확인·거절·취소)는 접어 둔다. */
  const [showExceptions, setShowExceptions] = useState(false);

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

  /** 상태는 건드리지 않고 메모만 남긴다. */
  async function saveNote() {
    if (!note.trim()) return;
    const ok = await send(base, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    });
    if (ok) {
      setNote('');
      setMsg({ kind: 'ok', text: '메모를 남겼습니다.' });
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
      setRelink(false);
      setMsg({ kind: 'ok', text: '회원과 연결했습니다. 이제 수업에 넣을 수 있습니다.' });
      router.refresh();
    }
  }

  async function promote() {
    // 확인 문구가 부수효과를 다 말한다 — 예전엔 미디어 동의가 프로필에 반영되는 것을
    // 누르기 전에 아무 데서도 알려주지 않았다.
    if (
      !window.confirm(
        `${linkedUserName ?? '이 학생'} 님을 신청한 과목의 수업 명단에 넣습니다.\n\n` +
          '· 처리 상태가 「수업 배정 완료」가 됩니다\n' +
          '· 학생과 보호자에게 등록 안내 메일이 나갑니다\n' +
          '· 신청서의 사진·영상 활용 동의가 프로필에 반영됩니다\n\n' +
          '계속할까요?'
      )
    )
      return;
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

      {/* ── 지금 할 일 하나 ──
             회원을 고르고, 수업에 넣는다. 그 둘이 순서대로 보이면 외울 것이 없다. */}
      <section className="admin-card resp-panel resp-primary">
        <h2 className="resp-panel-title">
          {status === 'enrolled' ? '이 신청은 처리가 끝났습니다' : '이 신청 처리하기'}
        </h2>

        {/* 1단계 — 누구인가 */}
        <div className={`resp-step ${linkedUserId ? 'is-done' : 'is-current'}`}>
          <span className="resp-step-mark">{linkedUserId ? '✓' : '1'}</span>
          <div className="resp-step-body">
            {linkedUserId ? (
              <p className="resp-step-title">
                <strong>{linkedUserName ?? '회원'}</strong> 님의 신청입니다.
                <button type="button" className="resp-step-relink" onClick={() => setRelink((v) => !v)}>
                  {relink ? '그만두기' : '다른 회원으로 바꾸기'}
                </button>
              </p>
            ) : (
              <>
                <p className="resp-step-title">어느 회원의 신청인지 골라 주세요.</p>
                <p className="admin-field-help">
                  회원을 골라야 수업 명단에 넣을 수 있습니다. 신청서에 적힌 이름은{' '}
                  <strong>{studentName}</strong> 입니다.
                </p>
              </>
            )}

            {(!linkedUserId || relink) && (
              <>
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
                        찾은 회원이 없습니다. 아직 가입하지 않으신 분일 수 있습니다 — 가입하신 뒤에
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
              </>
            )}
          </div>
        </div>

        {/* 2단계 — 수업에 넣는다 */}
        <div
          className={`resp-step ${
            status === 'enrolled' ? 'is-done' : linkedUserId ? 'is-current' : 'is-waiting'
          }`}
        >
          <span className="resp-step-mark">{status === 'enrolled' ? '✓' : '2'}</span>
          <div className="resp-step-body">
            <p className="resp-step-title">
              {status === 'enrolled' ? '수업 명단에 들어갔습니다.' : '수업 명단에 넣습니다.'}
            </p>
            <p className="admin-field-help">
              {status === 'enrolled'
                ? '과목이 바뀌었다면 다시 눌러 명단을 맞출 수 있습니다. 여러 번 눌러도 중복되지 않습니다.'
                : '신청한 과목마다 넣고, 학생·보호자에게 등록 안내가 나갑니다.'}
            </p>
            <button
              type="button"
              className="admin-btn admin-btn-gold resp-primary-cta"
              onClick={promote}
              disabled={busy || !linkedUserId}
            >
              {status === 'enrolled' ? '명단 다시 맞추기' : '수업에 넣기'}
            </button>
          </div>
        </div>
      </section>

      {/* ── 메모 ──
             통화 결과·유의사항. 상태를 바꾸지 않고도 남길 수 있어야 한다 —
             예전에는 상태 저장에 딸려 있어서, 메모만 쓰려면 상태를 건드려야 했다. */}
      <section className="admin-card resp-panel">
        <h2 className="resp-panel-title">메모</h2>
        <div className="admin-field">
          <label htmlFor="ra-note">통화 결과·유의사항</label>
          <textarea
            id="ra-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="예: 8/14 통화. 오고무는 취소하고 무용만 등록 원함."
          />
        </div>
        <button
          type="button"
          className="admin-btn admin-btn-outline"
          onClick={saveNote}
          disabled={busy || !note.trim()}
        >
          메모 남기기
        </button>
      </section>

      {/* ── 다르게 처리하기 ──
             정원 초과·환불 요청처럼 평소 흐름을 벗어나는 경우. 접어 둔다. */}
      <section className="admin-card resp-panel">
        <button
          type="button"
          className="resp-more-toggle"
          onClick={() => setShowExceptions((v) => !v)}
          aria-expanded={showExceptions}
        >
          다르게 처리하기 {showExceptions ? '▾' : '▸'}
        </button>
        {showExceptions && (
          <>
            <p className="admin-field-help">
              지금 상태는 <strong>{RESPONSE_STATUS_LABEL[status]}</strong> 입니다.
              추가 확인이 필요하거나 접수를 거절·취소할 때만 쓰세요.
            </p>
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
                {!EXCEPTION_STATUSES.includes(status) && (
                  <option value={status}>{RESPONSE_STATUS_LABEL[status]}</option>
                )}
              </select>
            </div>
            <button type="button" className="admin-btn admin-btn-outline" onClick={saveStatus} disabled={busy}>
              상태 바꾸기
            </button>
            <p className="admin-field-help">
              상태를 바꿔도 이미 들어간 수업 명단은 그대로입니다. 명단에서 빼려면
              수업 화면에서 수강생을 취소해 주세요.
            </p>
          </>
        )}
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

    </div>
  );
}
