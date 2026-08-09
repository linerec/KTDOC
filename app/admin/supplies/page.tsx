/**
 * Admin Supplies List (준비물 카탈로그 — 개별 항목 뷰)
 */

import Link from 'next/link';
import T from '@/components/common/T';
import GlossaryFilters from '@/components/admin/glossary/GlossaryFilters';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getSupplyItems, getSupplyCounts } from '@/lib/d1';
import SupplyTable from '@/components/admin/supplies/SupplyTable';
import SuppliesViewTabs from '@/components/admin/supplies/SuppliesViewTabs';

export const metadata = {
  title: '준비물 | KTDOC Admin',
};

interface PageProps {
  searchParams: Promise<{ search?: string }>;
}

export default async function AdminSuppliesPage({ searchParams }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'supplies');

  const params = await searchParams;
  const [{ items, total }, counts] = await Promise.all([
    getSupplyItems({
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
            <T k="admin.supplies.subtitle">
              자주 쓰는 준비물을 등록해 두면, 공연·수업을 만들 때 골라 붙일 수 있습니다.
              학생·학부모는 각 공연·수업에서 무엇을 챙길지 확인합니다.
            </T>
          </p>
        </div>
        <div className="admin-header-actions">
          <Link href="/admin/supplies/new" className="admin-btn admin-btn-primary">
            <T k="admin.supplies.new">+ 새 준비물 추가</T>
          </Link>
        </div>
      </div>

      <SuppliesViewTabs active="items" itemCount={counts.items} setCount={counts.sets} />

      <GlossaryFilters
        search={params.search || ''}
        total={total}
        resetHref="/admin/supplies"
        countKey="admin.supplies.total"
        countKo="총 {n}개"
        searchPlaceholderKey="admin.supplies.searchPlaceholder"
        searchPlaceholderKo="이름·설명 검색..."
      />

      <SupplyTable items={items} />
    </div>
  );
}
