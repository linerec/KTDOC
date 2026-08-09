'use client';

/**
 * NotifyStatus — 알림 현황(누가 어느 기기에 켜 뒀는지, 누가 안 켰는지, 무엇이 바뀌었는지).
 *
 * 발송 화면의 "기기 N대"는 합계일 뿐이라 운영진이 "○○ 어머님께 알림이 가고 있나"를
 * 확인할 수 없었다. 여기서 세 가지를 본다:
 *   켠 회원 — 기기별 도달 성적까지(StatusOnTable)
 *   안 켠 회원 — 안내가 필요한 사람 명단
 *   변경 이력 — 언제 누가 켜고 껐는지(행이 지워져도 남는 기록)
 */

import { useState } from 'react';
import type { MemberRole } from '@/types/members';
import type { PushEventEntry, PushMemberOff, PushMemberStatus, PushSummary } from '@/types/push';
import { useT } from '@/lib/i18n/useT';
import { useLanguage } from '@/contexts/LanguageContext';
import { roleLabel } from '@/lib/i18n/memberLabels';
import { deviceLabel, pushEventLabel } from '@/lib/i18n/pushLabels';
import StatusSummary from './notify/StatusSummary';
import StatusOnTable from './notify/StatusOnTable';
import { formatDay, formatWhen } from './notify/timeFormat';

type StatusTab = 'on' | 'off' | 'events';

export default function NotifyStatus({
  summary,
  members,
  off,
  events,
}: {
  summary: PushSummary;
  members: PushMemberStatus[];
  off: PushMemberOff[];
  events: PushEventEntry[];
}) {
  const t = useT();
  const { locale } = useLanguage();
  const [tab, setTab] = useState<StatusTab>('on');

  const memberLabel = (name: string | null, email: string | null) =>
    name || email || t('admin.notify.noName', '(이름 없음)');

  const tabs: [StatusTab, string, number][] = [
    ['on', t('admin.notify.statOn', '알림 켠 회원'), members.length],
    ['off', t('admin.notify.statOff', '안 켠 정회원'), off.length],
    ['events', t('admin.notify.tabEvents', '변경 이력'), events.length],
  ];

  return (
    <section className="admin-form-section admin-account-card notify-status">
      <h2 className="admin-form-section-title">{t('admin.notify.statusTitle', '알림 현황')}</h2>
      <p className="admin-form-help">
        {t(
          'admin.notify.statusHelp',
          '회원이 휴대폰·PC에서 각각 알림을 켤 수 있어, 한 사람이 여러 기기에 켜 두기도 합니다. 아래는 지금 켜져 있는 기기와 그동안의 변화입니다.'
        )}
      </p>

      <StatusSummary summary={summary} members={members} />

      <div className="notify-target-tabs notify-status-tabs">
        {tabs.map(([val, label, count]) => (
          <button
            key={val}
            type="button"
            className={`notify-tab${tab === val ? ' is-active' : ''}`}
            onClick={() => setTab(val)}
          >
            {label} <span className="notify-tab-count">{count}</span>
          </button>
        ))}
      </div>

      {tab === 'on' && <StatusOnTable members={members} />}

      {tab === 'off' &&
        (off.length === 0 ? (
          <p className="admin-form-help">
            {t('admin.notify.offEmpty', '정회원 모두가 알림을 켜 두었습니다.')}
          </p>
        ) : (
          <>
            <p className="admin-form-help">
              {t(
                'admin.notify.offHelp',
                '이 회원들에게는 푸시 알림이 가지 않습니다(‘내 알림’함에는 남습니다). 휴대폰으로 로그인 → 홈 화면에 추가 → 대시보드의 ‘알림 켜기’ 순서로 안내하세요.'
              )}
            </p>
            <ul className="notify-off-list">
              {off.map((m) => (
                <li key={m.userId} className="notify-off-item">
                  <span className="notify-off-name">{memberLabel(m.name, m.email)}</span>
                  <span className="notify-chip">{roleLabel(t, m.role as MemberRole)}</span>
                  <span className="notify-off-note">
                    {m.lastOffAt
                      ? t('admin.notify.turnedOffOn', '{day}에 꺼짐', {
                          day: formatDay(m.lastOffAt, locale),
                        })
                      : t('admin.notify.neverOn', '한 번도 켠 적 없음')}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ))}

      {tab === 'events' &&
        (events.length === 0 ? (
          <p className="admin-form-help">
            {t(
              'admin.notify.eventsEmpty',
              '아직 기록된 변화가 없습니다. 이제부터 회원이 알림을 켜거나 끄면 여기에 쌓입니다.'
            )}
          </p>
        ) : (
          <ul className="notify-event-list">
            {events.map((e) => (
              <li key={e.id} className="notify-event-item">
                <span className={`notify-event-chip notify-event-${e.event}`}>
                  {pushEventLabel(t, e.event)}
                </span>
                <span className="notify-event-who">{memberLabel(e.name, e.email)}</span>
                <span className="notify-event-device">{deviceLabel(t, e.userAgent)}</span>
                <span className="notify-event-when">{formatWhen(e.createdAt, locale)}</span>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
