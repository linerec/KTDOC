'use client';

/**
 * ProfileForm
 * 내 프로필 기본 정보 — 이름(수정 가능) + 이메일·권한·가입일(읽기 전용).
 * 저장 시 세션(update)과 레이아웃(router.refresh)에 새 이름을 즉시 반영한다.
 */

import { useState, type FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { MEMBER_ROLE_LABELS, type MemberRole } from '@/types/members';

interface ProfileFormProps {
  initialName: string;
  email: string;
  role: MemberRole;
  joinedAt: string | null;
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  const d = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
}

export default function ProfileForm({ initialName, email, role, joinedAt }: ProfileFormProps) {
  const { update } = useSession();
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const dirty = name.trim() !== initialName.trim();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimmed = name.trim();
    if (!trimmed) {
      setError('이름을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || '변경에 실패했습니다.');
        return;
      }

      // 세션 토큰과 사이드바(서버 렌더)에 새 이름 반영
      await update({ name: trimmed });
      router.refresh();
      setSuccess(data.message || '이름이 변경되었습니다.');
    } catch {
      setError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="admin-form-section admin-account-card" onSubmit={handleSubmit}>
      <h2 className="admin-form-section-title">기본 정보</h2>
      <p className="admin-form-help">
        이름은 관리자 화면에 표시됩니다. 이메일(로그인 아이디)과 권한은 변경할 수 없습니다.
      </p>

      <div className="admin-form-group">
        <label className="admin-form-label" htmlFor="profile-name">
          이름 <span className="required">*</span>
        </label>
        <input
          id="profile-name"
          type="text"
          className="admin-form-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          disabled={saving}
          autoComplete="name"
        />
      </div>

      <div className="admin-form-group">
        <label className="admin-form-label" htmlFor="profile-email">
          이메일
        </label>
        <input id="profile-email" type="email" className="admin-form-input" value={email} disabled readOnly />
      </div>

      <div className="admin-profile-meta">
        <span>
          권한 <strong>{MEMBER_ROLE_LABELS[role]}</strong>
        </span>
        <span>
          가입일 <strong>{formatDate(joinedAt)}</strong>
        </span>
      </div>

      {error && (
        <p className="admin-account-feedback admin-account-feedback--error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="admin-account-feedback admin-account-feedback--success" role="status">
          {success}
        </p>
      )}

      <div className="admin-domain-actions">
        <button type="submit" className="admin-btn admin-btn-primary" disabled={saving || !dirty}>
          {saving ? '저장 중...' : '이름 저장'}
        </button>
      </div>
    </form>
  );
}
