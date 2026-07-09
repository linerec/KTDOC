'use client';

import { useState } from 'react';
import { getSession, signIn, signOut, useSession } from 'next-auth/react';
import IntlObject from '@/components/common/IntlObject';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * 임시 비밀번호 로그인 후 새 비밀번호 설정 폼.
 * 성공 시 새 비밀번호로 즉시 재로그인해 JWT를 재발급한다 —
 * mustChangePassword 클레임이 해제된 새 쿠키가 확보된 뒤에만 이동하므로
 * 미들웨어 강제 이동이 확실하게 풀린다. (useSession().update()는 토큰 회전이
 * 보장되지 않아 검증 과정에서 이 방식으로 확정)
 */
export default function ForcePasswordForm() {
  const { data: sessionData } = useSession();
  const { messages } = useLanguage();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(messages['auth.error.passwordMismatch']);
      return;
    }
    if (password.length < 8) {
      setError(messages['auth.error.passwordLength']);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // 이미 변경을 마친 옛 토큰이 남은 경우: 로그아웃으로 강제 이동 고리를 끊는다
        if (data.code === 'NOT_REQUIRED') {
          await signOut({ callbackUrl: '/login' });
          return;
        }
        setError(data.error || messages['auth.newPassword.failed']);
        return;
      }

      // 새 비밀번호로 재로그인해 새 JWT 확보. 실패해도 비밀번호는 이미
      // 변경된 상태이므로 로그인 화면에서 새 비밀번호로 이어가면 된다.
      const email = sessionData?.user?.email;
      const result = email
        ? await signIn('credentials', { email, password, redirect: false })
        : null;
      if (!result || result.error) {
        window.location.assign('/login');
        return;
      }
      const fresh = await getSession();
      window.location.assign(fresh?.user?.status === 'active' ? '/admin' : '/');
    } catch {
      setError(messages['auth.newPassword.failed']);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <IntlObject keycode="auth.newPassword.title" returnType="h1" className="auth-title" />

      <p className="auth-desc">
        <IntlObject keycode="auth.newPassword.desc" />
      </p>

      {error && <div className="auth-error">{error}</div>}

      <div className="auth-field">
        <label htmlFor="new-password"><IntlObject keycode="auth.newPassword.label" /></label>
        <input
          id="new-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={messages['auth.password.minPlaceholder']}
          autoComplete="new-password"
          minLength={8}
          required
          disabled={isLoading}
        />
      </div>

      <div className="auth-field">
        <label htmlFor="confirm-password"><IntlObject keycode="auth.confirmPassword" /></label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder={messages['auth.confirmPassword.placeholder']}
          autoComplete="new-password"
          minLength={8}
          required
          disabled={isLoading}
        />
      </div>

      <button type="submit" className="auth-button" disabled={isLoading}>
        {isLoading ? messages['auth.newPassword.loading'] : messages['auth.newPassword.submit']}
      </button>
    </form>
  );
}
