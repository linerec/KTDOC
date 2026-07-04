'use client';

/**
 * GlossaryTable
 * 관리자용 말모이(용어집) 목록 테이블 (programs ProgramTable 패턴).
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { GlossaryTermWithCategory } from '@/types/glossary';

interface GlossaryTableProps {
  terms: GlossaryTermWithCategory[];
}

export default function GlossaryTable({ terms }: GlossaryTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (term: GlossaryTermWithCategory) => {
    if (!confirm(`"${term.term_ko}" 용어를 삭제하시겠습니까?`)) return;

    setDeletingId(term.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/glossary/${term.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '삭제에 실패했습니다.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleTogglePublish = async (term: GlossaryTermWithCategory) => {
    setTogglingId(term.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/glossary/${term.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_published: !term.is_published }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '상태 변경에 실패했습니다.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 변경에 실패했습니다.');
    } finally {
      setTogglingId(null);
    }
  };

  if (terms.length === 0) {
    return (
      <div className="admin-empty-state">
        <p>아직 등록된 용어가 없습니다.</p>
        <Link href="/admin/glossary/new" className="admin-btn admin-btn-primary">
          첫 용어 추가하기
        </Link>
      </div>
    );
  }

  return (
    <>
      {error && <div className="admin-alert admin-alert-error">{error}</div>}
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>용어</th>
              <th style={{ width: '160px' }}>발음</th>
              <th style={{ width: '140px' }}>분류</th>
              <th style={{ width: '92px' }}>공개 상태</th>
              <th style={{ width: '180px' }}>작업</th>
            </tr>
          </thead>
          <tbody>
            {terms.map((term) => (
              <tr key={term.id}>
                <td>
                  <Link href={`/admin/glossary/${term.id}`} className="admin-table-link">
                    <span className="admin-table-title">{term.term_ko}</span>
                    {term.term_en && <span className="admin-table-subtitle">{term.term_en}</span>}
                  </Link>
                </td>
                <td>
                  {term.pronunciation ? (
                    <span className="admin-table-subtitle">/ {term.pronunciation} /</span>
                  ) : term.romanization ? (
                    <span className="admin-table-subtitle">{term.romanization}</span>
                  ) : (
                    '-'
                  )}
                </td>
                <td>{term.category_name_ko || '-'}</td>
                <td>
                  <button
                    type="button"
                    className={`admin-badge ${
                      term.is_published ? 'admin-badge-success' : 'admin-badge-muted'
                    }`}
                    onClick={() => handleTogglePublish(term)}
                    disabled={togglingId === term.id}
                  >
                    {togglingId === term.id ? '...' : term.is_published ? '공개' : '비공개'}
                  </button>
                </td>
                <td>
                  <div className="admin-table-actions">
                    <Link href={`/admin/glossary/${term.id}`} className="admin-btn admin-btn-sm">
                      편집
                    </Link>
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm admin-btn-danger"
                      onClick={() => handleDelete(term)}
                      disabled={deletingId === term.id}
                    >
                      {deletingId === term.id ? '...' : '삭제'}
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
