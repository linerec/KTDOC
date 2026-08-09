'use client';

/**
 * usePhotoBoard — 사진 보관함 정리판의 목록·선택·일괄 작업
 *
 * 목록은 서버 페이지네이션이다(필터가 바뀌면 항상 1페이지부터 다시 받는다).
 * 화면 조각들(툴바·일괄바·그리드)은 이 훅이 내주는 값만 그리므로, 어느 조각을 고쳐도
 * 조회 규칙은 여기 한곳에만 있다.
 *
 * 삭제 후 페이지 보정에 주의: 마지막 장을 지워 현재 페이지가 비면 한 칸 앞으로 간다.
 * 그러지 않으면 빈 페이지가 남아 "사진이 사라졌다"로 보인다.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GalleryPhoto } from '@/types/gallery';
import type { PhotoDraftInput } from '../PhotoDetailDrawer';
import { useT } from '@/lib/i18n/useT';
import { DEFAULT_FILTERS, type BulkAction, type FilterState } from './types';

interface UsePhotoBoardArgs {
  initialPhotos: GalleryPhoto[];
  initialTotal: number;
  pageSize: number;
  /** 업로드 탭에서 새 사진을 올리면 증가 — 보드를 1페이지부터 새로고침 */
  reloadSignal: number;
}

export function usePhotoBoard({
  initialPhotos,
  initialTotal,
  pageSize,
  reloadSignal,
}: UsePhotoBoardArgs) {
  const t = useT();

  const [photos, setPhotos] = useState(initialPhotos);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [loadingPage, setLoadingPage] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        if (!data.success) {
          throw new Error(data.error || t('admin.photos.loadFailed', '사진을 불러오지 못했습니다.'));
        }

        setPhotos(data.data.photos);
        setTotal(data.data.total);
        setPage(targetPage);
        setSelected(new Set());
        if (overrideFilters) setFilters(overrideFilters);
        document
          .getElementById('photo-organize-top')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t('admin.photos.loadFailed', '사진을 불러오지 못했습니다.')
        );
      } finally {
        setLoadingPage(false);
      }
    },
    [filters, pageSize, t]
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
  const clearSelection = () => setSelected(new Set());

  // ── 일괄 작업 ─────────────────────────
  const runBulk = async (action: BulkAction) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (action === 'assignEvent' && bulkEventId === '') {
      setError(t('admin.photos.pickEventFirst', '넣을 공연을 선택하세요.'));
      return;
    }
    if (
      action === 'delete' &&
      !confirm(
        t('admin.photos.bulkDeleteConfirm', '선택한 {n}장을 보관함과 R2에서 삭제하시겠습니까?', {
          n: ids.length,
        })
      )
    ) {
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
      if (!data.success) {
        throw new Error(data.error || t('admin.photos.bulkFailed', '일괄 작업에 실패했습니다.'));
      }

      // 삭제로 현재 페이지가 비고 이전 페이지가 있으면 한 칸 앞으로
      const willEmpty = action === 'delete' && selected.size >= photos.length && page > 1;
      await loadPage(willEmpty ? page - 1 : page);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('admin.photos.bulkFailed', '일괄 작업에 실패했습니다.')
      );
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
      if (!data.success) {
        throw new Error(data.error || t('admin.photos.saveFailed', '사진 정리에 실패했습니다.'));
      }
      setPhotos((cur) => cur.map((p) => (p.id === photoId ? data.data : p)));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('admin.photos.saveFailed', '사진 정리에 실패했습니다.')
      );
    } finally {
      setSavingId(null);
    }
  };

  const deletePhoto = async (photo: GalleryPhoto) => {
    if (!confirm(t('admin.photos.deleteConfirm', '이 사진을 보관함과 R2에서 삭제하시겠습니까?'))) {
      return;
    }
    setDeletingId(photo.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/gallery/photos/${photo.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || t('admin.photos.deleteFailed', '사진 삭제에 실패했습니다.'));
      }

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
      setError(
        err instanceof Error
          ? err.message
          : t('admin.photos.deleteFailed', '사진 삭제에 실패했습니다.')
      );
    } finally {
      setDeletingId(null);
    }
  };

  const drawerPhoto = drawerId !== null ? (photos.find((p) => p.id === drawerId) ?? null) : null;

  const openLightboxFor = (photoId: number) => {
    const idx = photos.findIndex((p) => p.id === photoId);
    if (idx >= 0) setLightboxIndex(idx);
  };

  return {
    photos,
    total,
    page,
    totalPages,
    rangeStart,
    rangeEnd,
    filters,
    searchInput,
    setSearchInput,
    loadingPage,
    error,
    hasActiveFilters,
    loadPage,
    applyFilters,
    resetFilters,
    selected,
    toggleSelect,
    allSelected,
    toggleSelectAll,
    clearSelection,
    bulkEventId,
    setBulkEventId,
    bulkEventLabel,
    setBulkEventLabel,
    filterEventLabel,
    setFilterEventLabel,
    bulkRunning,
    runBulk,
    drawerPhoto,
    openDrawer: setDrawerId,
    closeDrawer: () => setDrawerId(null),
    savingId,
    deletingId,
    savePhoto,
    deletePhoto,
    lightboxIndex,
    setLightboxIndex,
    openLightboxFor,
  };
}
