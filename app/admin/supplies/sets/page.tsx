/**
 * Admin Supply Sets List (준비물 카탈로그 — 세트 뷰)
 */

import Link from 'next/link';
import T from '@/components/common/T';
import GlossaryFilters from '@/components/admin/glossary/GlossaryFilters';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getSupplySets, getSupplyCounts } from '@/lib/d1';
import SetTable from '@/components/admin/supplies/SetTable';
import SuppliesViewTabs from '@/components/admin/supplies/SuppliesViewTabs';

export const metadata = {
  title: '준비물 세트 | KTDOC Admin',
};

interface PageProps {
  searchParams: Promise<{ search?: string }>;
}

export default async function AdminSupplySetsPage({ searchParams }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'supplies');

  const params = await searchParams;
  const [{ sets, total }, counts] = await Promise.all([
    getSupplySets({
      search: params.search || undefined,
      active: 'all',
    }),
    getSupplyCounts(),
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
              <T k="admin.nav.supplies">준비물</T>
            </span>
          </div>
          <h1 className="admin-title">
            <T k="admin.supplies.catalog">준비물 카탈로그</T>
          </h1>
          <p className="admin-subtitle">
            <T k="admin.sets.subtitle">
              자주 함께 챙기는 준비물을 하나로 묶습니다. 공연·수업에서는 개별 항목과 세트를 섞어
              지정할 수 있습니다.
            </T>
          </p>
        </div>
        <div className="admin-header-actions">
          <Link href="/admin/supplies/sets/new" className="admin-btn admin-btn-primary">
            <T k="admin.sets.new">+ 새 세트 만들기</T>
          </Link>
        </div>
      </div>

      <SuppliesViewTabs active="sets" itemCount={counts.items} setCount={counts.sets} />

      <GlossaryFilters
        search={params.search || ''}
        total={total}
        resetHref="/admin/supplies/sets"
        countKey="admin.sets.total"
        countKo="총 {n}개 세트"
        searchPlaceholderKey="admin.sets.searchPlaceholder"
        searchPlaceholderKo="세트 이름 검색..."
      />

      <SetTable sets={sets} />
    </div>
  );
}
