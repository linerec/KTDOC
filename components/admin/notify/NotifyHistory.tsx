'use client';

/** 최근 발송 목록 — 무엇을, 누구에게, 몇 대에 보냈는지 */

import type { MemberRole } from '@/types/members';
import { useT } from '@/lib/i18n/useT';
import { useLanguage } from '@/contexts/LanguageContext';
import { roleLabel } from '@/lib/i18n/memberLabels';
import { formatWhen } from './timeFormat';
import type { MemberOption, ProgramOption } from './NotifyForm';

export interface NotificationLog {
  id: number;
  title: string;
  body: string;
  url: string | null;
  target_type: 'all' | 'role' | 'user' | 'class';
  target_value: string | null;
  sent_count: number;
  fail_count: number;
  created_at: string;
  sender_name: string | null;
}

interface NotifyHistoryProps {
  recent: NotificationLog[];
  /** 개인 발송의 대상 이름을 찾기 위한 명단 */
  members: MemberOption[];
  /** 수업 발송의 수업 이름을 찾기 위한 목록 */
  programs: ProgramOption[];
}

export default function NotifyHistory({ recent, members, programs }: NotifyHistoryProps) {
  const t = useT();
  const { locale } = useLanguage();

  /** '전체' / '원생·학부모' / '수업: 유년부 난타' / '개인: 홍길동' */
  const targetLabel = (n: NotificationLog): string => {
    if (n.target_type === 'all') return t('admin.events.targetAll', '전체');
    if (n.target_type === 'class') {
      const p = programs.find((x) => String(x.id) === n.target_value);
      return p
        ? t('admin.notify.targetClassNamed', '수업: {name}', { name: p.title })
        : t('admin.notify.targetClass', '수업');
    }
    if (n.target_type === 'role') {
      return (n.target_value || '')
        .split(',')
        .filter(Boolean)
        .map((r) => roleLabel(t, r as MemberRole))
        .join('·');
    }
    const m = members.find((x) => x.id === n.target_value);
    return m
      ? t('admin.notify.targetUserNamed', '개인: {name}', { name: m.name || m.email })
      : t('admin.notify.targetUser', '개인');
  };

  return (
    <section className="admin-form-section admin-account-card">
      <h2 className="admin-form-section-title">{t('admin.notify.recent', '최근 발송')}</h2>
      {recent.length === 0 ? (
        <p className="admin-form-help">{t('admin.notify.recentEmpty', '아직 보낸 알림이 없습니다.')}</p>
      ) : (
        <ul className="notify-history">
          {recent.map((n) => (
            <li key={n.id} className="notify-history-item">
              <div className="notify-history-top">
                <span className="notify-history-title">{n.title}</span>
                <span className="notify-history-when">{formatWhen(n.created_at, locale)}</span>
              </div>
              <p className="notify-history-body">{n.body}</p>
              <div className="notify-history-meta">
                <span className="notify-chip">{targetLabel(n)}</span>
                <span>
                  {t('admin.notify.reached', '도달 {n}', { n: n.sent_count })}
                  {n.fail_count
                    ? ` · ${t('admin.notify.failed', '실패 {n}', { n: n.fail_count })}`
                    : ''}
                </span>
                {n.sender_name && <span>· {n.sender_name}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
