'use client';

/**
 * AccountBlock — 신청서 안에서 로그인하거나 그 자리에서 가입한다
 *
 * 신청서는 많은 가족이 이 사이트를 처음 만나는 자리다. 여기서 가입까지 되면
 * 다음부터 신청 내역·수업 일정·공지가 전부 이어진다. 반대로 이 화면에서
 * "회원가입 하려면 다른 데로 가세요"라고 하면 아무도 가입하지 않는다.
 *
 * **위에 적은 이메일이 그대로 계정 이메일이 된다는 것을 화면에 못박는다.**
 * 비밀번호만 정하면 끝이라는 사실이 보이지 않으면 아무도 열지 않는다.
 *
 * **신청서 맨 앞에 둔다.** 로그인은 무엇을 쓰기 전에 정해야 하는 일이다 —
 * 다 쓴 뒤에 로그인하러 가면 페이지를 떠나면서 쓴 내용이 사라진다.
 *
 * 이미 그 이메일로 계정이 있으면 **여기서 자동으로 잇지 않는다.** 이 사이트는
 * 가입 시 이메일을 확인하지 않으므로, 이메일이 같다는 것만으로 같은 사람이라고
 * 볼 수 없다. 그때는 로그인을 권한다.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useT } from '@/lib/i18n/useT';

export interface AccountDraft {
  wants: boolean;
  role: 'student' | 'parent';
  password: string;
  agreed: boolean;
}

export const EMPTY_ACCOUNT: AccountDraft = {
  wants: false,
  role: 'parent',
  password: '',
  agreed: false,
};

interface AccountBlockProps {
  /** 위 문항에 적힌 이메일 — 계정 이메일이 된다 */
  email: string;
  /** 학생 이름 — 학부모로 가입하면 자녀 이름이 된다 */
  studentName: string;
  /** 보호자 이름 — 있으면 학부모 가입의 계정 이름이 된다 */
  guardianName: string;
  value: AccountDraft;
  onChange: (next: AccountDraft) => void;
  loginHref: string;
  /** 번역된 문장이 아니라 키를 받는다 — 언어를 바꾸면 함께 바뀌어야 한다. */
  errors?: Record<string, { key: string; fallback: string }>;
}

