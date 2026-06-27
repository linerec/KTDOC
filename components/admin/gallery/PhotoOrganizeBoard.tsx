'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { GalleryPhoto } from '@/types/gallery';
import Pagination from '@/components/common/Pagination';
import PhotoDetailDrawer, { type PhotoDraftInput } from './PhotoDetailDrawer';
import PhotoLightbox from './PhotoLightbox';
import EventPicker from './EventPicker';

type OrganizedFilter = 'all' | 'assigned' | 'unassigned';
type PublishedFilter = 'all' | 'public' | 'private';
type SortOrder = 'recent' | 'oldest' | 'taken';
type ViewDensity = 'compact' | 'comfortable';
type BulkAction =
  | 'publish' | 'unpublish' | 'feature' | 'unfeature'
  | 'assignEvent' | 'unassignEvent' | 'delete';

type SubmittedFilter = 'all' | 'student' | 'staff';

interface FilterState {
  search: string;
  organized: OrganizedFilter;
  published: PublishedFilter;
  submitted: SubmittedFilter;
  eventId: number | '';
  sort: SortOrder;
}

const DEFAULT_FILTERS: FilterState = {
  search: '',
  organized: 'all',
  published: 'all',
  submitted: 'all',
  eventId: '',
  sort: 'recent',
};

interface PhotoOrganizeBoardProps {
  initialPhotos: GalleryPhoto[];
  initialTotal: number;
  pageSize: number;
  /** 업로드 탭에서 새 사진을 올리면 증가 — 보드를 1페이지부터 새로고침 */
  reloadSignal: number;
}

