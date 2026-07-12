'use client';

/**
 * SupplyTable
 * 관리자용 준비물 카탈로그 목록 테이블.
 */

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { SupplyItemWithTerm } from '@/types/supplies';

interface SupplyTableProps {
  items: SupplyItemWithTerm[];
}

export default function SupplyTable({ items }: SupplyTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (item: SupplyItemWithTerm) => {
    if (!confirm(`"${item.name_ko}"을(를) 삭제하시겠습니까? 공연·수업에 연결된 항목도 함께 해제됩니다.`)) return;
    setDeletingId(item.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/supplies/${item.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '삭제에 실패했습니다.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (item: SupplyItemWithTerm) => {
    setTogglingId(item.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/supplies/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !item.is_active }),
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

  if (items.length === 0) {
    return (
      <div className="admin-empty-state">
        <p>아직 등록된 준비물이 없습니다.</p>
        <Link href="/admin/supplies/new" className="admin-btn admin-btn-primary">
          첫 준비물 추가하기
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
              <th style={{ width: '64px' }}>사진</th>
              <th>이름</th>
              <th style={{ width: '150px' }}>말모이 연결</th>
              <th style={{ width: '80px' }}>상태</th>
              <th style={{ width: '180px' }}>작업</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <div className="admin-table-thumbnail">
                    {item.image_url ? (
                      <Image src={item.image_url} alt={item.name_ko} width={48} height={48} className="admin-table-thumb-img" />
                    ) : (
                      <div className="admin-table-thumb-placeholder">-</div>
                    )}
                  </div>
                </td>
                <td>
                  <Link href={`/admin/supplies/${item.id}`} className="admin-table-link">
                    <span className="admin-table-title">{item.name_ko}</span>
                    {item.name_en && <span className="admin-table-subtitle">{item.name_en}</span>}
                  </Link>
                </td>
                <td>
                  {item.term_ko ? (
                    <span className="admin-table-subtitle">{item.term_ko}</span>
                  ) : (
                    '-'
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className={`admin-badge ${item.is_active ? 'admin-badge-success' : 'admin-badge-muted'}`}
                    onClick={() => handleToggleActive(item)}
                    disabled={togglingId === item.id}
                  >
                    {togglingId === item.id ? '...' : item.is_active ? '활성' : '비활성'}
                  </button>
                </td>
                <td>
                  <div className="admin-table-actions">
                    <Link href={`/admin/supplies/${item.id}`} className="admin-btn admin-btn-sm">
                      편집
                    </Link>
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm admin-btn-danger"
                      onClick={() => handleDelete(item)}
                      disabled={deletingId === item.id}
                    >
                      {deletingId === item.id ? '...' : '삭제'}
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