export default function AccountBlock({
  email,
  studentName,
  guardianName,
  value,
  onChange,
  loginHref,
  errors = {},
}: AccountBlockProps) {
  const t = useT();
  const [confirm, setConfirm] = useState('');

  const set = (patch: Partial<AccountDraft>) => onChange({ ...value, ...patch });

  const accountName =
    value.role === 'parent' ? guardianName.trim() || studentName.trim() : studentName.trim();
  const mismatch = value.password.length > 0 && confirm.length > 0 && value.password !== confirm;

  return (
    <section className="account-block">
      <h2 className="form-section-title">
        {t('forms.account.title', 'KTDOC 회원 계정')}
      </h2>

      <div className="account-signin">
        <p>
          {t('forms.account.already', '이미 회원이신가요?')}
        </p>
        <Link href={loginHref} className="account-signin-btn">
          {t('forms.account.loginCta', '로그인하고 이어서 작성하기')}
        </Link>
        <p className="account-signin-note">
          {t('forms.account.loginNote', '먼저 로그인하시면 이름·이메일이 자동으로 채워지고, 이 신청이 회원 계정에 남습니다.')}
        </p>
      </div>

      <div className="account-divider" aria-hidden="true">
        <span>{t('forms.account.or', '또는')}</span>
      </div>

      <label className="account-optin">
        <input
          type="checkbox"
          checked={value.wants}
          onChange={(e) => set({ wants: e.target.checked })}
        />
        <span>
          <strong>
            {t('forms.account.optIn', '회원으로 가입하겠습니다')}
          </strong>
          <span className="account-optin-sub">
            {t('forms.account.optInSub', '비밀번호만 정하시면 됩니다. 아래 신청서에 적으실 이메일이 그대로 로그인 아이디가 됩니다.')}
          </span>
        </span>
      </label>

      {value.wants && (
        <div className="account-fields">
          <div className="account-echo">
            <span className="account-echo-label">
              {t('forms.account.emailLabel', '로그인 이메일')}
            </span>
            <strong className="account-echo-value">
              {email.trim() || (
                <em>
                  {t('forms.account.emailMissing', '아래 이메일 문항을 적으시면 여기에 표시됩니다')}
                </em>
              )}
            </strong>
          </div>

          <fieldset className="form-choice">
            <legend>
              <span className="form-q-label">
                {t('forms.account.who', '가입하시는 분은')}
              </span>
            </legend>
            <div className="form-options">
              <label className={`form-option${value.role === 'parent' ? ' is-picked' : ''}`}>
                <input
                  type="radio"
                  name="account-role"
                  checked={value.role === 'parent'}
                  onChange={() => set({ role: 'parent' })}
                />
                <span>
                  {t('forms.account.roleParent', '학부모 · 보호자입니다')}
                </span>
              </label>
              <label className={`form-option${value.role === 'student' ? ' is-picked' : ''}`}>
                <input
                  type="radio"
                  name="account-role"
                  checked={value.role === 'student'}
                  onChange={() => set({ role: 'student' })}
                />
                <span>
                  {t('forms.account.roleStudent', '학생 본인입니다')}
                </span>
              </label>
            </div>
          </fieldset>

          {accountName && (
            <p className="account-name-note">
              {t('forms.account.nameNote', '‘{name}’ 이름으로 계정이 만들어집니다.', {
                name: accountName,
              })}
            </p>
          )}

          <div className="form-field">
            <label htmlFor="acct-pw">
              <span className="form-q-label">
                {t('forms.account.password', '비밀번호')}
                <span className="required" aria-hidden="true"> *</span>
              </span>
            </label>
            <p className="form-q-help">
              {t('forms.account.passwordHelp', '8자 이상으로 정해 주세요.')}
            </p>
            <input
              id="acct-pw"
              type="password"
              autoComplete="new-password"
              value={value.password}
              onChange={(e) => set({ password: e.target.value })}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'err-acct-pw' : undefined}
            />
            {errors.password && (
              <span className="form-error" id="err-acct-pw">
                {t(errors.password.key, errors.password.fallback)}
              </span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="acct-pw2">
              <span className="form-q-label">
                {t('forms.account.passwordConfirm', '비밀번호 확인')}
              </span>
            </label>
            <input
              id="acct-pw2"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={mismatch}
            />
            {mismatch && (
              <span className="form-error">
                {t('forms.account.passwordMismatch', '두 비밀번호가 다릅니다.')}
              </span>
            )}
          </div>

          <div className="form-consent">
            <div className="form-consent-row">
              <input
                id="acct-terms"
                type="checkbox"
                checked={value.agreed}
                onChange={(e) => set({ agreed: e.target.checked })}
                aria-invalid={!!errors.agreed}
              />
              <label htmlFor="acct-terms">
                <span className="form-q-label">
                  {/* 문장 구조가 언어마다 달라 앞·사이·뒤 세 조각으로 나눠 둔다.
                      한국어는 앞이 비고 뒤에 '~에 동의합니다'가 붙는다. */}
                  {t('forms.account.termsPre', '')}
                  <Link href="/terms" target="_blank" className="account-link">
                    {t('forms.account.termsLink', '이용약관')}
                  </Link>
                  {t('forms.account.termsMid', '과 ')}
                  <Link href="/privacy" target="_blank" className="account-link">
                    {t('forms.account.privacyLink', '개인정보처리방침')}
                  </Link>
                  {t('forms.account.termsPost', '에 동의합니다.')}
                  <span className="required" aria-hidden="true"> *</span>
                </span>
              </label>
            </div>
            {errors.agreed && (
              <span className="form-error">{t(errors.agreed.key, errors.agreed.fallback)}</span>
            )}
          </div>

          <ul className="account-benefits">
            <li>
              {t('forms.account.benefit1', '내신 신청 내용과 처리 상태를 확인하실 수 있습니다')}
            </li>
            <li>
              {t('forms.account.benefit2', '수업 일정과 공지를 받아보실 수 있습니다')}
            </li>
            <li>
              {t('forms.account.benefit3', '다음에 신청하실 때 정보가 자동으로 채워집니다')}
            </li>
          </ul>

          <p className="account-pending-note">
            {t('forms.account.pendingNote', '신청서를 제출하시면 가입도 함께 접수됩니다. 가입은 학원 확인 후 승인되며, 승인 전에도 신청서는 정상적으로 접수됩니다.')}
          </p>
        </div>
      )}
    </section>
  );
}
