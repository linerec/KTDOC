'use client';

/**
 * CorrectionModal — 신청 과목을 고친다. 한 자리에서 한 번.
 *
 * 응답 #173이 과목을 잘못 넣고 배정까지 끝났을 때, 고치는 길이 "수업 화면에 가서
 * 해제하고, 신청서를 다시 받고, 다시 배정하고, 전화로 알리는" 네 걸음이었다.
 * 걸음마다 빠뜨릴 수 있었고 실제로 빠뜨렸다. 이 모달은 그 넷을 저장 한 번으로 묶고,
 * **누르기 전에** 무엇이 바뀌는지를 다 보여 준다:
 *
 *   1. 바뀌는 과목            — 체크 목록. 함께 고를 수 없는 짝은 서버가 다시 검사한다.
 *   2. 바뀌는 배정            — 어느 수업에서 빠지고(삭제인지 취소인지) 어디에 들어가나.
 *   3. 안내가 가는 곳         — 주소까지. 신청서 주소·계정 주소·보호자 주소가 다르다.
 *
 * 두 방식: **바로 적용**(학부모·학생이 요청한 정정)과 **먼저 예고**(학원 사정으로
 * 옮기는 정정 — 예고 안내만 나가고 답·배정은 [지금 적용]을 누를 때 바뀐다).
 *
 * 머리에 누구 것인지를 크게 둔다 — 형제 응답을 열어 놓고 고치는 실수가 가장 무섭다.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export interface CorrectionOption {
  key: string;
  label: string;
  programId: number | null;
  retired?: boolean;
}

interface Recipient {
  key: string;
  role: 'applicant' | 'account' | 'guardian';
  label: string;
  email: string;
  blocked: 'opted-out' | 'invalid-address' | null;
}

interface Preview {
  from: Array<{ key: string; label: string }>;
  to: Array<{ key: string; label: string }>;
  planLines: string[];
  hasStudent: boolean;
  plan: { add: unknown[]; revive: unknown[]; remove: unknown[]; unlinked: unknown[] };
}

interface CorrectionModalProps {
  formId: number;
  responseId: number;
  studentName: string;
  linkedUserName: string | null;
  submitterName: string | null;
  questionLabel: string;
  options: CorrectionOption[];
  currentKeys: string[];
  isEnrolled: boolean;
  onClose: () => void;
  onDone: (summary: string) => void;
}

const ROLE_LABEL: Record<Recipient['role'], string> = {
  applicant: '신청서에 적힌 주소',
  account: '회원 계정',
  guardian: '보호자',
};

export default function CorrectionModal({
  formId,
  responseId,
  studentName,
  linkedUserName,
  submitterName,
  questionLabel,
  options,
  currentKeys,
  isEnrolled,
  onClose,
  onDone,
}: CorrectionModalProps) {
  const router = useRouter();
  const base = `/api/admin/forms/${formId}/responses/${responseId}`;

  const [picked, setPicked] = useState<string[]>(currentKeys);
  const [mode, setMode] = useState<'apply' | 'plan'>('apply');
  const [effective, setEffective] = useState('');
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(true);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<Recipient[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement | null>(null);

  const changed = useMemo(() => {
    const a = new Set(currentKeys);
    return picked.length !== currentKeys.length || picked.some((k) => !a.has(k));
  }, [picked, currentKeys]);

  // 안내가 가는 곳 — '메일 보내기' 카드와 같은 원천을 읽는다.
  useEffect(() => {
    let alive = true;
    fetch(`${base}/messages`)
      .then((r) => r.json())
      .then((j) => {
        if (alive && j?.success) setRecipients(j.data.recipients ?? []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [base]);

  // 고를 때마다 미리보기 — 서버가 배타 규칙·배정 계획을 같은 함수로 계산한다.
  // 바뀐 것이 없으면 요청하지 않는다(화면은 아래에서 changed 로 가린다).
  useEffect(() => {
    if (!changed) return;
    let alive = true;
    const t = setTimeout(() => {
      fetch(`${base}/correct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'preview', optionKeys: picked }),
      })
        .then((r) => r.json())
        .then((j) => {
          if (!alive) return;
          if (j?.success) {
            setPreview(j.data);
            setPreviewError(null);
          } else {
            setPreview(null);
            setPreviewError(j?.error ?? '미리 볼 수 없습니다.');
          }
        })
        .catch(() => alive && setPreviewError('연결이 끊어졌습니다.'));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [picked, changed, base]);

  useEffect(() => {
    firstRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  function toggle(key: string) {
    setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
  }

  const shownPreview = changed ? preview : null;
  const shownPreviewError = changed ? previewError : null;
  const affectsEnrollment =
    !!shownPreview &&
    shownPreview.plan.add.length + shownPreview.plan.revive.length + shownPreview.plan.remove.length > 0;

  async function save() {
    if (!changed || shownPreviewError) return;
    if (mode === 'plan' && effective && !/^\d{4}-\d{2}-\d{2}$/.test(effective)) {
      setError('적용 예정일은 날짜로 적어 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${base}/correct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          optionKeys: picked,
          reason,
          notify,
          effective: mode === 'plan' && effective ? effective : null,
        }),
      });
      const json = await res.json();
      setBusy(false);
      if (!res.ok || !json.success) {
        setError(json.error || '처리하지 못했습니다.');
        return;
      }
      onDone(json.data.summary);
      router.refresh();
    } catch {
      setBusy(false);
      setError('연결이 끊어졌습니다.');
    }
  }

  const openRecipients = (recipients ?? []).filter((r) => !r.blocked);

  return (
    <div className="rva-modal" role="dialog" aria-modal="true" aria-labelledby="corr-title">
      <div className="rva-modal__panel corr-panel">
        <h2 id="corr-title" className="rva-modal__title">
          신청 과목 정정
        </h2>
        <p className="corr-who">
          <strong>{studentName}</strong>
          {linkedUserName && (
            <>
              {' '}
              · 회원 <strong>{linkedUserName}</strong>
            </>
          )}
          {!linkedUserName && ' · 회원 미연결(배정은 바뀌지 않습니다)'}
          {submitterName && <span className="admin-cell-sub"> · 제출 {submitterName}</span>}
        </p>

        {/* 1. 과목 */}
        <fieldset className="corr-fieldset">
          <legend>{questionLabel}</legend>
          <ul className="corr-options">
            {options.map((o, i) => (
              <li key={o.key}>
                <label className={o.retired ? 'is-retired' : undefined}>
                  <input
                    ref={i === 0 ? firstRef : undefined}
                    type="checkbox"
                    checked={picked.includes(o.key)}
                    onChange={() => toggle(o.key)}
                    disabled={busy || (o.retired && !picked.includes(o.key))}
                  />
                  <span>{o.label.trim()}</span>
                  {o.programId == null && <span className="admin-badge admin-badge-warning">수업 미연결</span>}
                  {o.retired && <span className="admin-cell-sub">(더는 받지 않는 과목)</span>}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        {/* 2. 저장하면 이렇게 됩니다 */}
        <div className="corr-preview" aria-live="polite">
          {!changed && <p className="admin-field-help">과목을 바꾸면 여기에 무엇이 달라지는지 보입니다.</p>}
          {shownPreviewError && <p className="rva-modal__error">{shownPreviewError}</p>}
          {shownPreview && (
            <>
              <p className="corr-preview-line">
                <span className="corr-k">과목</span>
                {shownPreview.from.map((o) => o.label.trim()).join(' · ') || '(없음)'} →{' '}
                <strong>{shownPreview.to.map((o) => o.label.trim()).join(' · ')}</strong>
              </p>
              <p className="corr-preview-line">
                <span className="corr-k">배정</span>
                {shownPreview.planLines.length === 0
                  ? isEnrolled
                    ? '수업 명단은 그대로입니다(같은 수업).'
                    : '아직 배정 전이라 명단은 바뀌지 않습니다.'
                  : null}
              </p>
              {shownPreview.planLines.length > 0 && (
                <ul className="corr-plan">
                  {shownPreview.planLines.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* 3. 방식 */}
        <div className="corr-mode" role="radiogroup" aria-label="처리 방식">
          <label>
            <input type="radio" name="corr-mode" checked={mode === 'apply'} onChange={() => setMode('apply')} disabled={busy} />
            <span>
              <strong>바로 적용</strong>
              <small>학부모·학생이 요청한 정정. 적용한 뒤 확인 안내가 나갑니다.</small>
            </span>
          </label>
          <label>
            <input type="radio" name="corr-mode" checked={mode === 'plan'} onChange={() => setMode('plan')} disabled={busy} />
            <span>
              <strong>먼저 예고</strong>
              <small>학원 사정으로 옮길 때. 예고 안내만 나가고, 이 화면의 [지금 적용]을 누를 때 바뀝니다.</small>
            </span>
          </label>
          {mode === 'plan' && (
            <div className="admin-field opt-field-narrow">
              <label htmlFor="corr-eff">언제부터 (선택)</label>
              <input id="corr-eff" type="date" value={effective} onChange={(e) => setEffective(e.target.value)} disabled={busy} />
            </div>
          )}
        </div>

        <div className="admin-field">
          <label htmlFor="corr-reason">사유 (선택 · 운영진만 봅니다)</label>
          <input
            id="corr-reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="예: 9/7 어머님 전화. 시간이 겹쳐 성인반으로."
            maxLength={500}
            disabled={busy}
          />
        </div>

        {/* 4. 안내 */}
        <label className="corr-notify">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} disabled={busy} />
          <span>
            {mode === 'plan'
              ? '변경 예정 안내 보내기'
              : affectsEnrollment
                ? '수업 변경 안내 보내기 (빠진 수업·새 수업을 한 통에)'
                : '신청 내용 변경 확인 보내기'}
          </span>
        </label>
        <div className="corr-recipients">
          {recipients === null && <p className="admin-field-help">안내가 갈 곳을 확인하는 중…</p>}
          {recipients !== null && openRecipients.length === 0 && (
            <p className="admin-field-help">
              메일이 갈 주소가 없습니다. 저장은 되지만 안내는 나가지 않습니다 — 전화로 알려 주세요.
            </p>
          )}
          {openRecipients.length > 0 && (
            <p className="admin-field-help">
              안내가 가는 곳:{' '}
              {openRecipients.map((r) => `${r.email} (${ROLE_LABEL[r.role]})`).join(', ')}
              {linkedUserName && ' · 앱 알림함에도 남습니다.'}
            </p>
          )}
        </div>

        {error && <p className="rva-modal__error">{error}</p>}

        <div className="rva-modal__acts">
          <button type="button" className="admin-btn admin-btn-outline" onClick={onClose} disabled={busy}>
            닫기
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-gold"
            onClick={save}
            disabled={busy || !changed || !!shownPreviewError || !shownPreview}
          >
            {busy
              ? '처리 중…'
              : mode === 'plan'
                ? notify
                  ? '예고 남기고 안내'
                  : '예고만 남기기'
                : notify
                  ? '정정하고 안내'
                  : '정정만 하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
