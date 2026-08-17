'use client';

/**
 * 이메일 설정 매니저 — 탭 넷을 조립만 한다.
 *
 * 상태는 useMailSettings, 화면은 각 탭 컴포넌트가 갖는다.
 * 저장은 탭마다 "그 탭이 건드린 키만" 보낸다(부분 업데이트) — 전체를 보내면
 * 다른 탭에서 방금 바꾼 값이 화면의 낡은 사본으로 되돌아간다.
 */

import { useState } from 'react';
import { useT } from '@/lib/i18n/useT';
import { useMailSettings } from './parts/useMailSettings';
import DeliveryTab from './parts/DeliveryTab';
import SenderTab from './parts/SenderTab';
import EventsTab from './parts/EventsTab';
import LogTab from './parts/LogTab';

type TabKey = 'delivery' | 'sender' | 'events' | 'log';

export default function MailSettingsManager() {
  const t = useT();
  const mail = useMailSettings();
  const [tab, setTab] = useState<TabKey>('delivery');

  if (mail.loading) {
    return (
      <div className="admin-empty-state">
        <p>{t('admin.mail.loading', '설정을 불러오는 중…')}</p>
      </div>
    );
  }

  if (!mail.config) {
    return (
      <div className="admin-inline-error">
        {mail.error || t('admin.mail.loadFailed', '설정을 불러오지 못했습니다.')}
      </div>
    );
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'delivery', label: t('admin.mail.tab.delivery', '발송 방법') },
    { key: 'sender', label: t('admin.mail.tab.sender', '발신 정보') },
    { key: 'events', label: t('admin.mail.tab.events', '무엇을 보낼지') },
    { key: 'log', label: t('admin.mail.tab.log', '보낸 내역') },
  ];

  return (
    <div className="mail-settings">
      {!mail.effective.ready && (
        <div className="mail-banner" role="status">
          {t(
            'admin.mail.banner.notReady',
            '아직 메일이 나가지 않는 상태입니다. 발송 방법과 보내는 주소를 설정해 주세요.'
          )}
        </div>
      )}

      {mail.error && <div className="admin-inline-error">{mail.error}</div>}
      {mail.notice && (
        <div className="mail-notice" role="status">
          {mail.notice}
        </div>
      )}

      <div className="mail-tabs" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            className={`mail-tab-btn${tab === item.key ? ' is-active' : ''}`}
            onClick={() => {
              setTab(item.key);
              mail.setError('');
              mail.setNotice('');
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'delivery' && (
        <DeliveryTab
          config={mail.config}
          saving={mail.saving}
          onSave={mail.save}
        />
      )}
      {tab === 'sender' && (
        <SenderTab
          config={mail.config}
          effective={mail.effective}
          saving={mail.saving}
          onSave={mail.save}
        />
      )}
      {tab === 'events' && (
        <EventsTab config={mail.config} saving={mail.saving} onSave={mail.save} />
      )}
      {tab === 'log' && (
        <LogTab
          usage={mail.usage}
          dailyLimit={mail.config.quota.dailyLimit}
          monthlyLimit={mail.config.quota.monthlyLimit}
          warnAtPercent={mail.config.quota.warnAtPercent}
          onReload={mail.reload}
        />
      )}
    </div>
  );
}
