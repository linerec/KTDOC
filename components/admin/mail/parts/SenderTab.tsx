'use client';

/**
 * 탭 2 · 발신 정보 — 보내는 주소·표시 이름·답장 주소·운영진 주소, 그리고 한도
 *
 * '보내는 주소'와 '답장 받을 주소'가 다르다는 점이 이 화면의 요점이다.
 * 보내는 주소는 도메인 인증이 필요해서 아무 주소나 쓸 수 없지만, 답장 주소는
 * 검사받지 않으므로 늘 쓰던 지메일을 그대로 넣을 수 있다.
 */

import { useState } from 'react';
import { useT } from '@/lib/i18n/useT';
import type { PublicMailConfig } from '@/types/mail';
import type { EffectiveState } from './useMailSettings';

interface Props {
  config: PublicMailConfig;
  effective: EffectiveState;
  saving: boolean;
  onSave: (patch: Record<string, unknown>, message: string) => Promise<boolean>;
}

export default function SenderTab({ config, effective, saving, onSave }: Props) {
  const t = useT();
  const [from, setFrom] = useState(config.from);
  const [fromName, setFromName] = useState(config.fromName);
  const [replyTo, setReplyTo] = useState(config.replyTo);
  const [staffTo, setStaffTo] = useState(config.staffTo.join('\n'));
  const [quota, setQuota] = useState(config.quota);

  const handleSave = () =>
    onSave(
      {
        from,
        fromName,
        replyTo,
        staffTo: staffTo
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        quota: {
          dailyLimit: Number(quota.dailyLimit),
          monthlyLimit: Number(quota.monthlyLimit),
          warnAtPercent: Number(quota.warnAtPercent),
        },
      },
      t('admin.mail.sender.saved', '발신 정보를 저장했습니다.')
    );

  return (
    <div className="mail-tab">
      <section className="admin-form-section mail-section">
        <h3 className="admin-form-section-title">
          {t('admin.mail.sender.title', '누구 이름으로 나가나요')}
        </h3>

        <div className="mail-field">
          <label htmlFor="mail-from">
            {t('admin.mail.sender.from', '보내는 주소')}
          </label>
          <input
            id="mail-from"
            type="email"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="alert@mail.example.org"
          />
          <p className="admin-form-help">
            {t(
              'admin.mail.sender.fromHelp',
              '홈페이지와 같은 도메인이어야 하고, 도메인 인증(SPF·DKIM)이 되어 있어야 합니다. mail.도메인 형태의 하위 주소를 권합니다 — 기존 업무 메일과 분리되어 서로 영향을 주지 않습니다.'
            )}
          </p>
        </div>

        <div className="mail-field">
          <label htmlFor="mail-from-name">
            {t('admin.mail.sender.fromName', '표시 이름')}
          </label>
          <input
            id="mail-from-name"
            type="text"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="KTDOC 춤누리"
          />
          <p className="admin-form-help">
            {t(
              'admin.mail.sender.fromNameHelp',
              '받는 사람의 편지함에 보낸 사람으로 표시되는 이름입니다.'
            )}
          </p>
        </div>

        <div className="mail-field">
          <label htmlFor="mail-reply-to">
            {t('admin.mail.sender.replyTo', '답장 받을 주소')}
          </label>
          <input
            id="mail-reply-to"
            type="email"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            placeholder="example@gmail.com"
          />
          <p className="admin-form-help">
            {t(
              'admin.mail.sender.replyToHelp',
              '받은 분이 답장 버튼을 누르면 이 주소로 옵니다. 인증이 필요 없으니 평소 쓰시는 지메일 주소를 그대로 넣으셔도 됩니다.'
            )}
          </p>
        </div>

        <div className="mail-field">
          <label htmlFor="mail-staff-to">
            {t('admin.mail.sender.staffTo', '운영진 알림 받을 주소')}
          </label>
          <textarea
            id="mail-staff-to"
            rows={3}
            value={staffTo}
            onChange={(e) => setStaffTo(e.target.value)}
            placeholder={'director@example.com\nstaff@example.com'}
          />
          <p className="admin-form-help">
            {t(
              'admin.mail.sender.staffToHelp',
              '새 가입·신청이 있을 때 알림을 받을 주소입니다. 한 줄에 하나씩 여러 개를 넣을 수 있습니다.'
            )}
          </p>
        </div>
      </section>

      <section className="admin-form-section mail-section">
        <h3 className="admin-form-section-title">
          {t('admin.mail.quota.title', '보낼 수 있는 양')}
        </h3>
        <p className="admin-form-help">
          {t(
            'admin.mail.quota.help',
            '쓰고 계신 요금제의 한도를 적어두면, 한도에 닿기 전에 알려드리고 넘는 발송은 보류합니다. Resend 무료 요금제는 하루 100통, 한 달 3,000통입니다. 받는 사람이 여러 명이면 사람 수만큼 세어집니다.'
          )}
        </p>
        <div className="mail-quota-grid">
          <div className="mail-field mail-field-narrow">
            <label htmlFor="mail-quota-daily">
              {t('admin.mail.quota.daily', '하루 한도')}
            </label>
            <input
              id="mail-quota-daily"
              type="number"
              min={1}
              value={quota.dailyLimit}
              onChange={(e) =>
                setQuota((p) => ({ ...p, dailyLimit: Number(e.target.value) }))
              }
            />
          </div>
          <div className="mail-field mail-field-narrow">
            <label htmlFor="mail-quota-monthly">
              {t('admin.mail.quota.monthly', '한 달 한도')}
            </label>
            <input
              id="mail-quota-monthly"
              type="number"
              min={1}
              value={quota.monthlyLimit}
              onChange={(e) =>
                setQuota((p) => ({ ...p, monthlyLimit: Number(e.target.value) }))
              }
            />
          </div>
          <div className="mail-field mail-field-narrow">
            <label htmlFor="mail-quota-warn">
              {t('admin.mail.quota.warnAt', '경고 시점 (%)')}
            </label>
            <input
              id="mail-quota-warn"
              type="number"
              min={1}
              max={100}
              value={quota.warnAtPercent}
              onChange={(e) =>
                setQuota((p) => ({
                  ...p,
                  warnAtPercent: Number(e.target.value),
                }))
              }
            />
          </div>
        </div>
      </section>

      <section className="admin-form-section mail-section">
        <h3 className="admin-form-section-title">
          {t('admin.mail.effective.title', '지금 실제로 나가는 설정')}
        </h3>
        {effective.ready ? (
          <dl className="mail-effective">
            <dt>{t('admin.mail.effective.provider', '발송 방법')}</dt>
            <dd>{effective.provider}</dd>
            <dt>{t('admin.mail.effective.from', '보내는 사람')}</dt>
            <dd>
              {effective.fromName} &lt;{effective.from}&gt;
            </dd>
            <dt>{t('admin.mail.effective.replyTo', '답장 주소')}</dt>
            <dd>
              {effective.replyTo || t('admin.mail.effective.none', '(미설정)')}
            </dd>
          </dl>
        ) : (
          <p className="mail-not-ready">
            {t(
              'admin.mail.effective.notReady',
              '아직 메일을 보낼 수 없는 상태입니다. 발송 방법 탭에서 설정을 마쳐 주세요.'
            )}
            {effective.reason ? ` (${effective.reason})` : ''}
          </p>
        )}
      </section>

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
    </div>
  );
}
