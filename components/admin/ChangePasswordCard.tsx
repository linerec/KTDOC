'use client';

import { useState, type FormEvent } from 'react';
import { useT } from '@/lib/i18n/useT';

export default function ChangePasswordCard() {
  const t = useT();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(t('admin.password.allRequired', '모든 항목을 입력해주세요.'));
      return;
    }
    if (newPassword.length < 8) {
      setError(t('admin.password.tooShort', '새 비밀번호는 최소 8자 이상이어야 합니다.'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('admin.password.mismatch', '새 비밀번호가 일치하지 않습니다.'));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t('admin.password.failed', '변경에 실패했습니다.'));
        return;
      }

      setSuccess(data.message || t('admin.password.changed', '비밀번호가 변경되었습니다.'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setError(t('admin.common.serverErrorRetry', '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="admin-form-section admin-account-card" onSubmit={handleSubmit}>
      <h2 className="admin-form-section-title">{t('admin.password.title', '비밀번호 변경')}</h2>
      <p className="admin-form-help">
        {t(
          'admin.password.help',
          '현재 비밀번호를 확인한 뒤 새 비밀번호로 바로 변경합니다. 새 비밀번호는 최소 8자 이상이어야 해요.'
        )}
      </p>

      <div className="admin-form-group">
        <label className="admin-form-label" htmlFor="current-password">
          {t('admin.password.current', '현재 비밀번호')} <span className="required">*</span>
        </label>
        <input
          id="current-password"
          type="password"
          className="admin-form-input"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          disabled={saving}
        />
      </div>

      <div className="admin-form-group">
        <label className="admin-form-label" htmlFor="new-password">
          {t('admin.password.new', '새 비밀번호')} <span className="required">*</span>
        </label>
        <input
          id="new-password"
          type="password"
          className="admin-form-input"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          disabled={saving}
        />
      </div>

      <div className="admin-form-group">
        <label className="admin-form-label" htmlFor="confirm-password">
          {t('admin.password.confirm', '새 비밀번호 확인')} <span className="required">*</span>
        </label>
        <input
          id="confirm-password"
          type="password"
          className="admin-form-input"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          disabled={saving}
        />
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
        <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
          {saving
            ? t('admin.password.changing', '변경 중...')
            : t('admin.password.title', '비밀번호 변경')}
        </button>
      </div>
    </form>
  );
}
