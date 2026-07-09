/**
 * Admin Supplies List (준비물 카탈로그 — 개별 항목 뷰)
 */

import Link from 'next/link';
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
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <span>준비물</span>
          </div>
          <h1 className="admin-title">준비물 카탈로그</h1>
          <p className="admin-subtitle">
            자주 쓰는 준비물을 등록해 두면, 이벤트·수업을 만들 때 골라 붙일 수 있습니다. 학생·학부모는 각 이벤트·수업에서 무엇을 챙길지 확인합니다.
          </p>
        </div>
        <div className="admin-header-actions">
          <Link href="/admin/supplies/new" className="admin-btn admin-btn-primary">
            + 새 준비물 추가
          </Link>
        </div>
      </div>

      <SuppliesViewTabs active="items" itemCount={counts.items} setCount={counts.sets} />

      <div className="admin-filters">
        <form className="admin-filter-form" method="get">
          <input
            type="text"
            name="search"
            placeholder="이름·설명 검색..."
            className="admin-filter-input"
            defaultValue={params.search || ''}
          />
          <button type="submit" className="admin-btn admin-btn-sm">검색</button>
          {params.search && (
            <Link href="/admin/supplies" className="admin-btn admin-btn-sm admin-btn-outline">
              초기화
            </Link>
          )}
        </form>
        <div className="admin-filter-info">총 {total}개</div>
      </div>

      <SupplyTable items={items} />
    </div>
  );
}
