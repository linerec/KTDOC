'use client';

/**
 * FormField — 문항 하나를 유형에 맞게 그린다
 *
 * 접근성 패턴은 components/classes/RegistrationForm.tsx 에서 물려받았다:
 * 라벨을 늘 보이게 두고, 오류는 aria-invalid + aria-describedby 로 잇고,
 * 제출 시 첫 오류 필드로 포커스를 옮긴다(포커스 이동은 FormRenderer 가 맡는다).
 *
 * 긴 안내문은 white-space: pre-line 으로 줄바꿈을 보존한다 — 원본 구글폼의
 * ※ 불릿들이 한 줄로 뭉치면 아무도 읽지 않는다.
 */

import { useT } from '@/lib/i18n/useT';
import type { AnswerError } from '@/lib/forms/schema';
import type { AnswerValue, Bilingual, FormQuestion } from '@/types/forms';

/**
 * 오류 코드를 사람이 읽는 문장으로.
 * 검증 함수는 서버·클라이언트가 함께 쓰므로 문장을 만들지 않는다 —
 * 문장은 화면의 언어를 아는 여기서만 만든다.
 */
export function useAnswerErrorText(): (err?: AnswerError) => string | undefined {
  const t = useT();
  return (err) => {
    if (!err) return undefined;
    switch (err.code) {
      case 'required':
        return t('forms.err.required', '입력해 주세요.');
      case 'selectRequired':
        return t('forms.err.selectRequired', '선택해 주세요.');
      case 'consentRequired':
        return t('forms.err.consentRequired', '동의가 필요합니다.');
      case 'pickOne':
        return t('forms.err.pickOne', '하나 이상 선택해 주세요.');
      case 'pickAtLeast':
        return t('forms.err.pickAtLeast', '{min}개 이상 선택해 주세요.', { min: err.min ?? 1 });
      case 'badOption':
        return t('forms.err.badOption', '선택할 수 없는 항목입니다.');
      case 'badOptions':
        return t('forms.err.badOptions', '선택할 수 없는 항목이 포함되어 있습니다.');
      case 'badEmail':
        return t('forms.err.badEmail', '이메일 형식이 올바르지 않습니다.');
      case 'badTel':
        return t('forms.err.badTel', '전화번호를 확인해 주세요.');
      default:
        return t('forms.err.generic', '다시 확인해 주세요.');
    }
  };
}

/** en 이 비면 ko 로 폴백한다 — 번역이 덜 된 문항이 빈칸으로 보이면 안 된다. */
export function pick(text: Bilingual | undefined, locale: string): string {
  if (!text) return '';
  return locale === 'en' ? text.en || text.ko : text.ko;
}

interface FormFieldProps {
  question: FormQuestion;
  value: AnswerValue;
  error?: AnswerError;
  locale: string;
  onChange: (key: string, value: AnswerValue) => void;
  onBlur: (key: string) => void;
}

