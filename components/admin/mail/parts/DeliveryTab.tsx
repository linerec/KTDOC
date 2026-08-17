'use client';

/**
 * 탭 1 · 발송 방법 — Resend / SMTP 선택과 자격증명, 그리고 테스트 발송
 *
 * 테스트 발송이 이 화면의 핵심이다. 메일 설정은 조용히 실패하는 자리라,
 * 저장 직후 눌러볼 수 있는 확인 경로가 없으면 틀린 비밀번호를 실제 가입이
 * 유실될 때에야 알게 된다.
 */

import { useState } from 'react';
import { useT } from '@/lib/i18n/useT';
import { sendTestMail, type TestSendResult } from './useMailSettings';
import type { MailProvider, PublicMailConfig } from '@/types/mail';

interface Props {
  config: PublicMailConfig;
  saving: boolean;
  onSave: (patch: Record<string, unknown>, message: string) => Promise<boolean>;
}

export default function DeliveryTab({ config, saving, onSave }: Props) {
  const t = useT();
  const [provider, setProvider] = useState<MailProvider>(config.provider);
  const [apiKey, setApiKey] = useState('');
  const [smtp, setSmtp] = useState({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    username: config.smtp.username,
    password: '',
  });
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestSendResult | null>(null);

  const handleSave = async () => {
    const patch: Record<string, unknown> = {
      provider,
      smtp: {
        host: smtp.host,
        port: Number(smtp.port),
        secure: smtp.secure,
        username: smtp.username,
        password: smtp.password,
      },
    };
    if (apiKey.trim()) patch.resendApiKey = apiKey;
    const ok = await onSave(
      patch,
      t('admin.mail.delivery.saved', '발송 방법을 저장했습니다.')
    );
    // 시크릿은 저장 후 화면에서 비운다 — 서버가 값을 돌려주지 않으므로
    // 남겨두면 "무엇이 저장돼 있는지"를 오해하게 된다.
    if (ok) {
      setApiKey('');
      setSmtp((p) => ({ ...p, password: '' }));
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setTestResult(await sendTestMail(testTo.trim()));
    setTesting(false);
  };

  const clearSecret = async (which: 'resend' | 'smtp') => {
    const patch =
      which === 'resend'
        ? { clearResendApiKey: true }
        : { clearSmtpPassword: true };
    await onSave(patch, t('admin.mail.delivery.cleared', '저장된 값을 지웠습니다.'));
  };

  return (
    <div className="mail-tab">
      <section className="admin-form-section mail-section">
        <h3 className="admin-form-section-title">
          {t('admin.mail.delivery.title', '어떤 방법으로 보낼까요')}
        </h3>
        <p className="admin-form-help">
          {t(
            'admin.mail.delivery.help',
            'Resend는 웹에서 키 하나만 발급받으면 되고, SMTP는 이미 쓰고 계신 메일 서버가 있을 때 씁니다. 정하지 않으면 서버 환경변수 설정을 그대로 씁니다.'
          )}
        </p>

        <div className="mail-provider-choice">
          {(
            [
              ['', t('admin.mail.provider.none', '미설정 (환경변수 사용)')],
              ['resend', 'Resend'],
              ['smtp', 'SMTP'],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value || 'none'}
              className={`mail-provider-option${provider === value ? ' is-active' : ''}`}
            >
              <input
                type="radio"
                name="mail-provider"
                value={value}
                checked={provider === value}
                onChange={() => setProvider(value as MailProvider)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        {provider !== 'smtp' && (
          <div className="mail-field">
            <label htmlFor="mail-resend-key">
              {t('admin.mail.delivery.apiKey', 'Resend API 키')}
            </label>
            <div className="mail-secret-row">
              <input
                id="mail-resend-key"
                type="password"
                value={apiKey}
                autoComplete="off"
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  config.resendApiKeySet
                    ? t('admin.mail.secretSaved', '저장됨 — 변경할 때만 입력')
                    : 're_...'
                }
              />
              {config.resendApiKeySet && (
                <button
                  type="button"
                  className="admin-btn admin-btn-ghost"
                  onClick={() => void clearSecret('resend')}
                  disabled={saving}
                >
                  {t('admin.mail.secretClear', '지우기')}
                </button>
              )}
            </div>
            <p className="admin-form-help">
              {t(
                'admin.mail.delivery.apiKeyHelp',
                'resend.com에서 발급합니다. 무료 요금제는 하루 100통, 한 달 3,000통까지입니다.'
              )}
            </p>
          </div>
        )}

        {provider === 'smtp' && (
          <div className="mail-smtp-grid">
            <div className="mail-field">
              <label htmlFor="mail-smtp-host">
                {t('admin.mail.smtp.host', '서버 주소')}
              </label>
              <input
                id="mail-smtp-host"
                type="text"
                value={smtp.host}
                onChange={(e) => setSmtp((p) => ({ ...p, host: e.target.value }))}
                placeholder="smtp.example.com"
              />
            </div>

            <div className="mail-field mail-field-narrow">
              <label htmlFor="mail-smtp-port">
                {t('admin.mail.smtp.port', '포트')}
              </label>
              <input
                id="mail-smtp-port"
                type="number"
                min={1}
                max={65535}
                value={smtp.port}
                onChange={(e) =>
                  setSmtp((p) => ({ ...p, port: Number(e.target.value) }))
                }
              />
            </div>

            <div className="mail-field mail-field-check">
              <label>
                <input
                  type="checkbox"
                  checked={smtp.secure}
                  onChange={(e) =>
                    setSmtp((p) => ({ ...p, secure: e.target.checked }))
                  }
                />
                <span>{t('admin.mail.smtp.secure', '보안 연결(TLS) 사용')}</span>
              </label>
              <p className="admin-form-help">
                {t(
                  'admin.mail.smtp.portHelp',
                  '465 포트면 켜고, 587 포트면 끕니다. 25 포트는 쓰지 않습니다.'
                )}
              </p>
            </div>

            <div className="mail-field">
              <label htmlFor="mail-smtp-user">
                {t('admin.mail.smtp.username', '아이디')}
              </label>
              <input
                id="mail-smtp-user"
                type="text"
                value={smtp.username}
                autoComplete="off"
                onChange={(e) =>
                  setSmtp((p) => ({ ...p, username: e.target.value }))
                }
              />
            </div>

            <div className="mail-field">
              <label htmlFor="mail-smtp-pass">
                {t('admin.mail.smtp.password', '비밀번호')}
              </label>
              <div className="mail-secret-row">
                <input
                  id="mail-smtp-pass"
                  type="password"
                  value={smtp.password}
                  autoComplete="off"
                  onChange={(e) =>
                    setSmtp((p) => ({ ...p, password: e.target.value }))
                  }
                  placeholder={
                    config.smtp.passwordSet
                      ? t('admin.mail.secretSaved', '저장됨 — 변경할 때만 입력')
                      : ''
                  }
                />
                {config.smtp.passwordSet && (
                  <button
                    type="button"
                    className="admin-btn admin-btn-ghost"
                    onClick={() => void clearSecret('smtp')}
                    disabled={saving}
                  >
                    {t('admin.mail.secretClear', '지우기')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mail-actions">
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving
              ? t('admin.mail.saving', '저장 중…')
              : t('admin.mail.save', '저장')}
          </button>
        </div>
      </section>

      <section className="admin-form-section mail-section">
        <h3 className="admin-form-section-title">
          {t('admin.mail.test.title', '테스트 발송')}
        </h3>
        <p className="admin-form-help">
          {t(
            'admin.mail.test.help',
            '저장한 설정으로 실제 메일을 한 통 보냅니다. 위에서 저장을 먼저 누른 뒤 시험해 주세요. 설정이 틀리면 여기서 원인이 그대로 표시됩니다.'
          )}
        </p>
        <div className="mail-test-row">
          <input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder={t(
              'admin.mail.test.placeholder',
              '받는 주소 (비우면 운영진 주소로)'
            )}
          />
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => void handleTest()}
            disabled={testing}
          >
            {testing
              ? t('admin.mail.test.sending', '보내는 중…')
              : t('admin.mail.test.send', '보내보기')}
          </button>
        </div>

        {testResult && (
          <div
            className={`mail-test-result${testResult.ok ? ' is-ok' : ' is-fail'}`}
            role="status"
          >
            <strong>{testResult.message}</strong>
            {testResult.detail && (
              <pre className="mail-test-detail">{testResult.detail}</pre>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
