'use client';

/**
 * FaqManager Component
 * Q&A 관리 — 작성/편집 패널 + 목록 테이블(대상 필터·공개 토글·삭제)
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FaqItem } from '@/types/faq';

/** 이벤트 연결 선택지(공통 제외) — 서버 페이지에서 내려주는 최소 메타 */
export interface FaqEventOption {
  id: number;
  title_ko: string;
  year: number;
}

interface FaqManagerProps {
  items: FaqItem[];
  events: FaqEventOption[];
}

interface FormState {
  event_id: string; // ''=공통, 숫자 문자열=이벤트 id
  question: string;
  answer: string;
  sort_order: number;
  is_published: boolean;
}

const EMPTY_FORM: FormState = {
  event_id: '',
  question: '',
  answer: '',
  sort_order: 0,
  is_published: true,
};

export default function FaqManager({ items, events }: FaqManagerProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>('all'); // 'all' | 'general' | 이벤트 id
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'general') return items.filter((i) => i.event_id === null);
    return items.filter((i) => String(i.event_id) === filter);
  }, [items, filter]);

  const targetLabel = (item: FaqItem) =>
    item.event_id === null
      ? '공통'
      : `${item.event_year} · ${item.event_title_ko ?? `이벤트 #${item.event_id}`}`;

  const openCreate = () => {
    setEditingId(null);
    // 필터로 특정 이벤트를 보고 있으면 그 이벤트를 기본 대상으로
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
        throw new Error(data.error || '저장에 실패했습니다.');
      }
      closePanel();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
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
        throw new Error(data.error || '상태 변경에 실패했습니다.');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 변경에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: FaqItem) => {
    if (!confirm(`"${item.question}" 항목을 삭제하시겠습니까?`)) return;
    setBusyId(item.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/faq/${item.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || '삭제에 실패했습니다.');
      }
      if (editingId === item.id) closePanel();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      {error && <div className="admin-alert admin-alert-error">{error}</div>}

      {/* 필터 + 작성 버튼 */}
      <div className="admin-filters">
        <div className="admin-filter-form">
          <select
            className="admin-filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">전체 대상</option>
            <option value="general">공통</option>
            {events.map((ev) => (
              <option key={ev.id} value={String(ev.id)}>
                {ev.year} · {ev.title_ko}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-filter-info">
          총 {filtered.length}개의 Q&A
          {!panelOpen && (
            <button
              type="button"
              className="admin-btn admin-btn-primary admin-btn-sm"
              style={{ marginLeft: 12 }}
              onClick={openCreate}
            >
              + 새 Q&A 작성
            </button>
          )}
        </div>
      </div>

      {/* 작성/편집 패널 */}
      {panelOpen && (
        <form onSubmit={handleSave} className="admin-form faq-form-panel">
          <h3 className="admin-form-section-title">
            {editingId === null ? '새 Q&A 작성' : 'Q&A 편집'}
          </h3>

          <div className="admin-form-row">
            <div className="admin-form-group">
              <label htmlFor="faq-event" className="admin-form-label">
                대상
              </label>
              <select
                id="faq-event"
                className="admin-form-select"
                value={form.event_id}
                onChange={(e) => setForm((p) => ({ ...p, event_id: e.target.value }))}
              >
                <option value="">공통 (모든 공연·행사에 해당)</option>
                {events.map((ev) => (
                  <option key={ev.id} value={String(ev.id)}>
                    {ev.year} · {ev.title_ko}
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-form-group">
              <label htmlFor="faq-order" className="admin-form-label">
                표시 순서 (작을수록 먼저)
              </label>
              <input
                type="number"
                id="faq-order"
                className="admin-form-input"
                value={form.sort_order}
                min={0}
                onChange={(e) => setForm((p) => ({ ...p, sort_order: Number(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div className="admin-form-group">
            <label htmlFor="faq-question" className="admin-form-label">
              질문 <span className="required">*</span>
            </label>
            <input
              type="text"
              id="faq-question"
              className="admin-form-input"
              value={form.question}
              onChange={(e) => setForm((p) => ({ ...p, question: e.target.value }))}
              placeholder="예: 공연 당일 몇 시까지 도착해야 하나요?"
              required
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="faq-answer" className="admin-form-label">
              답변 <span className="required">*</span>
            </label>
            <textarea
              id="faq-answer"
              className="admin-form-textarea"
              rows={5}
              value={form.answer}
              onChange={(e) => setForm((p) => ({ ...p, answer: e.target.value }))}
              required
            />
          </div>

          <div className="admin-form-checkbox">
            <input
              type="checkbox"
              id="faq-published"
              checked={form.is_published}
              onChange={(e) => setForm((p) => ({ ...p, is_published: e.target.checked }))}
            />
            <label htmlFor="faq-published">Q&A 메뉴에 공개</label>
          </div>

          <div className="admin-form-actions">
            <button
              type="button"
              className="admin-btn admin-btn-outline"
              onClick={closePanel}
              disabled={saving}
            >
              취소
            </button>
            <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
              {saving ? '저장 중...' : editingId === null ? '등록' : '저장'}
            </button>
          </div>
        </form>
      )}

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div className="admin-empty-state">
          <p>등록된 Q&A가 없습니다. 공연 전에 자주 묻는 질문을 미리 등록해 보세요.</p>
          {!panelOpen && (
            <button type="button" className="admin-btn admin-btn-primary" onClick={openCreate}>
              첫 Q&A 작성하기
            </button>
          )}
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>질문</th>
                <th style={{ width: '220px' }}>대상</th>
                <th style={{ width: '70px' }}>순서</th>
                <th style={{ width: '92px' }}>공개 상태</th>
                <th style={{ width: '120px' }}>작성자</th>
                <th style={{ width: '160px' }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    <button
                      type="button"
                      className="admin-table-link faq-question-link"
                      onClick={() => openEdit(item)}
                    >
                      <span className="admin-table-title">{item.question}</span>
                      <span className="admin-table-subtitle faq-answer-preview">
                        {item.answer}
                      </span>
                    </button>
                  </td>
                  <td>{targetLabel(item)}</td>
                  <td>{item.sort_order}</td>
                  <td>
                    <button
                      type="button"
                      className={`admin-badge ${
                        item.is_published ? 'admin-badge-success' : 'admin-badge-muted'
                      }`}
                      onClick={() => handleTogglePublish(item)}
                      disabled={busyId === item.id}
                    >
                      {busyId === item.id ? '...' : item.is_published ? '공개' : '비공개'}
                    </button>
                  </td>
                  <td>
                    {item.created_by || <span className="admin-table-muted">-</span>}
                  </td>
                  <td>
                    <div className="admin-table-actions">
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm"
                        onClick={() => openEdit(item)}
                      >
                        편집
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm admin-btn-danger"
                        onClick={() => handleDelete(item)}
                        disabled={busyId === item.id}
                      >
                        {busyId === item.id ? '...' : '삭제'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
