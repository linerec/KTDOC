'use client';

/**
 * 알림 작성·발송 폼 — 대상(전체/역할별/개인)을 고르고 제목·내용을 써서 보낸다
 *
 * 발송은 되돌릴 수 없다. 그래서 제목·내용이 비었거나 대상이 정해지지 않았으면
 * 서버에 보내기 전에 여기서 막는다.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MemberRole } from '@/types/members';
import { useT } from '@/lib/i18n/useT';
import { roleLabel } from '@/lib/i18n/memberLabels';

export interface MemberOption {
  id: string;
  name: string | null;
  email: string;
  role: MemberRole;
}

type TargetType = 'all' | 'role' | 'user';

const ROLE_CHOICES: MemberRole[] = ['student', 'parent', 'teacher', 'admin'];

interface NotifyFormProps {
  members: MemberOption[];
  subscriberCount: number;
}

export default function NotifyForm({ members, subscriberCount }: NotifyFormProps) {
  const router = useRouter();
  const t = useT();

  const [targetType, setTargetType] = useState<TargetType>('all');
  const [roles, setRoles] = useState<MemberRole[]>(['student', 'parent']);
  const [userId, setUserId] = useState<string>(members[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const toggleRole = (r: MemberRole) => {
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  };

  const handleSend = async () => {
    setError('');
    setResult('');
    if (!title.trim() || !body.trim()) {
      setError(t('admin.notify.needTitleBody', '제목과 내용을 입력해 주세요.'));
      return;
    }
    if (targetType === 'role' && roles.length === 0) {
      setError(t('admin.notify.needRole', '역할을 1개 이상 선택해 주세요.'));
      return;
    }
    if (targetType === 'user' && !userId) {
      setError(t('admin.notify.needUser', '대상 회원을 선택해 주세요.'));
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          url: url.trim() || undefined,
          target: {
            type: targetType,
            roles: targetType === 'role' ? roles : undefined,
            userId: targetType === 'user' ? userId : undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || t('admin.notify.sendFailed', '발송에 실패했습니다.'));
        return;
      }
      setResult(data.message || t('admin.notify.sent', '발송했습니다.'));
      setTitle('');
      setBody('');
      setUrl('');
      router.refresh();
    } catch {
      setError(t('admin.notify.serverError', '서버 오류가 발생했습니다.'));
    } finally {
      setSending(false);
    }
  };

  const targetTabs: [TargetType, string][] = [
    ['all', t('admin.events.targetAll', '전체')],
    ['role', t('admin.events.targetRole', '역할별')],
    ['user', t('admin.notify.targetUser', '개인')],
  ];

  return (
    <section className="admin-form-section admin-account-card">
      <h2 className="admin-form-section-title">{t('admin.notify.newAlert', '새 알림')}</h2>
      <p className="admin-form-help">
        {t(
          'admin.notify.formHelp',
          '알림을 켠 기기로만 전송됩니다(현재 {n}대). 제목·내용은 휴대폰 알림에 그대로 표시됩니다.',
          { n: subscriberCount }
        )}
      </p>

      <div className="admin-form-group">
        <span className="admin-form-label">{t('admin.events.notifyTarget', '보낼 대상')}</span>
        <div className="notify-target-tabs">
          {targetTabs.map(([val, label]) => (
            <button
              key={val}
              type="button"
              className={`notify-tab${targetType === val ? ' is-active' : ''}`}
              onClick={() => setTargetType(val)}
              disabled={sending}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {targetType === 'role' && (
        <div className="admin-form-group">
          <div className="notify-roles">
            {ROLE_CHOICES.map((r) => (
              <label key={r} className="notify-role-check">
                <input
                  type="checkbox"
                  checked={roles.includes(r)}
                  onChange={() => toggleRole(r)}
                  disabled={sending}
                />
                <span>{roleLabel(t, r)}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {targetType === 'user' && (
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="notify-user">
            {t('admin.notify.targetMember', '대상 회원')}
          </label>
          <select
            id="notify-user"
            className="admin-form-input"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={sending}
          >
            {members.length === 0 && (
              <option value="">{t('admin.notify.noMembers', '정회원이 없습니다')}</option>
            )}
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || m.email} · {roleLabel(t, m.role)} ({m.email})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="admin-form-group">
        <label className="admin-form-label" htmlFor="notify-title">
          {t('admin.notify.fieldTitle', '제목')} <span className="required">*</span>
        </label>
        <input
          id="notify-title"
          type="text"
          className="admin-form-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder={t('admin.notify.titlePlaceholder', '예: 토요일 정기 공연 안내')}
          disabled={sending}
        />
      </div>

      <div className="admin-form-group">
        <label className="admin-form-label" htmlFor="notify-body">
          {t('admin.notify.fieldBody', '내용')} <span className="required">*</span>
        </label>
        <textarea
          id="notify-body"
          className="admin-form-input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder={t(
            'admin.notify.bodyPlaceholder',
            '예: 이번 주 토요일 오후 2시, 한국문화원 대공연장에서 공연이 있습니다.'
          )}
          disabled={sending}
        />
      </div>

      <div className="admin-form-group">
        <label className="admin-form-label" htmlFor="notify-url">
          {t('admin.notify.fieldUrl', '클릭 시 이동(선택)')}
        </label>
        <input
          id="notify-url"
          type="text"
          className="admin-form-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t('admin.notify.urlPlaceholder', '/admin/schedule (비우면 홈)')}
          disabled={sending}
        />
      </div>

      {error && (
        <p className="admin-account-feedback admin-account-feedback--error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <p className="admin-account-feedback admin-account-feedback--success" role="status">
          {result}
        </p>
      )}

      <div className="admin-domain-actions">
        <button
          type="button"
          className="admin-btn admin-btn-gold"
          onClick={handleSend}
          disabled={sending}
        >
          {sending
            ? t('admin.notify.sending', '보내는 중…')
            : t('admin.notify.send', '알림 보내기')}
        </button>
      </div>
    </section>
  );
}
