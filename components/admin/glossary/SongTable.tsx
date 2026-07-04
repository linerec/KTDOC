'use client';

/**
 * SongTable
 * 관리자용 말모이 노래 목록 테이블.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { GlossarySong } from '@/types/glossary';

interface SongTableProps {
  songs: GlossarySong[];
}

export default function SongTable({ songs }: SongTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (song: GlossarySong) => {
    if (!confirm(`"${song.title_ko}" 노래를 삭제하시겠습니까? 가사도 함께 삭제됩니다.`)) return;
    setDeletingId(song.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/glossary/songs/${song.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '삭제에 실패했습니다.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleTogglePublish = async (song: GlossarySong) => {
    setTogglingId(song.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/glossary/songs/${song.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_published: !song.is_published }),
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

  if (songs.length === 0) {
    return (
      <div className="admin-empty-state">
        <p>아직 등록된 노래가 없습니다.</p>
        <Link href="/admin/glossary/songs/new" className="admin-btn admin-btn-primary">
          첫 노래 추가하기
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
              <th>노래</th>
              <th style={{ width: '160px' }}>발음</th>
              <th style={{ width: '80px' }}>음원</th>
              <th style={{ width: '92px' }}>공개 상태</th>
              <th style={{ width: '180px' }}>작업</th>
            </tr>
          </thead>
          <tbody>
            {songs.map((song) => (
              <tr key={song.id}>
                <td>
                  <Link href={`/admin/glossary/songs/${song.id}`} className="admin-table-link">
                    <span className="admin-table-title">{song.title_ko}</span>
                    {song.title_en && <span className="admin-table-subtitle">{song.title_en}</span>}
                  </Link>
                </td>
                <td>
                  {song.pronunciation ? (
                    <span className="admin-table-subtitle">/ {song.pronunciation} /</span>
                  ) : (
                    '-'
                  )}
                </td>
                <td>{song.youtube_url ? '▶' : '-'}</td>
                <td>
                  <button
                    type="button"
                    className={`admin-badge ${
                      song.is_published ? 'admin-badge-success' : 'admin-badge-muted'
                    }`}
                    onClick={() => handleTogglePublish(song)}
                    disabled={togglingId === song.id}
                  >
                    {togglingId === song.id ? '...' : song.is_published ? '공개' : '비공개'}
                  </button>
                </td>
                <td>
                  <div className="admin-table-actions">
                    <Link href={`/admin/glossary/songs/${song.id}`} className="admin-btn admin-btn-sm">
                      편집
                    </Link>
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm admin-btn-danger"
                      onClick={() => handleDelete(song)}
                      disabled={deletingId === song.id}
                    >
                      {deletingId === song.id ? '...' : '삭제'}
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
