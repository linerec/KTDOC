'use client';

/**
 * FaqManager — Q&A 관리
 *
 * 상태와 저장·삭제만 여기서 맡고, 화면은 둘로 갈랐다:
 *  - FaqEditorPanel : 작성·편집 패널
 *  - FaqTable       : 목록(공개 토글·삭제)
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FaqItem } from '@/types/faq';
import { useT } from '@/lib/i18n/useT';
import FaqEditorPanel, { type FaqFormState } from './FaqEditorPanel';
import FaqTable from './FaqTable';

/** 공연 연결 선택지(공통 제외) — 서버 페이지에서 내려주는 최소 메타 */
export interface FaqEventOption {
  id: number;
  title_ko: string;
  year: number;
}

interface FaqManagerProps {
  items: FaqItem[];
  events: FaqEventOption[];
}

const EMPTY_FORM: FaqFormState = {
  event_id: '',
  question: '',
  answer: '',
  sort_order: 0,
  is_published: true,
};

export default function FaqManager({ items, events }: FaqManagerProps) {
  const router = useRouter();
  const t = useT();
  const [filter, setFilter] = useState<string>('all'); // 'all' | 'general' | 공연 id
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FaqFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'general') return items.filter((i) => i.event_id === null);
    return items.filter((i) => String(i.event_id) === filter);
  }, [items, filter]);

  const openCreate = () => {
    setEditingId(null);
    // 필터로 특정 공연을 보고 있으면 그 공연을 기본 대상으로
    setForm({ ...EMPTY_FORM, event_id: filter !== 'all' && filter !== 'general' ? filter : '' });
    setPanelOpen(true);
    setError(null);
  };

  const openEdit = (item: FaqItem) => {
    setEditingId(item.id);
    setForm({
      event_id: item.event_id === null ? '' : String(item.event_id),
      question: item.question,
      answer: item.answer,
      sort_order: item.sort_order,
      is_published: item.is_published === 1,
    });
    setPanelOpen(true);
    setError(null);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = {
        event_id: form.event_id === '' ? null : Number(form.event_id),
        question: form.question,
        answer: form.answer,
        sort_order: form.sort_order,
        is_published: form.is_published,
      };
      const url = editingId === null ? '/api/admin/faq' : `/api/admin/faq/${editingId}`;
      const res = await fetch(url, {
        method: editingId === null ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || t('admin.common.saveFailed', '저장에 실패했습니다.'));
      }
      closePanel();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('admin.common.saveFailed', '저장에 실패했습니다.')
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (item: FaqItem) => {
    setBusyId(item.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/faq/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_published: !item.is_published }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || t('admin.common.toggleFailed', '상태 변경에 실패했습니다.'));
      }
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('admin.common.toggleFailed', '상태 변경에 실패했습니다.')
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: FaqItem) => {
    if (
      !confirm(
        t('admin.faq.deleteConfirm', '"{q}" 항목을 삭제하시겠습니까?', { q: item.question })
      )
    ) {
      return;
    }
    setBusyId(item.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/faq/${item.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || t('admin.common.deleteFailed', '삭제에 실패했습니다.'));
      }
      if (editingId === item.id) closePanel();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('admin.common.deleteFailed', '삭제에 실패했습니다.')
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      {error && <div className="admin-alert admin-alert-error">{error}</div>}

      <div className="admin-filters">
        <div className="admin-filter-form">
          <select
            className="admin-filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">{t('admin.faq.allTargets', '전체 대상')}</option>
            <option value="general">{t('admin.faq.targetGeneral', '공통')}</option>
            {events.map((ev) => (
              <option key={ev.id} value={String(ev.id)}>
                {ev.year} · {ev.title_ko}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-filter-info">
          {t('admin.faq.total', '총 {n}개의 Q&A', { n: filtered.length })}
          {!panelOpen && (
            <button
              type="button"
              className="admin-btn admin-btn-primary admin-btn-sm"
              style={{ marginLeft: 12 }}
              onClick={openCreate}
            >
              {t('admin.faq.new', '+ 새 Q&A 작성')}
            </button>
          )}
        </div>
      </div>

      {panelOpen && (
        <FaqEditorPanel
          form={form}
          onChange={(patch) => setForm((p) => ({ ...p, ...patch }))}
          onSubmit={handleSave}
          onCancel={closePanel}
          events={events}
          isNew={editingId === null}
          saving={saving}
        />
      )}

      {filtered.length === 0 ? (
        <div className="admin-empty-state">
          <p>
            {t(
              'admin.faq.empty',
              '등록된 Q&A가 없습니다. 공연 전에 자주 묻는 질문을 미리 등록해 보세요.'
            )}
          </p>
          {!panelOpen && (
            <button type="button" className="admin-btn admin-btn-primary" onClick={openCreate}>
              {t('admin.faq.emptyCta', '첫 Q&A 작성하기')}
            </button>
          )}
        </div>
      ) : (
        <FaqTable
          items={filtered}
          busyId={busyId}
          onEdit={openEdit}
          onTogglePublish={handleTogglePublish}
          onDelete={handleDelete}
        />
      )}
    </>
  );
}
