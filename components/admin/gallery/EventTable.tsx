'use client';

/**
 * EventTable Component
 * 관리자용 이벤트 목록 테이블
 */

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { EventWithCategory } from '@/types/gallery';
import { formatEventDate } from '@/types/gallery';

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
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (event: EventWithCategory) => {
    if (!confirm(`"${event.title_ko}" 이벤트를 삭제하시겠습니까?`)) return;

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
          throw new Error(data.error || '삭제에 실패했습니다.');
        }
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.');
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
          throw new Error(data.error || '상태 변경에 실패했습니다.');
        }
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 변경에 실패했습니다.');
    } finally {
      setTogglingId(null);
    }
  };

  if (events.length === 0) {
    return (
      <div className="admin-empty-state">
        <p>아직 등록된 아카이브 이벤트가 없습니다.</p>
        <Link href="/admin/gallery/new" className="admin-btn admin-btn-primary">
          첫 이벤트 만들기
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
            <th style={{ width: '80px' }}>썸네일</th>
            <th>이벤트 제목</th>
            <th style={{ width: '80px' }}>연도</th>
            <th style={{ width: '120px' }}>날짜</th>
            <th style={{ width: '100px' }}>카테고리</th>
            <th style={{ width: '92px' }}>공개 상태</th>
            <th style={{ width: '60px' }}>조회</th>
            <th style={{ width: '280px' }}>작업</th>
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
              <td>{formatEventDate(event.event_date, 'ko')}</td>
              <td>
                {event.category_name_ko || (
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
                    ? '공개'
                    : '비공개'}
                </button>
              </td>
              <td>{event.view_count}</td>
              <td>
                <div className="admin-table-actions">
                  <Link
                    href={`/admin/gallery/${event.id}`}
                    className="admin-btn admin-btn-sm"
                  >
                    편집
                  </Link>
                  {event.is_published ? (
                    <Link
                      href={`/gallery/${event.year}/${event.slug}`}
                      target="_blank"
                      className="admin-btn admin-btn-sm admin-btn-outline"
                    >
                      공개 페이지
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className="admin-btn admin-btn-sm admin-btn-danger"
                    onClick={() => handleDelete(event)}
                    disabled={deletingId === event.id}
                  >
                    {deletingId === event.id ? '...' : '삭제'}
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
