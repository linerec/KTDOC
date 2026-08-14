'use client';

/**
 * FormRenderer — 공개 신청서를 그리고 제출한다
 *
 * 조건부 노출을 **매 렌더 다시 계산한다**(visibleQuestions). 이것이 구글폼과 갈리는
 * 지점이다 — 공연에 참가한다고 답하면 미참가 사유가 사라지고, 중고등부 작품반을
 * 고르면 칼 소품비 동의가 그 자리에서 나타난다.
 *
 * 화면에서 사라진 문항의 답은 제출 직전에 버린다. 남겨 두면 "보지도 않은 항목에
 * 동의한 것으로 기록되는" 일이 생긴다 — 서버도 같은 규칙으로 한 번 더 거른다.
 *
 * 클라이언트 검증은 편의일 뿐이다. 진짜 판정은 서버가 같은 함수로 다시 한다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useT } from '@/lib/i18n/useT';
import { validateAnswers, visibleQuestions } from '@/lib/forms/schema';
import AccountBlock, { EMPTY_ACCOUNT, type AccountDraft } from './AccountBlock';
import FormField, { pick } from './FormField';
import type { AnswerValue, Answers, FormSchema } from '@/types/forms';

export interface FormPrefill {
  /** 로그인 회원이면 세션에서 채워 온다. 비회원이면 전부 빈 값이다. */
  values: Answers;
  /** 로그인 상태 표시용 이름. 없으면 안내를 띄우지 않는다. */
  memberName?: string | null;
}

interface FormRendererProps {
  slug: string;
  schema: FormSchema;
  locale?: string;
  prefill?: FormPrefill;
  /** 초안 미리보기 — 실제로 제출되지 않는다. */
  preview?: boolean;
  /**
   * 보낼 곳. 기본은 공개 제출이고, 대리 입력 화면이 관리 라우트를 준다.
   * 화면은 같은 것을 보여줘야 하므로(운영진이 학부모가 보는 것을 그대로 본다)
   * 렌더러를 복제하지 않고 보내는 곳만 바꾼다.
   */
  submitTo?: string;
  /** 제출 후 갈 곳. 기본은 완료 화면. */
  doneHref?: (responseId: number) => string;
  /** 제출 버튼 문구를 바꿀 때(대리 입력) */
  submitLabel?: string;
  /**
   * 로그인·가입 블록을 보일지. 비회원 공개 제출에서만 켠다 —
   * 로그인한 사람에게는 필요 없고, 대리 입력은 운영진이 남의 계정을 만드는 자리가 아니다.
   */
  showAccount?: boolean;
}

