'use client';

/**
 * 알림 현황 요약 4칸 — 켠 회원 / 켜진 기기 / 안 켠 회원 / 최근 30일 변화
 *
 * 회원 수와 기기 수가 다른 게 정상이다(한 사람이 휴대폰·PC에 각각 켠다).
 * 그 사실을 부제목으로 함께 보여 준다.
 */

import { useMemo } from 'react';
import type { PushMemberStatus, PushSummary } from '@/types/push';
import { deviceKind } from '@/lib/push/deviceLabel';
import { useT } from '@/lib/i18n/useT';
import { deviceKindLabel } from '@/lib/i18n/pushLabels';

interface StatusSummaryProps {
  summary: PushSummary;
  members: PushMemberStatus[];
}

export default function StatusSummary({ summary, members }: StatusSummaryProps) {
  const t = useT();

  // 기기 종류 분포(iPhone 3 · 안드로이드 1 …) — 어떤 기기를 챙겨야 하는지 알려준다.
  const kindCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of members) {
      for (const d of m.devices) {
        const kind = deviceKind(d.userAgent);
        counts.set(kind, (counts.get(kind) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [members]);

  return (
    <div className="notify-stat-grid">
      <div className="notify-stat">
        <span className="notify-stat-value">
          {t('admin.notify.peopleCount', '{n}명', { n: summary.memberCount })}
        </span>
        <span className="notify-stat-label">{t('admin.notify.statOn', '알림 켠 회원')}</span>
        <span className="notify-stat-sub">
          {t('admin.notify.ofActive', '정회원 {n}명 중', { n: summary.activeMemberCount })}
        </span>
      </div>

      <div className="notify-stat">
        <span className="notify-stat-value">
          {t('admin.notify.deviceCount', '{n}대', { n: summary.deviceCount })}
        </span>
        <span className="notify-stat-label">{t('admin.notify.statDevices', '켜진 기기')}</span>
        <span className="notify-stat-sub">
          {kindCounts.length
            ? kindCounts
                .map(([kind, n]) => `${deviceKindLabel(t, kind as never)} ${n}`)
                .join(' · ')
            : t('admin.notify.noneYet', '아직 없습니다')}
        </span>
      </div>

      <div className="notify-stat">
        <span className="notify-stat-value">
          {t('admin.notify.peopleCount', '{n}명', { n: summary.offCount })}
        </span>
        <span className="notify-stat-label">{t('admin.notify.statOff', '안 켠 정회원')}</span>
        <span className="notify-stat-sub">
          {t('admin.notify.notReached', '알림이 가지 않습니다')}
        </span>
      </div>

      <div className="notify-stat">
        <span className="notify-stat-value">
          +{summary.subscribed30d} / −{summary.unsubscribed30d + summary.expired30d}
        </span>
        <span className="notify-stat-label">{t('admin.notify.stat30d', '최근 30일 변화')}</span>
        <span className="notify-stat-sub">
          {t('admin.notify.stat30dDetail', '켬 {on} · 끔 {off} · 만료 {expired}', {
            on: summary.subscribed30d,
            off: summary.unsubscribed30d,
            expired: summary.expired30d,
          })}
        </span>
      </div>
    </div>
  );
}
