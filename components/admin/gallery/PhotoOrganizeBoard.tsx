'use client';

/**
 * PhotoOrganizeBoard — 사진 보관함 정리판
 *
 * 이 파일은 조립만 한다. 내용은 photo-organize/ 아래로 갈라 두었다:
 *  - usePhotoBoard  : 목록 조회·필터·선택·일괄 작업·단건 저장/삭제
 *  - PhotoToolbar   : 검색·필터·보기 밀도
 *  - PhotoBulkBar   : 선택과 일괄 작업
 *  - PhotoGrid      : 타일 그리드
 * 상세 편집은 PhotoDetailDrawer, 크게 보기는 PhotoLightbox가 맡는다.
 */

import { useState } from 'react';
import type { GalleryPhoto } from '@/types/gallery';
import Pagination from '@/components/common/Pagination';
import PhotoDetailDrawer from './PhotoDetailDrawer';
import PhotoLightbox from './PhotoLightbox';
import PhotoToolbar from './photo-organize/PhotoToolbar';
import PhotoBulkBar from './photo-organize/PhotoBulkBar';
import PhotoGrid from './photo-organize/PhotoGrid';
import { usePhotoBoard } from './photo-organize/usePhotoBoard';
import type { ViewDensity } from './photo-organize/types';

interface PhotoOrganizeBoardProps {
  initialPhotos: GalleryPhoto[];
  initialTotal: number;
  pageSize: number;
  /** 업로드 탭에서 새 사진을 올리면 증가 — 보드를 1페이지부터 새로고침 */
  reloadSignal: number;
}

export default function PhotoOrganizeBoard(props: PhotoOrganizeBoardProps) {
  const board = usePhotoBoard(props);
  const [viewDensity, setViewDensity] = useState<ViewDensity>('compact');

  return (
    <div className="photo-organize" id="photo-organize-top">
      {board.error && <div className="admin-alert admin-alert-error">{board.error}</div>}

      <PhotoToolbar
        filters={board.filters}
        searchInput={board.searchInput}
        onSearchInput={board.setSearchInput}
        onApplyFilters={board.applyFilters}
        onResetFilters={board.resetFilters}
        hasActiveFilters={board.hasActiveFilters}
        loading={board.loadingPage}
        filterEventLabel={board.filterEventLabel}
        onFilterEventLabel={board.setFilterEventLabel}
        viewDensity={viewDensity}
        onViewDensity={setViewDensity}
        total={board.total}
        rangeStart={board.rangeStart}
        rangeEnd={board.rangeEnd}
      />

      <PhotoBulkBar
        selectedCount={board.selected.size}
        allSelected={board.allSelected}
        hasPhotos={board.photos.length > 0}
        onToggleSelectAll={board.toggleSelectAll}
        onClearSelection={board.clearSelection}
        bulkEventId={board.bulkEventId}
        bulkEventLabel={board.bulkEventLabel}
        onBulkEvent={(id, label) => {
          board.setBulkEventId(id);
          board.setBulkEventLabel(label);
        }}
        running={board.bulkRunning}
        onRun={board.runBulk}
      />

      <PhotoGrid
        photos={board.photos}
        selected={board.selected}
        onToggleSelect={board.toggleSelect}
        onOpenDetail={board.openDrawer}
        density={viewDensity}
        loading={board.loadingPage}
        hasActiveFilters={board.hasActiveFilters}
      />

      <Pagination
        page={board.page}
        totalPages={board.totalPages}
        onPageChange={(n) => board.loadPage(n)}
        disabled={board.loadingPage}
      />

      {board.drawerPhoto && (
        <PhotoDetailDrawer
          photo={board.drawerPhoto}
          saving={board.savingId === board.drawerPhoto.id}
          deleting={board.deletingId === board.drawerPhoto.id}
          onSave={board.savePhoto}
          onDelete={board.deletePhoto}
          onClose={board.closeDrawer}
          onOpenLightbox={() => board.openLightboxFor(board.drawerPhoto!.id)}
        />
      )}

      {board.lightboxIndex !== null && board.photos[board.lightboxIndex] && (
        <PhotoLightbox
          photos={board.photos}
          index={board.lightboxIndex}
          onClose={() => board.setLightboxIndex(null)}
          onIndexChange={board.setLightboxIndex}
        />
      )}
    </div>
  );
}
