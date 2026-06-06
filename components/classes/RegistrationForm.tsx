'use client';

/**
 * RegistrationForm
 * 수업·캠프 인라인 신청 폼. /api/applications 로 제출.
 * 허니팟(website) + 최소 제출시간(_t)으로 스팸 방지. 캠프/수업은 보호자명 필수.
 * 접근성: 라벨 상시 노출, on-blur 검증, aria-invalid/describedby, 성공 시 포커스 이동.
 */

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { ProgramType } from '@/types/programs';

interface RegistrationFormProps {
  programId: number;
  programType: ProgramType;
  programTitleKo: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = Partial<Record<'applicant_name' | 'guardian_name' | 'email' | 'consent', string>>;

export default function RegistrationForm({ programId, programType, programTitleKo }: RegistrationFormProps) {
  const { locale, messages } = useLanguage();
  const isKo = locale === 'ko';
  const t = (key: string, fallback: string) => messages[key] || fallback;

  const guardianRequired = programType === 'camp' || programType === 'class';

  const [form, setForm] = useState({
    applicant_name: '',
    guardian_name: '',
    email: '',
    phone: '',
    participant_age: '',
    message: '',
    consent: false,
    website: '', // honeypot
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const renderedAt = useRef<number>(0);
  const successRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    renderedAt.current = Date.now();
  }, []);

  useEffect(() => {
    if (success && successRef.current) {
      successRef.current.focus();
    }
  }, [success]);

  const validateField = (name: keyof FieldErrors, value: string | boolean): string | undefined => {
    switch (name) {
      case 'applicant_name':
        return !String(value).trim() ? t('register.err.required', '필수 항목입니다.') : undefined;
      case 'guardian_name':
        return guardianRequired && !String(value).trim()
          ? t('register.err.required', '필수 항목입니다.')
          : undefined;
      case 'email':
        if (!String(value).trim()) return t('register.err.required', '필수 항목입니다.');
        return !EMAIL_RE.test(String(value)) ? t('register.err.email', '올바른 이메일 형식이 아닙니다.') : undefined;
      case 'consent':
        return value !== true ? t('register.err.consent', '동의가 필요합니다.') : undefined;
      default:
        return undefined;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const v = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setForm((prev) => ({ ...prev, [name]: v }));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const name = e.target.name as keyof FieldErrors;
    if (['applicant_name', 'guardian_name', 'email', 'consent'].includes(name)) {
      const value = name === 'consent' ? form.consent : (form[name as keyof typeof form] as string);
      setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
    }
  };

  const validateAll = (): FieldErrors => {
    const next: FieldErrors = {
      applicant_name: validateField('applicant_name', form.applicant_name),
      email: validateField('email', form.email),
      consent: validateField('consent', form.consent),
    };
    if (guardianRequired) next.guardian_name = validateField('guardian_name', form.guardian_name);
    Object.keys(next).forEach((k) => {
      if (!next[k as keyof FieldErrors]) delete next[k as keyof FieldErrors];
    });
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const validation = validateAll();
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      const firstKey = Object.keys(validation)[0];
      document.getElementById(`reg-${firstKey}`)?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_id: programId,
          applicant_name: form.applicant_name,
          guardian_name: form.guardian_name || undefined,
          email: form.email,
          phone: form.phone || undefined,
          participant_age: form.participant_age || undefined,
          message: form.message || undefined,
          consent: form.consent,
          website: form.website,
          _t: renderedAt.current,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || t('register.errorGeneric', '신청 접수에 실패했습니다.'));
      }
      setSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('register.errorGeneric', '신청 접수에 실패했습니다.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="register-panel register-success" ref={successRef} tabIndex={-1} role="status">
        <span className="register-success-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
        <h3 className="register-success-title">{t('register.successTitle', '신청이 접수되었습니다')}</h3>
        <p className="register-success-body">
          {t('register.successBody', '확인 후 며칠 내로 이메일 또는 전화로 연락드리겠습니다.')}
        </p>
      </div>
    );
  }

