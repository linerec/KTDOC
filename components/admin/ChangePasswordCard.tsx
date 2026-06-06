'use client';

import { useState, type FormEvent } from 'react';

export default function ChangePasswordCard() {
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
      setError('모든 항목을 입력해주세요.');
      return;
    }
    if (newPassword.length < 8) {
      setError('새 비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.');
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
        setError(data.error || '변경에 실패했습니다.');
        return;
      }

      setSuccess(data.message || '비밀번호가 변경되었습니다.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="admin-form-section admin-account-card" onSubmit={handleSubmit}>
      <h2 className="admin-form-section-title">비밀번호 변경</h2>
      <p className="admin-form-help">
        현재 비밀번호를 확인한 뒤 새 비밀번호로 바로 변경합니다. 새 비밀번호는 최소 8자 이상이어야 해요.
      </p>

      <div className="admin-form-group">
        <label className="admin-form-label" htmlFor="current-password">
          현재 비밀번호 <span className="required">*</span>
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
          새 비밀번호 <span className="required">*</span>
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
          새 비밀번호 확인 <span className="required">*</span>
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
          {saving ? '변경 중...' : '비밀번호 변경'}
        </button>
      </div>
    </form>
  );
}
