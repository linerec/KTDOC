'use client';

/**
 * 선택 · 일괄 작업 바
 *
 * 선택이 0장이면 '전체 선택' 체크만 남고 작업 버튼은 나타나지 않는다 —
 * 대상 없이 눌러 놀라는 일을 없앤다(삭제가 섞여 있다).
 */

import EventPicker from '../EventPicker';
import { useT } from '@/lib/i18n/useT';
import type { BulkAction } from './types';

interface PhotoBulkBarProps {
  selectedCount: number;
  allSelected: boolean;
  hasPhotos: boolean;
  onToggleSelectAll: () => void;
  onClearSelection: () => void;
  bulkEventId: number | '';
  bulkEventLabel: string | null;
  onBulkEvent: (id: number | '', label: string | null) => void;
  running: boolean;
  onRun: (action: BulkAction) => void;
}

export default function PhotoBulkBar({
  selectedCount,
  allSelected,
  hasPhotos,
  onToggleSelectAll,
  onClearSelection,
  bulkEventId,
  bulkEventLabel,
  onBulkEvent,
  running,
  onRun,
}: PhotoBulkBarProps) {
  const t = useT();

  return (
    <div className={`photo-bulk-bar ${selectedCount > 0 ? 'is-active' : ''}`}>
      <label className="photo-bulk-selectall admin-form-checkbox">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={onToggleSelectAll}
          disabled={!hasPhotos}
        />
        <span>
          {selectedCount > 0
            ? t('admin.photos.selectedCount', '{n}장 선택됨', { n: selectedCount })
            : t('admin.photos.selectAll', '전체 선택')}
        </span>
      </label>

      {selectedCount > 0 && (
        <div className="photo-bulk-actions">
          <button
            type="button"
            className="admin-btn admin-btn-sm"
            disabled={running}
            onClick={() => onRun('publish')}
          >
            {t('admin.common.published', '공개')}
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-sm"
            disabled={running}
            onClick={() => onRun('unpublish')}
          >
            {t('admin.common.unpublished', '비공개')}
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-sm"
            disabled={running}
            onClick={() => onRun('feature')}
          >
            {t('admin.photos.feature', '강조')}
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-sm"
            disabled={running}
            onClick={() => onRun('unfeature')}
          >
            {t('admin.photos.unfeature', '강조 해제')}
          </button>

          <span className="photo-bulk-event">
            <EventPicker
              value={bulkEventId === '' ? null : bulkEventId}
              valueLabel={bulkEventLabel}
              placeholder={t('admin.photos.pickEvent', '공연 선택…')}
              disabled={running}
              buttonClassName="photo-bulk-event-picker"
              onChange={(id, ev) => onBulkEvent(id ?? '', ev ? `${ev.year} · ${ev.title_ko}` : null)}
            />
            <button
              type="button"
              className="admin-btn admin-btn-sm"
              disabled={running || bulkEventId === ''}
              onClick={() => onRun('assignEvent')}
            >
              {t('admin.photos.assignEvent', '공연에 넣기')}
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-sm admin-btn-outline"
              disabled={running}
              onClick={() => onRun('unassignEvent')}
            >
              {t('admin.photos.unassignEvent', '빼기')}
            </button>
          </span>

          <button
            type="button"
            className="admin-btn admin-btn-sm admin-btn-danger"
            disabled={running}
            onClick={() => onRun('delete')}
          >
            {t('admin.common.delete', '삭제')}
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-sm admin-btn-outline"
            disabled={running}
            onClick={onClearSelection}
          >
            {t('admin.photos.clearSelection', '선택 해제')}
          </button>
        </div>
      )}
    </div>
  );
}
