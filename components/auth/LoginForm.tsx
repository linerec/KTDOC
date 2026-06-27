'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import IntlObject from '@/components/common/IntlObject';
import { useLanguage } from '@/contexts/LanguageContext';

export default function LoginForm() {
  const router = useRouter();
  const { messages } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isDev = process.env.NODE_ENV === 'development';

  // 개발 서버 전용 빠른 로그인 — dev-admin provider(비번 없이 이메일로 로그인)와 짝.
  // 비밀번호는 포함하지 않는다(클라 번들 노출 방지). 계정은 npm run seed:test로 생성.
  const devAccounts = [
    { label: '관리자', email: 'owenkdev@gmail.com' },
    { label: '선생님', email: 'teacher.test@ktdoc.org' },
    { label: '원생', email: 'student.test@ktdoc.org' },
    { label: '학부모', email: 'parent.test@ktdoc.org' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(messages['auth.error.invalidCredentials']);
      } else {
        router.push('/');
        router.refresh();
      }
    } catch {
      setError(messages['auth.error.loginFailed']);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDevLogin = async (devEmail: string) => {
    setError('');
    setIsLoading(true);
    try {
      const result = await signIn('dev-admin', {
        email: devEmail,
        redirect: false,
      });

      if (result?.error) {
        setError(messages['auth.error.invalidCredentials']);
      } else {
        router.push('/');
        router.refresh();
      }
    } catch {
      setError(messages['auth.error.loginFailed']);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <IntlObject keycode="auth.login" returnType="h1" className="auth-title" />

      {error && <div className="auth-error">{error}</div>}

      <div className="auth-field">
        <label htmlFor="email"><IntlObject keycode="auth.email" /></label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={messages['auth.email.placeholder']}
          required
          disabled={isLoading}
        />
      </div>

      <div className="auth-field">
        <label htmlFor="password"><IntlObject keycode="auth.password" /></label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={messages['auth.password.placeholder']}
          required
          disabled={isLoading}
        />
      </div>

      <button type="submit" className="auth-button" disabled={isLoading}>
        {isLoading ? messages['auth.login.loading'] : messages['auth.login']}
      </button>

      {isDev && (
        <div className="auth-dev">
          <span className="auth-dev-label">[DEV] 빠른 로그인</span>
          <div className="auth-dev-grid">
            {devAccounts.map((acc) => (
              <button
                key={acc.email}
                type="button"
                className="auth-button auth-button-dev"
                onClick={() => handleDevLogin(acc.email)}
                disabled={isLoading}
              >
                {acc.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="auth-link">
        <IntlObject keycode="auth.noAccount" /> <Link href="/register"><IntlObject keycode="auth.register" /></Link>
      </p>
    </form>
  );
}
