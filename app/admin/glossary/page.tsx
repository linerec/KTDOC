/**
 * Admin Glossary List (말모이)
 * 한국 전통무용 용어 목록 및 관리
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getGlossaryTerms, getGlossaryCategories } from '@/lib/d1';
import GlossaryTable from '@/components/admin/glossary/GlossaryTable';
import GlossaryCategoryManager from '@/components/admin/glossary/GlossaryCategoryManager';

export const metadata = {
  title: '말모이 (용어집) | KTDOC Admin',
};

interface PageProps {
  searchParams: Promise<{ category?: string; search?: string }>;
}

export default async function AdminGlossaryPage({ searchParams }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'glossary');

  const params = await searchParams;
  const categoryId = params.category ? parseInt(params.category) || undefined : undefined;

  const [{ terms, total }, categories] = await Promise.all([
    getGlossaryTerms({
      categoryId,
      search: params.search || undefined,
      published: 'all',
    }),
    getGlossaryCategories(),
  ]);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <span>말모이 (용어집)</span>
          </div>
          <h1 className="admin-title">말모이 (용어집)</h1>
          <p className="admin-subtitle">
            한국 전통무용 용어와 발음을 정리합니다. 공개된 용어는 학생·학부모가 말모이 페이지에서 검색·열람합니다.
          </p>
        </div>
        <div className="admin-header-actions">
          <Link href="/glossary" target="_blank" className="admin-btn admin-btn-outline">
            공개 페이지 보기
          </Link>
          <Link href="/admin/glossary/new" className="admin-btn admin-btn-primary">
            + 새 용어 추가
          </Link>
        </div>
      </div>

      <GlossaryCategoryManager categories={categories} />

      <div className="admin-filters">
        <form className="admin-filter-form" method="get">
          <select name="category" className="admin-filter-select" defaultValue={params.category || ''}>
            <option value="">전체 분류</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ko} ({c.term_count})
              </option>
            ))}
          </select>
          <input
            type="text"
            name="search"
            placeholder="용어·발음·뜻 검색..."
            className="admin-filter-input"
            defaultValue={params.search || ''}
          />
          <button type="submit" className="admin-btn admin-btn-sm">검색</button>
          {(params.category || params.search) && (
            <Link href="/admin/glossary" className="admin-btn admin-btn-sm admin-btn-outline">
              초기화
            </Link>
          )}
        </form>
        <div className="admin-filter-info">총 {total}개의 용어</div>
      </div>

      <GlossaryTable terms={terms} />
    </div>
  );
}
