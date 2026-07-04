'use client';

/**
 * SetTable
 * 관리자용 준비물 세트 목록 테이블.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { SupplySetWithItems } from '@/types/supplies';

interface SetTableProps {
  sets: SupplySetWithItems[];
}

export default function SetTable({ sets }: SetTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (set: SupplySetWithItems) => {
    if (!confirm(`"${set.name_ko}" 세트를 삭제하시겠습니까? 이벤트·수업에 지정된 이 세트도 함께 해제됩니다.`)) return;
    setDeletingId(set.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/supplies/sets/${set.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '삭제에 실패했습니다.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (set: SupplySetWithItems) => {
    setTogglingId(set.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/supplies/sets/${set.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !set.is_active }),
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

  if (sets.length === 0) {
    return (
      <div className="admin-empty-state">
        <p>아직 만든 세트가 없습니다.</p>
        <Link href="/admin/supplies/sets/new" className="admin-btn admin-btn-primary">
          첫 세트 만들기
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
              <th>세트</th>
              <th>포함 준비물</th>
              <th style={{ width: '80px' }}>상태</th>
              <th style={{ width: '180px' }}>작업</th>
            </tr>
          </thead>
          <tbody>
            {sets.map((set) => (
              <tr key={set.id}>
                <td>
                  <Link href={`/admin/supplies/sets/${set.id}`} className="admin-table-link">
                    <span className="admin-table-title">{set.name_ko}</span>
                    {set.name_en && <span className="admin-table-subtitle">{set.name_en}</span>}
                  </Link>
                </td>
                <td>
                  <span className="admin-table-subtitle">
                    {set.items.length > 0
                      ? set.items.map((i) => i.name_ko).join(', ')
                      : '구성 없음'}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className={`admin-badge ${set.is_active ? 'admin-badge-success' : 'admin-badge-muted'}`}
                    onClick={() => handleToggleActive(set)}
                    disabled={togglingId === set.id}
                  >
                    {togglingId === set.id ? '...' : set.is_active ? '활성' : '비활성'}
                  </button>
                </td>
                <td>
                  <div className="admin-table-actions">
                    <Link href={`/admin/supplies/sets/${set.id}`} className="admin-btn admin-btn-sm">
                      편집
                    </Link>
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm admin-btn-danger"
                      onClick={() => handleDelete(set)}
                      disabled={deletingId === set.id}
                    >
                      {deletingId === set.id ? '...' : '삭제'}
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
