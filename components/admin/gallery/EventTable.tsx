'use client';

/**
 * EventTable Component
 * 관리자용 공연 목록 테이블
 */

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { EventWithCategory } from '@/types/gallery';
import { formatEventDate } from '@/types/gallery';
import { useT } from '@/lib/i18n/useT';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocaleText } from '@/components/common/LocaleText';

interface EventTableProps {
  events: EventWithCategory[];
  onDelete?: (id: number) => Promise<void>;
  onTogglePublish?: (id: number, published: boolean) => Promise<void>;
}

export default function EventTable({
  events,
  onDelete,
  onTogglePublish,
}: EventTableProps) {
  const router = useRouter();
  const t = useT();
  const { locale } = useLanguage();
  const pick = useLocaleText();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (event: EventWithCategory) => {
    if (
      !confirm(
        t('admin.events.deleteConfirm', '"{title}" 공연을 삭제하시겠습니까?', {
          title: event.title_ko,
        })
      )
    )
      return;

    setDeletingId(event.id);
    setError(null);
    try {
      if (onDelete) {
        await onDelete(event.id);
      } else {
        const res = await fetch(`/api/admin/gallery/events/${event.id}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || t('admin.common.deleteFailed', '삭제에 실패했습니다.'));
        }
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('admin.common.deleteFailed', '삭제에 실패했습니다.')
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleTogglePublish = async (event: EventWithCategory) => {
    setTogglingId(event.id);
    setError(null);
    try {
      const nextPublished = !event.is_published;
      if (onTogglePublish) {
        await onTogglePublish(event.id, nextPublished);
      } else {
        const res = await fetch(`/api/admin/gallery/events/${event.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_published: nextPublished }),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(
            data.error || t('admin.common.toggleFailed', '상태 변경에 실패했습니다.')
          );
        }
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('admin.common.toggleFailed', '상태 변경에 실패했습니다.')
      );
    } finally {
      setTogglingId(null);
    }
  };

  if (events.length === 0) {
    return (
      <div className="admin-empty-state">
        <p>{t('admin.events.empty', '아직 등록된 공연이 없습니다.')}</p>
        <Link href="/admin/gallery/new" className="admin-btn admin-btn-primary">
          {t('admin.events.emptyCta', '첫 공연 만들기')}
        </Link>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="admin-alert admin-alert-error">
          {error}
        </div>
      )}
      <div className="admin-table-wrapper">
        <table className="admin-table">
        <thead>
          <tr>
            <th style={{ width: '80px' }}>{t('admin.events.colThumb', '썸네일')}</th>
            <th>{t('admin.events.colTitle', '공연 제목')}</th>
            <th style={{ width: '80px' }}>{t('admin.events.colYear', '연도')}</th>
            <th style={{ width: '120px' }}>{t('admin.events.colDate', '날짜')}</th>
            <th style={{ width: '100px' }}>{t('admin.events.fieldCategory', '카테고리')}</th>
            <th style={{ width: '92px' }}>{t('admin.common.colPublished', '공개 상태')}</th>
            <th style={{ width: '60px' }}>{t('admin.events.colViews', '조회')}</th>
            <th style={{ width: '280px' }}>{t('admin.common.colActions', '작업')}</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td>
                <div className="admin-table-thumbnail">
                  {event.thumbnail_url || event.poster_url ? (
                    <Image
                      src={event.thumbnail_url || event.poster_url || ''}
                      alt={event.title_ko}
                      width={60}
                      height={40}
                      className="admin-table-thumb-img"
                    />
                  ) : (
                    <div className="admin-table-thumb-placeholder">-</div>
                  )}
                </div>
              </td>
              <td>
                <Link
                  href={`/admin/gallery/${event.id}`}
                  className="admin-table-link"
                >
                  <span className="admin-table-title">{event.title_ko}</span>
                  {event.title_en && (
                    <span className="admin-table-subtitle">{event.title_en}</span>
                  )}
                </Link>
              </td>
              <td>{event.year}</td>
              <td>{formatEventDate(event.event_date, locale)}</td>
              <td>
                {event.category_name_ko ? (
                  pick(event.category_name_ko, event.category_name_en)
                ) : (
                  <span className="admin-table-muted">-</span>
                )}
              </td>
              <td>
                <button
                  type="button"
                  className={`admin-badge ${
                    event.is_published ? 'admin-badge-success' : 'admin-badge-muted'
                  }`}
                  onClick={() => handleTogglePublish(event)}
                  disabled={togglingId === event.id}
                >
                  {togglingId === event.id
                    ? '...'
                    : event.is_published
                      ? t('admin.common.published', '공개')
                      : t('admin.common.unpublished', '비공개')}
                </button>
              </td>
              <td>{event.view_count}</td>
              <td>
                <div className="admin-table-actions">
                  <Link
                    href={`/admin/gallery/${event.id}`}
                    className="admin-btn admin-btn-sm"
                  >
                    {t('admin.common.edit', '편집')}
                  </Link>
                  {event.is_published ? (
                    <Link
                      href={`/gallery/${event.year}/${event.slug}`}
                      target="_blank"
                      className="admin-btn admin-btn-sm admin-btn-outline"
                    >
                      {t('admin.common.publicPage', '공개 페이지')}
                    </Link>
                  ) : null}
                  {/* 모집(회람) 페이지 — 학부모·원생에게 링크를 공유해 참여 응답을 받는다 */}
                  <Link
                    href={`/rsvp/${event.id}`}
                    target="_blank"
                    className="admin-btn admin-btn-sm admin-btn-outline"
                    title={t(
                      'admin.events.rsvpTitle',
                      '참여 모집 페이지 열기 — 링크를 카톡 등으로 공유하세요'
                    )}
                  >
                    {t('admin.events.rsvp', '모집')}
                  </Link>
                  <button
                    type="button"
                    className="admin-btn admin-btn-sm admin-btn-danger"
                    onClick={() => handleDelete(event)}
                    disabled={deletingId === event.id}
                  >
                    {deletingId === event.id ? '...' : t('admin.common.delete', '삭제')}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </>
  );
}
