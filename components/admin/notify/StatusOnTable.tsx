'use client';

/**
 * 알림을 켠 회원 표 — 기기별 도달 성적까지
 *
 * '최근 발송 실패' 칩이 이 표의 핵심이다. 켜 두었는데 계속 실패하는 기기는
 * 켠 것으로 집계되면서도 실제로는 알림이 가지 않는다 — 합계만 봐서는 안 보인다.
 */

import type { PushMemberStatus } from '@/types/push';
import { useT } from '@/lib/i18n/useT';
import { useLanguage } from '@/contexts/LanguageContext';
import { roleLabel } from '@/lib/i18n/memberLabels';
import { deviceLabel } from '@/lib/i18n/pushLabels';
import { formatDay, formatWhen } from './timeFormat';

export default function StatusOnTable({ members }: { members: PushMemberStatus[] }) {
  const t = useT();
  const { locale } = useLanguage();

  const memberLabel = (name: string | null, email: string | null) =>
    name || email || t('admin.notify.noName', '(이름 없음)');

  if (members.length === 0) {
    return (
      <p className="admin-form-help">
        {t(
          'admin.notify.onEmpty',
          '아직 알림을 켠 회원이 없습니다. 회원이 로그인한 뒤 대시보드에서 ‘알림 켜기’를 누르면 여기에 나타납니다.'
        )}
      </p>
    );
  }

  return (
    <div className="admin-table-wrapper">
      <table className="admin-table notify-status-table">
        <thead>
          <tr>
            <th>{t('admin.members.colMember', '회원')}</th>
            <th>{t('admin.members.colRole', '역할')}</th>
            <th>{t('admin.notify.colDevices', '켜 둔 기기')}</th>
            <th>{t('admin.notify.colLastReach', '마지막 도달')}</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const lastSuccess = m.devices
              .map((d) => d.lastSuccessAt)
              .filter((v): v is string => !!v)
              .sort()
              .pop();
            return (
              <tr key={m.userId}>
                <td>
                  <span className="admin-table-title">{memberLabel(m.name, m.email)}</span>
                  <span className="admin-table-subtitle">{m.email}</span>
                </td>
                <td>
                  <span className="notify-chip">{roleLabel(t, m.role)}</span>
                </td>
                <td>
                  <ul className="notify-device-list">
                    {m.devices.map((d) => {
                      // 마지막 시도가 실패였는지 — 도달 성적보다 이게 더 급한 신호다.
                      const failing =
                        d.failCount > 0 &&
                        (!d.lastSuccessAt || (d.lastFailureAt ?? '') > (d.lastSuccessAt ?? ''));
                      return (
                        <li key={d.id} className="notify-device">
                          <span className="notify-device-name">{deviceLabel(t, d.userAgent)}</span>
                          <span className="notify-device-meta">
                            {t('admin.notify.deviceSince', '{day}부터 · 도달 {n}', {
                              day: formatDay(d.createdAt, locale),
                              n: d.successCount,
                            })}
                            {d.failCount > 0 &&
                              ` · ${t('admin.notify.failed', '실패 {n}', { n: d.failCount })}`}
                          </span>
                          {failing && (
                            <span className="notify-warn-chip">
                              {t('admin.notify.recentFail', '최근 발송 실패')}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </td>
                <td className="notify-nowrap">{formatWhen(lastSuccess ?? null, locale)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