export default function PhotoOrganizeBoard({
  initialPhotos,
  initialTotal,
  pageSize,
  reloadSignal,
}: PhotoOrganizeBoardProps) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [loadingPage, setLoadingPage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [viewDensity, setViewDensity] = useState<ViewDensity>('compact');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkEventId, setBulkEventId] = useState<number | ''>('');
  const [bulkEventLabel, setBulkEventLabel] = useState<string | null>(null);
  const [filterEventLabel, setFilterEventLabel] = useState<string | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);

  const [drawerId, setDrawerId] = useState<number | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  const hasActiveFilters =
    filters.search.trim() !== '' ||
    filters.organized !== 'all' ||
    filters.published !== 'all' ||
    filters.submitted !== 'all' ||
    filters.eventId !== '' ||
    filters.sort !== 'recent';

  const loadPage = useCallback(
    async (targetPage: number, overrideFilters?: FilterState) => {
      const active = overrideFilters ?? filters;
      setLoadingPage(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('page', String(targetPage));
        params.set('limit', String(pageSize));
        if (active.organized !== 'all') params.set('organized', active.organized);
        if (active.published !== 'all') {
          params.set('published', active.published === 'public' ? 'true' : 'false');
        }
        if (active.submitted !== 'all') params.set('submitted', active.submitted);
        if (active.eventId !== '') params.set('eventId', String(active.eventId));
        if (active.sort !== 'recent') params.set('sort', active.sort);
        if (active.search.trim()) params.set('search', active.search.trim());

        const res = await fetch(`/api/admin/gallery/photos?${params.toString()}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error || '사진을 불러오지 못했습니다.');

        setPhotos(data.data.photos);
        setTotal(data.data.total);
        setPage(targetPage);
        setSelected(new Set());
        if (overrideFilters) setFilters(overrideFilters);
        document.getElementById('photo-organize-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) {
        setError(err instanceof Error ? err.message : '사진을 불러오지 못했습니다.');
      } finally {
        setLoadingPage(false);
      }
    },
    [filters, pageSize]
  );

  // 업로드 후 새로고침 (초기 마운트는 건너뜀)
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setSearchInput('');
    loadPage(1, DEFAULT_FILTERS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadSignal]);

  const applyFilters = useCallback(
    (next: Partial<FilterState>) => loadPage(1, { ...filters, ...next }),
    [filters, loadPage]
  );

  const resetFilters = () => {
    setSearchInput('');
    loadPage(1, DEFAULT_FILTERS);
  };

  // ── 선택 ──────────────────────────────
  const toggleSelect = (id: number) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = photos.length > 0 && photos.every((p) => selected.has(p.id));
  const toggleSelectAll = () =>
    setSelected(allSelected ? new Set() : new Set(photos.map((p) => p.id)));

  // ── 일괄 작업 ─────────────────────────
  const runBulk = async (action: BulkAction) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (action === 'assignEvent' && bulkEventId === '') {
      setError('넣을 이벤트를 선택하세요.');
      return;
    }
    if (action === 'delete' && !confirm(`선택한 ${ids.length}장을 보관함과 R2에서 삭제하시겠습니까?`)) {
      return;
    }

    setBulkRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/gallery/photos/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids,
          action,
          eventId: action === 'assignEvent' ? Number(bulkEventId) : undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '일괄 작업에 실패했습니다.');

      // 삭제로 현재 페이지가 비고 이전 페이지가 있으면 한 칸 앞으로
      const willEmpty = action === 'delete' && selected.size >= photos.length && page > 1;
      await loadPage(willEmpty ? page - 1 : page);
    } catch (err) {
      setError(err instanceof Error ? err.message : '일괄 작업에 실패했습니다.');
    } finally {
      setBulkRunning(false);
    }
  };

  // ── 단건 저장 / 삭제 (드로어) ──────────
  const savePhoto = async (photoId: number, input: PhotoDraftInput) => {
    setSavingId(photoId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/gallery/photos/${photoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption_ko: input.caption_ko,
          caption_en: input.caption_en,
          taken_date: input.taken_date,
          event_id: input.event_id,
          is_published: input.is_published,
          is_featured: input.is_featured,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '사진 정리에 실패했습니다.');
      setPhotos((cur) => cur.map((p) => (p.id === photoId ? data.data : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : '사진 정리에 실패했습니다.');
    } finally {
      setSavingId(null);
    }
  };

  const deletePhoto = async (photo: GalleryPhoto) => {
    if (!confirm('이 사진을 보관함과 R2에서 삭제하시겠습니까?')) return;
    setDeletingId(photo.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/gallery/photos/${photo.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '사진 삭제에 실패했습니다.');

      setDrawerId(null);
      const remaining = photos.filter((p) => p.id !== photo.id);
      setTotal((c) => Math.max(0, c - 1));
      if (remaining.length === 0 && page > 1) {
        await loadPage(page - 1);
      } else {
        setPhotos(remaining);
        setSelected((cur) => {
          const next = new Set(cur);
          next.delete(photo.id);
          return next;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '사진 삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  const drawerPhoto = drawerId !== null ? photos.find((p) => p.id === drawerId) ?? null : null;

  const openLightboxFor = (photoId: number) => {
    const idx = photos.findIndex((p) => p.id === photoId);
    if (idx >= 0) setLightboxIndex(idx);
  };

  return (
    <div className="photo-organize" id="photo-organize-top">
      {error && <div className="admin-alert admin-alert-error">{error}</div>}

      {/* 툴바 */}
      <div className="photo-organize-toolbar">
        <form
          className="photo-organize-search"
          onSubmit={(e) => {
            e.preventDefault();
            applyFilters({ search: searchInput });
          }}
        >
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="캡션·이벤트로 검색"
            className="admin-filter-input"
          />
          <button type="submit" className="admin-btn admin-btn-sm" disabled={loadingPage}>검색</button>
        </form>

        <div className="photo-organize-filters">
          <select
            className="admin-filter-select"
            value={filters.organized}
            onChange={(e) => applyFilters({ organized: e.target.value as OrganizedFilter })}
            disabled={loadingPage}
            aria-label="정리 상태"
          >
            <option value="all">전체 분류상태</option>
            <option value="assigned">이벤트에 들어있음</option>
            <option value="unassigned">미분류</option>
          </select>

          <select
            className="admin-filter-select"
            value={filters.published}
            onChange={(e) => applyFilters({ published: e.target.value as PublishedFilter })}
            disabled={loadingPage}
            aria-label="공개 상태"
          >
            <option value="all">전체 공개상태</option>
            <option value="public">공개</option>
            <option value="private">비공개</option>
          </select>

          <select
            className="admin-filter-select"
            value={filters.submitted}
            onChange={(e) => applyFilters({ submitted: e.target.value as SubmittedFilter })}
            disabled={loadingPage}
            aria-label="제출 출처"
          >
            <option value="all">전체 출처</option>
            <option value="student">학생 제출</option>
            <option value="staff">직접 업로드</option>
          </select>

          <EventPicker
            value={filters.eventId === '' ? null : filters.eventId}
            valueLabel={filterEventLabel}
            placeholder="전체 이벤트"
            allowClear
            clearLabel="전체 이벤트"
            disabled={loadingPage}
            buttonClassName="photo-organize-event-filter"
            onChange={(id, ev) => {
              setFilterEventLabel(ev ? `${ev.year} · ${ev.title_ko}` : null);
              applyFilters({ eventId: id ?? '' });
            }}
          />

          <select
            className="admin-filter-select"
            value={filters.sort}
            onChange={(e) => applyFilters({ sort: e.target.value as SortOrder })}
            disabled={loadingPage}
            aria-label="정렬"
          >
            <option value="recent">최신 업로드순</option>
            <option value="oldest">오래된 업로드순</option>
            <option value="taken">촬영일순</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              className="admin-btn admin-btn-sm admin-btn-outline"
              onClick={resetFilters}
              disabled={loadingPage}
            >
              초기화
            </button>
          )}
        </div>

        <div className="photo-organize-toolbar-right">
          <div className="photo-organize-density" role="group" aria-label="보기 밀도">
            <button
              type="button"
              className={`admin-btn admin-btn-sm ${viewDensity === 'compact' ? 'admin-btn-primary' : 'admin-btn-outline'}`}
              onClick={() => setViewDensity('compact')}
            >
              조밀
            </button>
            <button
              type="button"
              className={`admin-btn admin-btn-sm ${viewDensity === 'comfortable' ? 'admin-btn-primary' : 'admin-btn-outline'}`}
              onClick={() => setViewDensity('comfortable')}
            >
              보통
            </button>
          </div>
          <span className="photo-organize-count">
            {total > 0 ? `${rangeStart}–${rangeEnd} / 총 ${total}장` : '0장'}
          </span>
        </div>
      </div>

      {/* 선택/일괄 바 */}
      <div className={`photo-bulk-bar ${selected.size > 0 ? 'is-active' : ''}`}>
        <label className="photo-bulk-selectall admin-form-checkbox">
          <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} disabled={photos.length === 0} />
          <span>{selected.size > 0 ? `${selected.size}장 선택됨` : '전체 선택'}</span>
        </label>

        {selected.size > 0 && (
          <div className="photo-bulk-actions">
            <button type="button" className="admin-btn admin-btn-sm" disabled={bulkRunning} onClick={() => runBulk('publish')}>공개</button>
            <button type="button" className="admin-btn admin-btn-sm" disabled={bulkRunning} onClick={() => runBulk('unpublish')}>비공개</button>
            <button type="button" className="admin-btn admin-btn-sm" disabled={bulkRunning} onClick={() => runBulk('feature')}>강조</button>
            <button type="button" className="admin-btn admin-btn-sm" disabled={bulkRunning} onClick={() => runBulk('unfeature')}>강조 해제</button>

            <span className="photo-bulk-event">
              <EventPicker
                value={bulkEventId === '' ? null : bulkEventId}
                valueLabel={bulkEventLabel}
                placeholder="이벤트 선택…"
                disabled={bulkRunning}
                buttonClassName="photo-bulk-event-picker"
                onChange={(id, ev) => {
                  setBulkEventId(id ?? '');
                  setBulkEventLabel(ev ? `${ev.year} · ${ev.title_ko}` : null);
                }}
              />
              <button type="button" className="admin-btn admin-btn-sm" disabled={bulkRunning || bulkEventId === ''} onClick={() => runBulk('assignEvent')}>이벤트에 넣기</button>
              <button type="button" className="admin-btn admin-btn-sm admin-btn-outline" disabled={bulkRunning} onClick={() => runBulk('unassignEvent')}>빼기</button>
            </span>

            <button type="button" className="admin-btn admin-btn-sm admin-btn-danger" disabled={bulkRunning} onClick={() => runBulk('delete')}>삭제</button>
            <button type="button" className="admin-btn admin-btn-sm admin-btn-outline" disabled={bulkRunning} onClick={() => setSelected(new Set())}>선택 해제</button>
          </div>
        )}
      </div>

      {/* 그리드 */}
      <section className={`photo-organize-grid density-${viewDensity} ${loadingPage ? 'is-loading' : ''}`}>
        {photos.length === 0 ? (
          <div className="admin-empty-state photo-organize-empty">
            <p>{hasActiveFilters ? '조건에 맞는 사진이 없습니다.' : '아직 보관함에 올라온 사진이 없습니다.'}</p>
          </div>
        ) : (
          photos.map((photo) => {
            const isSelected = selected.has(photo.id);
            return (
              <article
                key={photo.id}
                className={`photo-tile ${isSelected ? 'is-selected' : ''}`}
              >
                <button
                  type="button"
                  className="photo-tile-img-btn"
                  onClick={() => setDrawerId(photo.id)}
                  title="상세 편집"
                >
                  <Image
                    src={photo.image_url}
                    alt={photo.caption_ko || 'Gallery photo'}
                    fill
                    sizes="(max-width: 768px) 33vw, 180px"
                    className="photo-tile-img"
                    loading="lazy"
                  />
                </button>

                <label className="photo-tile-check admin-form-checkbox" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(photo.id)} aria-label="선택" />
                </label>

                <div className="photo-tile-badges">
                  {photo.is_published === 1 && <span className="photo-tile-badge is-public">공개</span>}
                  {photo.uploaded_by && (
                    <span className="photo-tile-badge is-submitted" title={photo.uploader_name ? `학생 제출 · ${photo.uploader_name}` : '학생 제출'}>
                      학생 제출
                    </span>
                  )}
                  {photo.event_image_id ? (
                    <span className="photo-tile-badge is-linked">이벤트</span>
                  ) : (
                    <span className="photo-tile-badge is-loose">미분류</span>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>

      <Pagination page={page} totalPages={totalPages} onPageChange={(n) => loadPage(n)} disabled={loadingPage} />

      {drawerPhoto && (
        <PhotoDetailDrawer
          photo={drawerPhoto}
          saving={savingId === drawerPhoto.id}
          deleting={deletingId === drawerPhoto.id}
          onSave={savePhoto}
          onDelete={deletePhoto}
          onClose={() => setDrawerId(null)}
          onOpenLightbox={() => openLightboxFor(drawerPhoto.id)}
        />
      )}

      {lightboxIndex !== null && photos[lightboxIndex] && (
        <PhotoLightbox
          photos={photos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}
    </div>
  );
}