export default function FormField({
  question: q,
  value,
  error,
  locale,
  onChange,
  onBlur,
}: FormFieldProps) {
  const errorText = useAnswerErrorText()(error);
  const id = `f-${q.key}`;
  const errId = `err-${q.key}`;
  const label = pick(q.label, locale);
  const help = pick(q.help, locale);

  // 안내 블록 — 답을 받지 않는다. 문항 사이의 설명 자리다.
  if (q.type === 'info') {
    return (
      <div className="form-info" role="note">
        {label && <h3 className="form-info-title">{label}</h3>}
        {help && <p className="form-info-body">{help}</p>}
      </div>
    );
  }

  const labelNode = (
    <span className="form-q-label">
      {label}
      {q.required && <span className="required" aria-hidden="true"> *</span>}
    </span>
  );

  const helpNode = help ? (
    <p className="form-q-help" id={`help-${q.key}`}>
      {help}
    </p>
  ) : null;

  const describedBy = [error ? errId : null, help ? `help-${q.key}` : null]
    .filter(Boolean)
    .join(' ') || undefined;

  const errorNode = errorText ? (
    <span className="form-error" id={errId}>
      {errorText}
    </span>
  ) : null;

  // ── 단답 ───────────────────────────────────────────────
  if (q.type === 'short') {
    return (
      <div className="form-field form-q">
        <label htmlFor={id}>{labelNode}</label>
        {helpNode}
        <input
          id={id}
          type={q.format === 'email' ? 'email' : q.format === 'tel' ? 'tel' : 'text'}
          inputMode={q.format === 'tel' ? 'tel' : undefined}
          autoComplete={
            q.bind === 'email' ? 'email' : q.bind === 'phone' ? 'tel' : q.bind ? 'name' : 'off'
          }
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(q.key, e.target.value)}
          onBlur={() => onBlur(q.key)}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          required={q.required}
        />
        {errorNode}
      </div>
    );
  }

  // ── 장문 ───────────────────────────────────────────────
  if (q.type === 'long') {
    return (
      <div className="form-field form-q">
        <label htmlFor={id}>{labelNode}</label>
        {helpNode}
        <textarea
          id={id}
          rows={4}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(q.key, e.target.value)}
          onBlur={() => onBlur(q.key)}
          aria-invalid={!!error}
          aria-describedby={describedBy}
        />
        {errorNode}
      </div>
    );
  }

  // ── 동의(단일 체크) ────────────────────────────────────
  if (q.type === 'consent') {
    return (
      <div className={`form-q form-consent${error ? ' form-consent-error' : ''}`}>
        {helpNode}
        <div className="form-consent-row">
          <input
            id={id}
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(q.key, e.target.checked)}
            onBlur={() => onBlur(q.key)}
            aria-invalid={!!error}
            aria-describedby={describedBy}
          />
          <label htmlFor={id}>{labelNode}</label>
        </div>
        {errorNode}
      </div>
    );
  }

  // ── 단일선택 ───────────────────────────────────────────
  if (q.type === 'single') {
    const live = (q.options ?? []).filter((o) => !o.retired);
    return (
      <fieldset className="form-q form-choice" aria-invalid={!!error} aria-describedby={describedBy}>
        <legend>{labelNode}</legend>
        {helpNode}
        <div className="form-options">
          {live.map((o) => (
            <label key={o.key} className={`form-option${value === o.key ? ' is-picked' : ''}`}>
              <input
                type="radio"
                name={q.key}
                value={o.key}
                checked={value === o.key}
                onChange={() => onChange(q.key, o.key)}
                onBlur={() => onBlur(q.key)}
              />
              <span>{pick(o.label, locale)}</span>
            </label>
          ))}
        </div>
        {errorNode}
      </fieldset>
    );
  }

  // ── 다중선택 ───────────────────────────────────────────
  const live = (q.options ?? []).filter((o) => !o.retired);
  const picked = Array.isArray(value) ? value : [];

  return (
    <fieldset className="form-q form-choice" aria-invalid={!!error} aria-describedby={describedBy}>
      <legend>{labelNode}</legend>
      {helpNode}
      <div className="form-options">
        {live.map((o) => {
          const on = picked.includes(o.key);
          return (
            <label key={o.key} className={`form-option${on ? ' is-picked' : ''}`}>
              <input
                type="checkbox"
                // name 이 있어야 제출 오류 때 이 문항으로 포커스가 옮겨간다
                // (FormRenderer.focusFirstError 가 [name="키"] 로 찾는다).
                name={q.key}
                value={o.key}
                checked={on}
                onChange={() => {
                  // exclusive 선택지("해당 없음")를 고르면 나머지를 해제하고,
                  // 다른 것을 고르면 exclusive 를 해제한다 — 둘이 동시에 켜지면 뜻이 모순된다.
                  if (o.exclusive) {
                    onChange(q.key, on ? [] : [o.key]);
                    return;
                  }
                  const exclusiveKeys = new Set(
                    live.filter((x) => x.exclusive).map((x) => x.key)
                  );
                  const next = on
                    ? picked.filter((k) => k !== o.key)
                    : [...picked.filter((k) => !exclusiveKeys.has(k)), o.key];
                  onChange(q.key, next);
                }}
                onBlur={() => onBlur(q.key)}
              />
              <span>{pick(o.label, locale)}</span>
            </label>
          );
        })}
      </div>
      {errorNode}
    </fieldset>
  );
}
