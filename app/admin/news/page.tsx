/**
 * Admin News Page
 * 뉴스·미디어 게시물 목록 및 관리
 */

import Link from 'next/link';
import T from '@/components/common/T';
import NewsFilters from '@/components/admin/news/NewsFilters';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getNewsPosts } from '@/lib/d1';
import { isNewsCategory } from '@/types/news';
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
            <Link href="/admin">
              <T k="admin.common.breadcrumbHome">관리 홈</T>
            </Link>
            <span>/</span>
            <span>
              <T k="admin.news.crumb">뉴스 · 미디어</T>
            </span>
          </div>
          <h1 className="admin-title">
            <T k="admin.nav.news">뉴스 · 미디어 관리</T>
          </h1>
          <p className="admin-subtitle">
            <T k="admin.news.subtitle">
              공개 미디어 페이지(/media)에 표시될 소식, 언론 보도, 영상을 관리합니다.
            </T>
          </p>
        </div>
        <div className="admin-header-actions">
          <Link href="/media" target="_blank" className="admin-btn admin-btn-outline">
            <T k="admin.common.viewPublicPage">공개 페이지 보기</T>
          </Link>
          <Link href="/admin/news/new" className="admin-btn admin-btn-primary">
            <T k="admin.news.new">+ 새 게시물 작성</T>
          </Link>
        </div>
      </div>

      <NewsFilters
        category={params.category || ''}
        status={params.status || ''}
        search={params.search || ''}
        total={total}
      />

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
