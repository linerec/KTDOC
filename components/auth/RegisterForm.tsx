'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import IntlObject from '@/components/common/IntlObject';
import { useLanguage } from '@/contexts/LanguageContext';
import type { SignupRole } from '@/types/members';

/** 입학년도 선택지: 올해부터 과거 12년치 */
function enrollmentYears(): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: 13 }, (_, i) => current - i);
}

export default function RegisterForm() {
  const router = useRouter();
  const { messages } = useLanguage();

  const [role, setRole] = useState<SignupRole>('student');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // 원생
  const [enrollmentYear, setEnrollmentYear] = useState('');
  // 학부모
  const [childName, setChildName] = useState('');
  const [childEnrollmentYear, setChildEnrollmentYear] = useState('');

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const years = enrollmentYears();

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
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          name,
          email,
          phone,
          password,
          ...(role === 'student'
            ? { enrollmentYear }
            : { childName, childEnrollmentYear }),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || messages['auth.error.registerFailed']);
        return;
      }

      // 승인 대기 상태지만 로그인은 허용 — 백그라운드 자동 로그인 후 대기 안내 표시
      await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      setSubmitted(true);
    } catch {
      setError(messages['auth.error.registerFailed']);
    } finally {
      setIsLoading(false);
    }
  };

  // 가입 완료 → 승인 대기 안내
  if (submitted) {
    return (
      <div className="auth-form auth-pending">
        <div className="auth-pending-icon" aria-hidden="true">✓</div>
        <h1 className="auth-title">{messages['auth.pending.title']}</h1>
        <p className="auth-pending-desc">{messages['auth.pending.desc']}</p>
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
      <IntlObject keycode="auth.register" returnType="h1" className="auth-title" />

      {error && <div className="auth-error">{error}</div>}

      {/* 가입 유형 선택 */}
      <div className="auth-role-toggle" role="radiogroup" aria-label={messages['auth.role.select']}>
        <button
          type="button"
          role="radio"
          aria-checked={role === 'student'}
          className={`auth-role-option${role === 'student' ? ' is-active' : ''}`}
          onClick={() => setRole('student')}
          disabled={isLoading}
        >
          <span className="auth-role-name">{messages['auth.role.student']}</span>
          <span className="auth-role-desc">{messages['auth.role.studentDesc']}</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={role === 'parent'}
          className={`auth-role-option${role === 'parent' ? ' is-active' : ''}`}
          onClick={() => setRole('parent')}
          disabled={isLoading}
        >
          <span className="auth-role-name">{messages['auth.role.parent']}</span>
          <span className="auth-role-desc">{messages['auth.role.parentDesc']}</span>
        </button>
      </div>

      <div className="auth-field">
        <label htmlFor="name"><IntlObject keycode="auth.name" /></label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={messages['auth.name.placeholder']}
          required
          disabled={isLoading}
        />
      </div>

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
        <label htmlFor="phone"><IntlObject keycode="auth.phone" /></label>
        <input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={messages['auth.phone.placeholder']}
          disabled={isLoading}
        />
      </div>

      {/* 원생: 입학년도 */}
      {role === 'student' && (
        <div className="auth-field">
          <label htmlFor="enrollmentYear"><IntlObject keycode="auth.enrollmentYear" /></label>
          <select
            id="enrollmentYear"
            value={enrollmentYear}
            onChange={(e) => setEnrollmentYear(e.target.value)}
            required
            disabled={isLoading}
          >
            <option value="" disabled>{messages['auth.enrollmentYear.placeholder']}</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      )}

      {/* 학부모: 자녀 정보 */}
      {role === 'parent' && (
        <>
          <div className="auth-hint">
            <strong>{messages['auth.parent.guideTitle']}</strong>
            <span>{messages['auth.parent.guide']}</span>
          </div>
          <div className="auth-field">
            <label htmlFor="childName"><IntlObject keycode="auth.childName" /></label>
            <input
              id="childName"
              type="text"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder={messages['auth.childName.placeholder']}
              required
              disabled={isLoading}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="childEnrollmentYear"><IntlObject keycode="auth.childEnrollmentYear" /></label>
            <select
              id="childEnrollmentYear"
              value={childEnrollmentYear}
              onChange={(e) => setChildEnrollmentYear(e.target.value)}
              required
              disabled={isLoading}
            >
              <option value="" disabled>{messages['auth.enrollmentYear.placeholder']}</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </>
      )}

      <div className="auth-field">
        <label htmlFor="password"><IntlObject keycode="auth.password" /></label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={messages['auth.password.minPlaceholder']}
          required
          disabled={isLoading}
        />
      </div>

      <div className="auth-field">
        <label htmlFor="confirmPassword"><IntlObject keycode="auth.confirmPassword" /></label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder={messages['auth.confirmPassword.placeholder']}
          required
          disabled={isLoading}
        />
      </div>

      <button type="submit" className="auth-button" disabled={isLoading}>
        {isLoading ? messages['auth.register.loading'] : messages['auth.register']}
      </button>

      <p className="auth-link">
        <IntlObject keycode="auth.hasAccount" /> <Link href="/login"><IntlObject keycode="auth.login" /></Link>
      </p>
    </form>
  );
}
