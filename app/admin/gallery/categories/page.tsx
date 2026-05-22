/**
 * Admin Gallery Categories Page
 * 카테고리 관리
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { getCategories } from '@/lib/d1';
import CategoryManager from '@/components/admin/gallery/CategoryManager';

export const metadata = {
  title: '이벤트 카테고리 관리 | KTDOC Admin',
};

export default async function AdminGalleryCategoriesPage() {
  const session = await auth();
  if (!session) {
    redirect('/login');
  }

  const categories = await getCategories();

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <Link href="/admin/gallery">이벤트 아카이브</Link>
            <span>/</span>
            <span>카테고리</span>
          </div>
          <h1 className="admin-title">이벤트 카테고리 관리</h1>
          <p className="admin-subtitle">방문자가 Gallery에서 이벤트를 분류해 볼 때 사용하는 카테고리입니다.</p>
        </div>
        <div className="admin-header-actions">
          <Link href="/admin/gallery" className="admin-btn admin-btn-outline">
            이벤트 아카이브
          </Link>
        </div>
      </div>

      <div className="admin-content">
        <div className="admin-card">
          <CategoryManager initialCategories={categories} />
        </div>
      </div>
    </div>
  );
}
