'use client';

/**
 * InboxList — 받은 알림함(회원 본인).
 * 클릭하면 읽음 처리, 삭제 버튼으로 본인 행 제거. 모두 읽음 지원.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n/useT';
import { useLanguage } from '@/contexts/LanguageContext';
// 시각 표기는 알림 화면과 같은 규칙(타임존 고정)을 쓴다 — 하이드레이션 불일치 방지.
import { formatInboxWhen } from './notify/timeFormat';

interface InboxItem {
  id: number;
  title: string;
  body: string;
  url: string | null;
  read: boolean;
  created_at: string;
  sender_name: string | null;
}

export default function InboxList({ initialItems }: { initialItems: InboxItem[] }) {
  const router = useRouter();
  const t = useT();
  const { locale } = useLanguage();
  const [items, setItems] = useState<InboxItem[]>(initialItems);
  const unreadCount = items.filter((i) => !i.read).length;

  const markRead = async (id: number) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)));
    await fetch('/api/push/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {});
    router.refresh();
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    await fetch('/api/push/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
    router.refresh();
  };

  const remove = async (id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch('/api/push/inbox', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {});
    router.refresh();
  };

  if (items.length === 0) {
    return (
      <div className="inbox-empty">
        <p>{t('admin.inbox.empty', '받은 알림이 없습니다.')}</p>
        <p className="inbox-empty-sub">
          {t('admin.inbox.emptySub', '운영진이 보낸 공지·일정 알림이 이곳에 모입니다.')}
        </p>
      </div>
    );
  }

  return (
    <div className="inbox-wrap">
      <div className="inbox-toolbar">
        <span className="inbox-count">
          {unreadCount > 0
            ? t('admin.inbox.unreadCount', '안 읽음 {n}개', { n: unreadCount })
            : t('admin.inbox.allRead', '모두 읽었습니다')}
        </span>
        {unreadCount > 0 && (
          <button type="button" className="admin-btn admin-btn-outline" onClick={markAllRead}>
            {t('admin.inbox.markAllRead', '모두 읽음')}
          </button>
        )}
      </div>

      <ul className="inbox-list">
        {items.map((item) => {
          const hasLink = !!item.url && item.url !== '/admin/inbox';
          return (
            <li
              key={item.id}
              className={`inbox-item${item.read ? '' : ' is-unread'}`}
            >
              <button
                type="button"
                className="inbox-item-main"
                onClick={() => !item.read && markRead(item.id)}
              >
                <span className="inbox-item-top">
                  {!item.read && <span className="inbox-dot" aria-label={t('admin.inbox.unread', '안 읽음')} />}
                  <span className="inbox-item-title">{item.title}</span>
                  <span className="inbox-item-when">
                    {formatInboxWhen(item.created_at, locale)}
                  </span>
                </span>
                <span className="inbox-item-body">{item.body}</span>
                <span className="inbox-item-meta">
                  {item.sender_name
                    ? t('admin.inbox.sender', '보낸 사람: {name}', { name: item.sender_name })
                    : 'KTDOC'}
                </span>
              </button>
              <div className="inbox-item-actions">
                {hasLink && (
                  <a href={item.url!} className="inbox-link" onClick={() => markRead(item.id)}>
                    {t('admin.inbox.goto', '바로가기')} →
                  </a>
                )}
                <button
                  type="button"
                  className="inbox-del"
                  onClick={() => remove(item.id)}
                  aria-label={t('admin.common.delete', '삭제')}
                >
                  {t('admin.common.delete', '삭제')}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
