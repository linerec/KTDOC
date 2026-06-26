'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import type { EventWithCategory } from '@/types/gallery';
import Pagination from '@/components/common/Pagination';

const LIMIT = 40;

interface EventPickerProps {
  value: number | null;
  /** 트리거에 표시할 현재 선택 라벨(부모가 보유). 없으면 #id로 대체 */
  valueLabel?: string | null;
  onChange: (eventId: number | null, event?: EventWithCategory) => void;
  placeholder?: string;
  /** "전체/선택 안 함" 항목 노출 (필터·빼기용) */
  allowClear?: boolean;
  clearLabel?: string;
  disabled?: boolean;
  buttonClassName?: string;
}

/**
 * 공용 이벤트 선택기.
 * 네이티브 select 대신 검색형 풀 모달(썸네일 카드)을 띄워, 이벤트가 수천 개여도
 * 서버 검색/연도 필터/페이지네이션으로 빠르게 고를 수 있다. 미리 전체를 로드하지 않는다.
 */
export default function EventPicker({
  value,
  valueLabel,
  onChange,
  placeholder = '이벤트 선택',
  allowClear = false,
  clearLabel = '선택 안 함',
  disabled = false,
  buttonClassName = '',
}: EventPickerProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [year, setYear] = useState<number | ''>('');
  const [page, setPage] = useState(1);
  const [events, setEvents] = useState<EventWithCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  // 검색 입력 디바운스
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput, open]);

  const load = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('page', String(targetPage));
        params.set('limit', String(LIMIT));
        if (search) params.set('search', search);
        if (year !== '') params.set('year', String(year));

        const res = await fetch(`/api/admin/gallery/events?${params.toString()}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error || '이벤트를 불러오지 못했습니다.');

        setEvents(data.data.events);
        setTotal(data.data.total);
        if (Array.isArray(data.data.years)) setYears(data.data.years);
        setPage(targetPage);
      } catch (err) {
        setError(err instanceof Error ? err.message : '이벤트를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    },
    [search, year]
  );

  // 열림 + 검색/연도 변경 시 1페이지부터 재조회
  useEffect(() => {
    if (!open) return;
    load(1);
  }, [open, search, year, load]);

  // 열릴 때 검색 인풋 포커스
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const handleOpen = () => {
    if (disabled) return;
    setSearchInput('');
    setSearch('');
    setYear('');
    setPage(1);
    setOpen(true);
  };

  const choose = (eventId: number | null, event?: EventWithCategory) => {
    onChange(eventId, event);
    setOpen(false);
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const triggerText = value !== null ? valueLabel || `#${value}` : placeholder;

  return (
    <>
      <button
        type="button"
        className={`event-picker-trigger ${buttonClassName}`}
        onClick={handleOpen}
        disabled={disabled}
      >
        <span className={value !== null ? '' : 'is-placeholder'}>{triggerText}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && mounted && createPortal(
        <div className="event-picker-overlay" onClick={() => setOpen(false)}>
          <div className="event-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="event-picker-header">
              <h3>이벤트 선택</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="닫기">&times;</button>
            </div>

            <div className="event-picker-search">
              <input
                ref={inputRef}
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="제목·설명으로 검색"
                className="admin-filter-input"
              />
              <select
                className="admin-filter-select"
                value={year}
                onChange={(e) => setYear(e.target.value ? Number(e.target.value) : '')}
                aria-label="연도"
              >
                <option value="">전체 연도</option>
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {error && <div className="admin-alert admin-alert-error">{error}</div>}

            <div className={`event-picker-list ${loading ? 'is-loading' : ''}`}>
              {allowClear && (
                <button
                  type="button"
                  className={`event-picker-card event-picker-clear ${value === null ? 'is-current' : ''}`}
                  onClick={() => choose(null)}
                >
                  {clearLabel}
                </button>
              )}

              {events.length === 0 && !loading ? (
                <div className="admin-empty-state event-picker-empty">
                  <p>{search || year !== '' ? '조건에 맞는 이벤트가 없습니다.' : '이벤트가 없습니다.'}</p>
                </div>
              ) : (
                events.map((ev) => {
                  const thumb = ev.first_image_url || ev.thumbnail_url;
                  return (
                    <button
                      type="button"
                      key={ev.id}
                      className={`event-picker-card ${value === ev.id ? 'is-current' : ''}`}
                      onClick={() => choose(ev.id, ev)}
                    >
                      <span className="event-picker-thumb">
                        {thumb ? (
                          <Image src={thumb} alt="" fill sizes="64px" className="event-picker-thumb-img" />
                        ) : (
                          <span className="event-picker-thumb-empty" aria-hidden="true" />
                        )}
                      </span>
                      <span className="event-picker-info">
                        <span className="event-picker-title">
                          {ev.year} · {ev.title_ko}
                          {ev.is_published === 0 && <span className="event-picker-badge">비공개</span>}
                        </span>
                        <span className="event-picker-sub">
                          {ev.event_date}
                          {ev.category_name_ko ? ` · ${ev.category_name_ko}` : ''}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="event-picker-footer">
              <Pagination page={page} totalPages={totalPages} onPageChange={load} disabled={loading} />
              <span className="event-picker-count">{total > 0 ? `총 ${total}건` : ''}</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
