'use client';

/**
 * NewsTable Component
 * 관리자용 뉴스·미디어 게시물 목록 테이블
 */

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { NewsPost } from '@/types/news';
import { NEWS_CATEGORY_LABELS } from '@/types/news';

interface NewsTableProps {
  posts: NewsPost[];
}

export default function NewsTable({ posts }: NewsTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (post: NewsPost) => {
    if (!confirm(`"${post.title_ko}" 게시물을 삭제하시겠습니까?`)) return;

    setDeletingId(post.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/news/${post.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || '삭제에 실패했습니다.');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleTogglePublish = async (post: NewsPost) => {
    setTogglingId(post.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/news/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_published: !post.is_published }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || '상태 변경에 실패했습니다.');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '상태 변경에 실패했습니다.');
    } finally {
      setTogglingId(null);
    }
  };

  if (posts.length === 0) {
    return (
      <div className="admin-empty-state">
        <p>아직 등록된 게시물이 없습니다.</p>
        <Link href="/admin/news/new" className="admin-btn admin-btn-primary">
          첫 게시물 작성하기
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
              <th style={{ width: '80px' }}>이미지</th>
              <th>제목</th>
              <th style={{ width: '100px' }}>분류</th>
              <th style={{ width: '120px' }}>게시일</th>
              <th style={{ width: '92px' }}>공개 상태</th>
              <th style={{ width: '120px' }}>작성자</th>
              <th style={{ width: '240px' }}>작업</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id}>
                <td>
                  <div className="admin-table-thumbnail">
                    {post.thumbnail_url ? (
                      <Image
                        src={post.thumbnail_url}
                        alt={post.title_ko}
                        width={60}
                        height={40}
                        className="admin-table-thumb-img"
                      />
                    ) : (
                      <div className="admin-table-thumb-placeholder">-</div>
                    )}
                  </div>
                </td>
                <td>
                  <Link href={`/admin/news/${post.id}`} className="admin-table-link">
                    <span className="admin-table-title">{post.title_ko}</span>
                    {post.title_en && (
                      <span className="admin-table-subtitle">{post.title_en}</span>
                    )}
                  </Link>
                </td>
                <td>{NEWS_CATEGORY_LABELS[post.category]}</td>
                <td>{post.published_at || '-'}</td>
                <td>
                  <button
                    type="button"
                    className={`admin-badge ${
                      post.is_published ? 'admin-badge-success' : 'admin-badge-muted'
                    }`}
                    onClick={() => handleTogglePublish(post)}
                    disabled={togglingId === post.id}
                  >
                    {togglingId === post.id ? '...' : post.is_published ? '공개' : '비공개'}
                  </button>
                </td>
                <td>
                  {post.created_by || <span className="admin-table-muted">-</span>}
                </td>
                <td>
                  <div className="admin-table-actions">
                    <Link
                      href={`/admin/news/${post.id}`}
                      className="admin-btn admin-btn-sm"
                    >
                      편집
                    </Link>
                    {post.is_published ? (
                      <Link
                        href={`/media/${post.id}`}
                        target="_blank"
                        className="admin-btn admin-btn-sm admin-btn-outline"
                      >
                        공개 페이지
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm admin-btn-danger"
                      onClick={() => handleDelete(post)}
                      disabled={deletingId === post.id}
                    >
                      {deletingId === post.id ? '...' : '삭제'}
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