  return (
    <form className="register-panel" onSubmit={handleSubmit} noValidate>
      <h3 className="register-title">{t('register.title', '신청서')}</h3>
      <p className="register-intro">
        {t('register.intro', '아래 정보를 남겨주시면 담당자가 확인 후 연락드립니다.')} — {programTitleKo}
      </p>

      {submitError && (
        <div className="register-alert" role="alert">
          {submitError}
        </div>
      )}

      <div className="register-field">
        <label htmlFor="reg-applicant_name">
          {t('register.applicantName', '참가자 이름')} <span className="required">*</span>
        </label>
        <input
          id="reg-applicant_name"
          name="applicant_name"
          type="text"
          autoComplete="name"
          value={form.applicant_name}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={!!errors.applicant_name}
          aria-describedby={errors.applicant_name ? 'err-applicant_name' : undefined}
        />
        {errors.applicant_name && (
          <span className="register-error" id="err-applicant_name">
            {errors.applicant_name}
          </span>
        )}
      </div>

      <div className="register-field">
        <label htmlFor="reg-guardian_name">
          {t('register.guardianName', '보호자 이름')}
          {guardianRequired && <span className="required">*</span>}
        </label>
        <input
          id="reg-guardian_name"
          name="guardian_name"
          type="text"
          autoComplete="name"
          value={form.guardian_name}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={!!errors.guardian_name}
          aria-describedby={errors.guardian_name ? 'err-guardian_name' : undefined}
        />
        {errors.guardian_name && (
          <span className="register-error" id="err-guardian_name">
            {errors.guardian_name}
          </span>
        )}
      </div>

      <div className="register-row">
        <div className="register-field">
          <label htmlFor="reg-email">
            {t('register.email', '이메일')} <span className="required">*</span>
          </label>
          <input
            id="reg-email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            onBlur={handleBlur}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'err-email' : undefined}
          />
          {errors.email && (
            <span className="register-error" id="err-email">
              {errors.email}
            </span>
          )}
        </div>

        <div className="register-field">
          <label htmlFor="reg-phone">{t('register.phone', '전화번호')}</label>
          <input
            id="reg-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="register-field">
        <label htmlFor="reg-participant_age">{t('register.age', '참가자 나이')}</label>
        <input
          id="reg-participant_age"
          name="participant_age"
          type="text"
          value={form.participant_age}
          onChange={handleChange}
          placeholder={isKo ? '예: 9세' : 'e.g. 9'}
        />
      </div>

      <div className="register-field">
        <label htmlFor="reg-message">{t('register.message', '요청 사항 (알레르기·특이사항 등)')}</label>
        <textarea
          id="reg-message"
          name="message"
          rows={4}
          value={form.message}
          onChange={handleChange}
        />
      </div>

      {/* honeypot — 사람에게 보이지 않음 */}
      <div className="register-hp" aria-hidden="true">
        <label htmlFor="reg-website">Website</label>
        <input
          id="reg-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={handleChange}
        />
      </div>

      <div className={`register-consent ${errors.consent ? 'register-consent-error' : ''}`}>
        <input
          id="reg-consent"
          name="consent"
          type="checkbox"
          checked={form.consent}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={!!errors.consent}
          aria-describedby={errors.consent ? 'err-consent' : undefined}
        />
        <label htmlFor="reg-consent">
          {t(
            'register.consent',
            '춤누리가 본 신청을 처리하고 보호자에게 연락하기 위한 목적으로만 입력 정보를 사용하는 데 동의합니다.'
          )}
          <span className="required">*</span>
        </label>
      </div>
      {errors.consent && (
        <span className="register-error" id="err-consent">
          {errors.consent}
        </span>
      )}

      <button type="submit" className="btn-ink-primary register-submit" disabled={submitting}>
        {submitting
          ? t('register.submitting', '신청 접수 중…')
          : t('register.submit', '신청 제출')}
      </button>
    </form>
  );
}