export default function FormRenderer({
  slug,
  schema,
  prefill,
  preview = false,
  submitTo,
  doneHref,
  submitLabel,
  showAccount = false,
}: FormRendererProps) {
  const t = useT();
  const router = useRouter();
  const { locale } = useLanguage();

  const [answers, setAnswers] = useState<Answers>(prefill?.values ?? {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountDraft>(EMPTY_ACCOUNT);
  const [accountErrors, setAccountErrors] = useState<Record<string, string>>({});

  const formRef = useRef<HTMLFormElement>(null);
  // 스팸 방어 1: 사람은 이 칸을 채울 수 없다(화면에서 숨겨져 있다).
  const [honeypot, setHoneypot] = useState('');
  // 스팸 방어 2: 열자마자 제출되는 것은 사람이 아니다.
  // 렌더 중에 Date.now()를 부르면 순수하지 않으므로 마운트 시점에 한 번만 찍는다.
  const renderedAt = useRef<number | null>(null);
  useEffect(() => {
    renderedAt.current = Date.now();
  }, []);

  const visible = useMemo(() => visibleQuestions(schema, answers), [schema, answers]);

  const handleChange = useCallback((key: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    // 고치는 중에는 오류를 지워 준다 — 타이핑하는 내내 빨간 글씨가 떠 있으면 성가시다.
    setErrors((prev) => (prev[key] ? { ...prev, [key]: '' } : prev));
  }, []);

  const handleBlur = useCallback(
    (key: string) => {
      setTouched((prev) => ({ ...prev, [key]: true }));
      setAnswers((current) => {
        const found = validateAnswers(schema, current)[key];
        setErrors((prev) => ({ ...prev, [key]: found ?? '' }));
        return current;
      });
    },
    [schema]
  );

  /** 화면에 없는 문항의 답을 버린다 — 조건이 바뀌어 사라진 답이 따라가면 안 된다. */
  const prune = useCallback(
    (raw: Answers): Answers => {
      const keep = new Set(visibleQuestions(schema, raw).map((q) => q.key));
      return Object.fromEntries(Object.entries(raw).filter(([k]) => keep.has(k)));
    },
    [schema]
  );

  const focusFirstError = useCallback((keys: string[]) => {
    for (const key of keys) {
      const el = formRef.current?.querySelector<HTMLElement>(
        `#f-${CSS.escape(key)}, [name="${CSS.escape(key)}"]`
      );
      if (el) {
        el.focus();
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const pruned = prune(answers);
    const found = validateAnswers(schema, pruned);
    const keys = Object.keys(found);

    if (keys.length > 0) {
      setErrors(found);
      setTouched(Object.fromEntries(keys.map((k) => [k, true])));
      setSubmitError(
        t('forms.submit.hasErrors', '아직 채우지 않은 항목이 있습니다. 표시된 곳을 확인해 주세요.')
      );
      focusFirstError(visible.map((q) => q.key).filter((k) => keys.includes(k)));
      return;
    }

    // 가입을 원하면 계정 항목도 여기서 막는다 — 서버가 다시 보지만,
    // 폼을 다 채운 뒤 비밀번호 하나 때문에 되돌아오는 일을 줄인다.
    if (showAccount && account.wants) {
      const acctErrors: Record<string, string> = {};
      if (account.password.length < 8) acctErrors.password = '비밀번호는 8자 이상이어야 합니다.';
      if (!account.agreed) acctErrors.agreed = '이용약관과 개인정보처리방침에 동의해 주세요.';
      if (Object.keys(acctErrors).length > 0) {
        setAccountErrors(acctErrors);
        setSubmitError(
          t('forms.account.fixErrors', '회원가입 항목을 확인해 주세요.')
        );
        document.getElementById('acct-pw')?.focus();
        return;
      }
      setAccountErrors({});
    }

    if (preview) {
      setSubmitError(
        t('forms.submit.previewOnly', '미리 보기에서는 제출되지 않습니다. 게시한 뒤에 실제로 접수됩니다.')
      );
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(submitTo ?? `/api/forms/${encodeURIComponent(slug)}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: pruned,
          locale,
          renderedAt: renderedAt.current ?? Date.now(),
          website: honeypot,
          account:
            showAccount && account.wants
              ? { role: account.role, password: account.password, agreed: account.agreed }
              : undefined,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        if (json.fieldErrors && typeof json.fieldErrors === 'object') {
          setErrors(json.fieldErrors);
          focusFirstError(Object.keys(json.fieldErrors));
        }
        setSubmitError(json.error || t('forms.submit.failed', '제출에 실패했습니다. 잠시 후 다시 시도해 주세요.'));
        setSubmitting(false);
        return;
      }

      router.push(
        doneHref
          ? doneHref(json.data.responseId)
          : `/f/${encodeURIComponent(slug)}/done?r=${json.data.responseId}` +
            (json.data.account ? `&a=${json.data.account}` : '')
      );
    } catch {
      setSubmitError(t('forms.submit.network', '연결이 끊어졌습니다. 잠시 후 다시 시도해 주세요.'));
      setSubmitting(false);
    }
  }

  const visibleKeys = new Set(visible.map((q) => q.key));

  /** 계정 블록에 보여줄 값 — 문항의 bind 지시자로 찾는다(문항 키에 기대지 않는다). */
  const boundValue = (bind: string): string => {
    const q = visible.find((x) => x.bind === bind);
    const v = q ? answers[q.key] : null;
    return typeof v === 'string' ? v : '';
  };
  const emailValue = boundValue('email');
  const studentNameValue = boundValue('student_name');
  const guardianNameValue = boundValue('guardian_name');

  return (
    <form ref={formRef} className="public-form" onSubmit={handleSubmit} noValidate>
      {prefill?.memberName && (
        <p className="form-signed-in">
          {t('forms.signedInAs', '{name} 님으로 작성 중입니다. 회원 정보가 미리 채워졌습니다.', {
            name: prefill.memberName,
          })}
        </p>
      )}

      {schema.sections.map((section) => {
        const shown = section.questions.filter((q) => visibleKeys.has(q.key));
        if (shown.length === 0) return null;

        return (
          <section key={section.key} className="form-section">
            {section.title && (
              <h2 className="form-section-title">{pick(section.title, locale)}</h2>
            )}
            {section.body && <p className="form-section-body">{pick(section.body, locale)}</p>}

            <div className="form-section-fields">
              {shown.map((q) => (
                <FormField
                  key={q.key}
                  question={q}
                  value={answers[q.key] ?? null}
                  error={touched[q.key] ? errors[q.key] || undefined : errors[q.key] || undefined}
                  locale={locale}
                  onChange={handleChange}
                  onBlur={handleBlur}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* 스팸 방어 — 화면에서 감춰져 있고 사람은 채울 수 없다 */}
      <div className="register-hp" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {showAccount && (
        <AccountBlock
          email={emailValue}
          studentName={studentNameValue}
          guardianName={guardianNameValue}
          value={account}
          onChange={setAccount}
          loginHref={`/login?callbackUrl=${encodeURIComponent(`/f/${slug}`)}`}
          errors={accountErrors}
        />
      )}

      {submitError && (
        <div className="form-alert" role="alert">
          {submitError}
        </div>
      )}

      <button type="submit" className="form-submit" disabled={submitting}>
        {submitting
          ? t('forms.submit.sending', '보내는 중…')
          : preview
            ? t('forms.submit.previewLabel', '미리 보기 — 제출되지 않습니다')
            : (submitLabel ?? t('forms.submit.label', '신청서 제출'))}
      </button>
    </form>
  );
}
