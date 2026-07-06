/**
 * Admin News Page
 * 뉴스·미디어 게시물 목록 및 관리
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getNewsPosts } from '@/lib/d1';
import { NEWS_CATEGORIES, NEWS_CATEGORY_LABELS, isNewsCategory } from '@/types/news';
import NewsTable from '@/components/admin/news/NewsTable';

export const metadata = {
  title: '뉴스 · 미디어 관리 | KTDOC Admin',
};

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{
    category?: string;
    status?: string;
    search?: string;
    page?: string;
  }>;
}

export default async function AdminNewsPage({ searchParams }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'news');

  const params = await searchParams;
  const page = params.page ? Math.max(1, parseInt(params.page)) : 1;
  const category = isNewsCategory(params.category) ? params.category : undefined;
  const published =
    params.status === 'published' ? true : params.status === 'draft' ? false : ('all' as const);

  const { posts, total } = await getNewsPosts({
    category,
    search: params.search || undefined,
    page,
    limit: PAGE_SIZE,
    published,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 현재 필터를 유지한 채 페이지만 바꾸는 링크
  const pageHref = (p: number) => {
    const qs = new URLSearchParams();
    if (params.category) qs.set('category', params.category);
    if (params.status) qs.set('status', params.status);
    if (params.search) qs.set('search', params.search);
    if (p > 1) qs.set('page', String(p));
    const s = qs.toString();
    return s ? `/admin/news?${s}` : '/admin/news';
  };

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <span>뉴스 · 미디어</span>
          </div>
          <h1 className="admin-title">뉴스 · 미디어 관리</h1>
          <p className="admin-subtitle">
            공개 미디어 페이지(/media)에 표시될 소식, 언론 보도, 영상을 관리합니다.
          </p>
        </div>
        <div className="admin-header-actions">
          <Link href="/media" target="_blank" className="admin-btn admin-btn-outline">
            공개 페이지 보기
          </Link>
          <Link href="/admin/news/new" className="admin-btn admin-btn-primary">
            + 새 게시물 작성
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="admin-filters">
        <form className="admin-filter-form" method="get">
          <select
            name="category"
            className="admin-filter-select"
            defaultValue={params.category || ''}
          >
            <option value="">전체 분류</option>
            {NEWS_CATEGORIES.map((c) => (
              <option key={c} value={c}>{NEWS_CATEGORY_LABELS[c]}</option>
            ))}
          </select>

          <select
            name="status"
            className="admin-filter-select"
            defaultValue={params.status || ''}
          >
            <option value="">전체 상태</option>
            <option value="published">공개</option>
            <option value="draft">비공개</option>
          </select>

          <input
            type="text"
            name="search"
            placeholder="검색..."
            className="admin-filter-input"
            defaultValue={params.search || ''}
          />

          <button type="submit" className="admin-btn admin-btn-sm">
            검색
          </button>

          {(params.category || params.status || params.search) && (
            <Link href="/admin/news" className="admin-btn admin-btn-sm admin-btn-outline">
              초기화
            </Link>
          )}
        </form>

        <div className="admin-filter-info">
          총 {total}개의 게시물
        </div>
      </div>

      {/* News Table */}
      <NewsTable posts={posts} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="admin-pagination">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={pageHref(p)}
              className={`admin-page-link${p === page ? ' is-active' : ''}`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
