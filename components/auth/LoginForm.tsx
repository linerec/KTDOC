'use client';

import { useState } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import IntlObject from '@/components/common/IntlObject';
import { useLanguage } from '@/contexts/LanguageContext';
import { telHref } from '@/lib/seoBusiness';

interface LoginFormProps {
  /** 비밀번호 분실 안내의 전화 연결 — SEO 패널 연락처(D1)가 단일 소스 */
  contactTel?: string;
}

export default function LoginForm({ contactTel = '' }: LoginFormProps) {
  const router = useRouter();
  const { messages } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // 승인 대기(pending) 회원 로그인 — 이동 대신 대기 안내 패널을 보여준다
  const [pendingNotice, setPendingNotice] = useState(false);

  const isDev = process.env.NODE_ENV === 'development';

  // 개발 서버 전용 빠른 로그인 — dev-admin provider(비번 없이 이메일로 로그인)와 짝.
  // 비밀번호는 포함하지 않는다(클라 번들 노출 방지). 계정은 npm run seed:test로 생성.
  const devAccounts = [
    { label: '관리자', email: 'owenkdev@gmail.com' },
    { label: '선생님', email: 'teacher.test@ktdoc.org' },
    { label: '원생', email: 'student.test@ktdoc.org' },
    { label: '학부모', email: 'parent.test@ktdoc.org' },
  ];

  // 로그인한 회원(관리자·선생님·원생·학부모)은 열람이 아니라 업무가 목적이므로
  // 곧장 관리 콘솔로 보낸다. 역할별 착지는 admin 레이아웃이 첫 허용 메뉴로 처리.
  // 승인 대기(pending) 회원은 이동 대신 이 화면에서 대기 상황과 문의처를 안내한다.
  const redirectAfterLogin = async () => {
    const session = await getSession();
    if (session?.user?.status === 'active') {
      router.push('/admin');
      router.refresh();
    } else {
      setPendingNotice(true);
    }
  };

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
        await redirectAfterLogin();
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
        await redirectAfterLogin();
      }
    } catch {
      setError(messages['auth.error.loginFailed']);
    } finally {
      setIsLoading(false);
    }
  };

  // 승인 대기 회원 로그인 → 상태·예상 소요·문의처 안내
  if (pendingNotice) {
    return (
      <div className="auth-form auth-pending">
        <div className="auth-pending-icon" aria-hidden="true">…</div>
        <h1 className="auth-title">{messages['auth.pendingLogin.title']}</h1>
        <p className="auth-pending-desc">{messages['auth.pendingLogin.desc']}</p>
        {contactTel && (
          <>
            <p className="auth-pending-contact">{messages['auth.pending.contact']}</p>
            <a href={telHref(contactTel)} className="auth-forgot-call auth-pending-call">
              {messages['auth.forgot.call']} · {contactTel}
            </a>
          </>
        )}
        <button
          type="button"
          className="auth-button"
          onClick={() => {
            router.push('/');
            router.refresh();
          }}
        >
          {messages['auth.pending.home']}
        </button>
      </div>
    );
  }

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

      {/* 비밀번호 분실 안내 — 셀프서비스 재설정(이메일) 도입 전까지 운영진 발급 경로 안내 */}
      <div className="auth-forgot">
        <strong className="auth-forgot-title"><IntlObject keycode="auth.forgot.question" /></strong>
        <p className="auth-forgot-guide"><IntlObject keycode="auth.forgot.guide" /></p>
        {contactTel && (
          <a href={telHref(contactTel)} className="auth-forgot-call">
            <IntlObject keycode="auth.forgot.call" /> · {contactTel}
          </a>
        )}
      </div>
    </form>
  );
}
