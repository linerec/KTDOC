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
  title: '카테고리 관리 | KTDOC Admin',
};

export default async function AdminGalleryCategoriesPage() {
  const session = await auth();
  if (!session) {
    redirect('/admin');
  }

  const categories = await getCategories();

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin/gallery">Gallery 관리</Link>
            <span>/</span>
            <span>카테고리</span>
          </div>
          <h1 className="admin-title">카테고리 관리</h1>
          <p className="admin-subtitle">이벤트 분류를 위한 카테고리를 관리합니다</p>
        </div>
        <div className="admin-header-actions">
          <Link href="/admin/gallery" className="admin-btn admin-btn-outline">
            이벤트 목록
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
