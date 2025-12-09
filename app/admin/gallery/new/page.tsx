/**
 * Admin Gallery New Event Page
 * 새 이벤트 생성
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { getCategories } from '@/lib/d1';
import EventForm from '@/components/admin/gallery/EventForm';

export const metadata = {
  title: '새 이벤트 | KTDOC Admin',
};

export default async function AdminGalleryNewPage() {
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
            <span>새 이벤트</span>
          </div>
          <h1 className="admin-title">새 이벤트 생성</h1>
        </div>
      </div>

      <div className="admin-content">
        <EventForm categories={categories} isNew />
      </div>
    </div>
  );
}
