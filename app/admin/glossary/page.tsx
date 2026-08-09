/**
 * Admin Glossary List (말모이 — 용어 뷰)
 * 한국 전통무용 용어 목록 및 관리
 */

import Link from 'next/link';
import T from '@/components/common/T';
import GlossaryFilters from '@/components/admin/glossary/GlossaryFilters';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getGlossaryTerms, getGlossaryCategories, getGlossaryCounts } from '@/lib/d1';
import GlossaryTable from '@/components/admin/glossary/GlossaryTable';
import GlossaryCategoryManager from '@/components/admin/glossary/GlossaryCategoryManager';
import GlossaryViewTabs from '@/components/admin/glossary/GlossaryViewTabs';

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

  const [{ terms, total }, categories, counts] = await Promise.all([
    getGlossaryTerms({
      categoryId,
      search: params.search || undefined,
      published: 'all',
    }),
    getGlossaryCategories(),
    getGlossaryCounts(),
  ]);

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
              <T k="admin.glossary.crumb">말모이</T>
            </span>
          </div>
          <h1 className="admin-title">
            <T k="admin.glossary.crumb">말모이</T>
          </h1>
          <p className="admin-subtitle">
            <T k="admin.glossary.subtitle">
              한국 전통무용 용어와 발음을 정리합니다. 공개된 용어는 학생·학부모가 말모이 페이지에서
              검색·열람합니다.
            </T>
          </p>
        </div>
        <div className="admin-header-actions">
          <Link href="/glossary" target="_blank" className="admin-btn admin-btn-outline">
            <T k="admin.common.viewPublicPage">공개 페이지 보기</T>
          </Link>
          <Link href="/admin/glossary/new" className="admin-btn admin-btn-primary">
            <T k="admin.glossary.new">+ 새 용어 추가</T>
          </Link>
        </div>
      </div>

      <GlossaryViewTabs active="terms" termCount={counts.terms} songCount={counts.songs} />

      <GlossaryCategoryManager categories={categories} />

      <GlossaryFilters
        categories={categories}
        category={params.category || ''}
        search={params.search || ''}
        total={total}
        resetHref="/admin/glossary"
        countKey="admin.glossary.total"
        countKo="총 {n}개의 용어"
        searchPlaceholderKey="admin.glossary.searchPlaceholder"
        searchPlaceholderKo="용어·발음·뜻 검색..."
      />

      <GlossaryTable terms={terms} />
    </div>
  );
}
