'use client';

/**
 * GlossaryCategoryManager
 * 말모이 분류를 인라인으로 추가·이름변경·삭제한다. 목록 페이지 상단의 접이식 패널로 노출.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { GlossaryCategoryWithCount } from '@/types/glossary';

interface Props {
  categories: GlossaryCategoryWithCount[];
}

export default function GlossaryCategoryManager({ categories }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newKo, setNewKo] = useState('');
  const [newEn, setNewEn] = useState('');

  const refresh = () => router.refresh();

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKo.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/glossary/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name_ko: newKo.trim(), name_en: newEn.trim() || undefined }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '추가에 실패했습니다.');
      setNewKo('');
      setNewEn('');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '추가에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (c: GlossaryCategoryWithCount) => {
    const msg =
      c.term_count > 0
        ? `"${c.name_ko}" 분류를 삭제하시겠습니까? 이 분류의 용어 ${c.term_count}개는 '분류 없음'으로 바뀝니다.`
        : `"${c.name_ko}" 분류를 삭제하시겠습니까?`;
    if (!confirm(msg)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/glossary/categories/${c.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '삭제에 실패했습니다.');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (c: GlossaryCategoryWithCount) => {
    const name_ko = prompt('분류 이름 (한글)', c.name_ko);
    if (name_ko === null) return;
    const name_en = prompt('분류 이름 (영문)', c.name_en || '');
    if (name_en === null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/glossary/categories/${c.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name_ko: name_ko.trim(), name_en: name_en.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '수정에 실패했습니다.');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '수정에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-inline-panel">
      <button
        type="button"
        className="admin-btn admin-btn-sm admin-btn-outline"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? '분류 관리 닫기' : `분류 관리 (${categories.length})`}
      </button>

      {open && (
        <div className="admin-inline-panel-body">
          {error && <div className="admin-alert admin-alert-error">{error}</div>}

          <ul className="admin-chip-list">
            {categories.map((c) => (
              <li key={c.id} className="admin-chip">
                <span className="admin-chip-label">
                  {c.name_ko}
                  {c.name_en ? ` · ${c.name_en}` : ''}
                  <span className="admin-chip-count">{c.term_count}</span>
                </span>
                <button
                  type="button"
                  className="admin-chip-btn"
                  onClick={() => handleRename(c)}
                  disabled={busy}
                  aria-label={`${c.name_ko} 이름 변경`}
                >
                  이름
                </button>
                <button
                  type="button"
                  className="admin-chip-btn admin-chip-btn-danger"
                  onClick={() => handleDelete(c)}
                  disabled={busy}
                  aria-label={`${c.name_ko} 삭제`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          <form onSubmit={handleAdd} className="admin-inline-form">
            <input
              type="text"
              className="admin-form-input"
              placeholder="새 분류 (한글)"
              value={newKo}
              onChange={(e) => setNewKo(e.target.value)}
              disabled={busy}
            />
            <input
              type="text"
              className="admin-form-input"
              placeholder="영문 (선택)"
              value={newEn}
              onChange={(e) => setNewEn(e.target.value)}
              disabled={busy}
            />
            <button type="submit" className="admin-btn admin-btn-sm admin-btn-primary" disabled={busy || !newKo.trim()}>
              추가
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
