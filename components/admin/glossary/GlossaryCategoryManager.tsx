'use client';

/**
 * GlossaryCategoryManager
 * 말모이 분류를 인라인으로 추가·이름변경·삭제한다. 목록 페이지 상단의 접이식 패널로 노출.
 */

import { useState } from 'react';
import { useT } from '@/lib/i18n/useT';
import { useRouter } from 'next/navigation';
import type { GlossaryCategoryWithCount } from '@/types/glossary';

interface Props {
  categories: GlossaryCategoryWithCount[];
}

export default function GlossaryCategoryManager({ categories }: Props) {
  const t = useT();
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
      if (!data.success) {
        throw new Error(data.error || t('admin.glossaryCat.addFailed', '추가에 실패했습니다.'));
      }
      setNewKo('');
      setNewEn('');
      refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('admin.glossaryCat.addFailed', '추가에 실패했습니다.')
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (c: GlossaryCategoryWithCount) => {
    const msg =
      c.term_count > 0
        ? t(
            'admin.glossaryCat.deleteConfirmWithTerms',
            '"{name}" 분류를 삭제하시겠습니까? 이 분류의 용어 {n}개는 \'분류 없음\'으로 바뀝니다.',
            { name: c.name_ko, n: c.term_count }
          )
        : t('admin.glossaryCat.deleteConfirm', '"{name}" 분류를 삭제하시겠습니까?', {
            name: c.name_ko,
          });
    if (!confirm(msg)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/glossary/categories/${c.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || t('admin.common.deleteFailed', '삭제에 실패했습니다.'));
      }
      refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('admin.common.deleteFailed', '삭제에 실패했습니다.')
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (c: GlossaryCategoryWithCount) => {
    const name_ko = prompt(t('admin.glossaryCat.promptKo', '분류 이름 (한글)'), c.name_ko);
    if (name_ko === null) return;
    const name_en = prompt(t('admin.glossaryCat.promptEn', '분류 이름 (영문)'), c.name_en || '');
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
      if (!data.success) {
        throw new Error(data.error || t('admin.categories.updateFailed', '수정에 실패했습니다.'));
      }
      refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('admin.categories.updateFailed', '수정에 실패했습니다.')
      );
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
        {open
          ? t('admin.glossaryCat.close', '분류 관리 닫기')
          : t('admin.glossaryCat.open', '분류 관리 ({n})', { n: categories.length })}
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
                  aria-label={t('admin.glossaryCat.renameAria', '{name} 이름 변경', {
                    name: c.name_ko,
                  })}
                >
                  {t('admin.glossaryCat.rename', '이름')}
                </button>
                <button
                  type="button"
                  className="admin-chip-btn admin-chip-btn-danger"
                  onClick={() => handleDelete(c)}
                  disabled={busy}
                  aria-label={t('admin.glossaryCat.deleteAria', '{name} 삭제', { name: c.name_ko })}
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
              placeholder={t('admin.glossaryCat.newKo', '새 분류 (한글)')}
              value={newKo}
              onChange={(e) => setNewKo(e.target.value)}
              disabled={busy}
            />
            <input
              type="text"
              className="admin-form-input"
              placeholder={t('admin.glossaryCat.newEn', '영문 (선택)')}
              value={newEn}
              onChange={(e) => setNewEn(e.target.value)}
              disabled={busy}
            />
            <button type="submit" className="admin-btn admin-btn-sm admin-btn-primary" disabled={busy || !newKo.trim()}>
              {t('admin.categories.add', '추가')}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
