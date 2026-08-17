'use client';

/**
 * 탭 3 · 무엇을 보낼지 — 이벤트 × 대상 스위치
 *
 * 이 표는 레지스트리(lib/mail/events.ts)를 순회해 그린다. 새 알림이 늘어도
 * 이 파일을 고칠 일이 없다 — 레지스트리에 한 줄 추가하면 여기 저절로 나온다.
 *
 * 끌 수 없는 칸은 스위치를 만들지 않고 '필수' 배지를 둔다. 눌러도 안 되는
 * 스위치를 두면 고장으로 보인다.
 */

import { useState } from 'react';
import { useT } from '@/lib/i18n/useT';
import {
  MAIL_EVENTS,
  MAIL_EVENT_GROUPS,
  isEssential,
  type MailEventDef,
} from '@/lib/mail/events';
import type { MailAudience, MailEventSwitches, PublicMailConfig } from '@/types/mail';

interface Props {
  config: PublicMailConfig;
  saving: boolean;
  onSave: (patch: Record<string, unknown>, message: string) => Promise<boolean>;
}

/** 저장본에 값이 없으면 레지스트리 기본값 — 화면과 서버 판정이 같아야 한다. */
function isOn(
  def: MailEventDef,
  audience: MailAudience,
  switches: MailEventSwitches
): boolean {
  const saved = switches[def.key]?.[audience];
  if (saved && typeof saved.email === 'boolean') return saved.email;
  return def.defaultOn[audience] ?? false;
}

export default function EventsTab({ config, saving, onSave }: Props) {
  const t = useT();
  const [switches, setSwitches] = useState<MailEventSwitches>(config.events);

  const toggle = (def: MailEventDef, audience: MailAudience) => {
    setSwitches((prev) => {
      const next: MailEventSwitches = { ...prev };
      const bucket = { ...(next[def.key] ?? {}) };
      bucket[audience] = { email: !isOn(def, audience, prev) };
      next[def.key] = bucket;
      return next;
    });
  };

  /**
   * 저장할 때는 모든 이벤트의 현재 상태를 명시적으로 적어 보낸다.
   * 켠 것만 보내면 "기본값이 켜짐인데 방금 끈" 항목이 저장본에서 사라져
   * 다시 기본값(켜짐)으로 되살아난다.
   */
  const handleSave = () => {
    const full: MailEventSwitches = {};
    for (const def of MAIL_EVENTS) {
      const bucket: MailEventSwitches[string] = {};
      for (const audience of def.audiences) {
        bucket[audience] = { email: isOn(def, audience, switches) };
      }
      full[def.key] = bucket;
    }
    return onSave(
      { events: full },
      t('admin.mail.events.saved', '알림 설정을 저장했습니다.')
    );
  };

  return (
    <div className="mail-tab">
      <section className="admin-form-section mail-section">
        <h3 className="admin-form-section-title">
          {t('admin.mail.events.title', '어떤 일이 있을 때 메일을 보낼까요')}
        </h3>
        <p className="admin-form-help">
          {t(
            'admin.mail.events.help',
            '왼쪽은 그 일과 관련된 회원에게, 오른쪽은 운영진 주소로 가는 메일입니다. 원생에게 보내는 메일은 연결된 보호자에게도 함께 갑니다.'
          )}
        </p>

        {MAIL_EVENT_GROUPS.map((group) => {
          const events = MAIL_EVENTS.filter((e) => e.group === group.key);
          if (!events.length) return null;
          return (
            <div key={group.key} className="mail-event-group">
              <h4 className="mail-event-group-title">{group.label}</h4>
              <table className="mail-event-table">
                <thead>
                  <tr>
                    <th scope="col">{t('admin.mail.events.colEvent', '알림')}</th>
                    <th scope="col" className="mail-col-switch">
                      {t('admin.mail.events.colUser', '회원')}
                    </th>
                    <th scope="col" className="mail-col-switch">
                      {t('admin.mail.events.colStaff', '운영진')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((def) => (
                    <tr key={def.key}>
                      <td>
                        <div className="mail-event-label">{def.label}</div>
                        <div className="mail-event-desc">{def.description}</div>
                      </td>
                      {(['user', 'staff'] as const).map((audience) => (
                        <td key={audience} className="mail-col-switch">
                          {!def.audiences.includes(audience) ? (
                            <span
                              className="mail-na"
                              title={t(
                                'admin.mail.events.na',
                                '이 알림에는 해당하지 않습니다'
                              )}
                            >
                              —
                            </span>
                          ) : isEssential(def, audience) ? (
                            <span
                              className="mail-required"
                              title={t(
                                'admin.mail.events.essentialHelp',
                                '받지 못하면 계정을 사용할 수 없어 끌 수 없습니다'
                              )}
                            >
                              {t('admin.mail.events.essential', '필수')}
                            </span>
                          ) : (
                            <label className="mail-switch">
                              <input
                                type="checkbox"
                                checked={isOn(def, audience, switches)}
                                onChange={() => toggle(def, audience)}
                              />
                              <span className="mail-switch-track" aria-hidden="true">
                                <span className="mail-switch-thumb" />
                              </span>
                              <span className="mail-switch-text">
                                {isOn(def, audience, switches)
                                  ? t('admin.mail.events.on', '보냄')
                                  : t('admin.mail.events.off', '안 보냄')}
                              </span>
                            </label>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}

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
    </div>
  );
}
