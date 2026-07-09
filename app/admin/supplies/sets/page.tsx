/**
 * Admin Supply Sets List (준비물 카탈로그 — 세트 뷰)
 */

import Link from 'next/link';
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
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <span>준비물</span>
          </div>
          <h1 className="admin-title">준비물 카탈로그</h1>
          <p className="admin-subtitle">
            자주 함께 챙기는 준비물을 하나로 묶습니다. 이벤트·수업에서는 개별 항목과 세트를 섞어 지정할 수 있습니다.
          </p>
        </div>
        <div className="admin-header-actions">
          <Link href="/admin/supplies/sets/new" className="admin-btn admin-btn-primary">
            + 새 세트 만들기
          </Link>
        </div>
      </div>

      <SuppliesViewTabs active="sets" itemCount={counts.items} setCount={counts.sets} />

      <div className="admin-filters">
        <form className="admin-filter-form" method="get">
          <input
            type="text"
            name="search"
            placeholder="세트 이름 검색..."
            className="admin-filter-input"
            defaultValue={params.search || ''}
          />
          <button type="submit" className="admin-btn admin-btn-sm">검색</button>
          {params.search && (
            <Link href="/admin/supplies/sets" className="admin-btn admin-btn-sm admin-btn-outline">
              초기화
            </Link>
          )}
        </form>
        <div className="admin-filter-info">총 {total}개 세트</div>
      </div>

      <SetTable sets={sets} />
    </div>
  );
}
