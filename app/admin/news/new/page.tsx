/**
 * Admin News New Page
 * 새 뉴스·미디어 게시물 작성
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import NewsForm from '@/components/admin/news/NewsForm';

export const metadata = {
  title: '새 게시물 작성 | KTDOC Admin',
};

export default async function AdminNewsNewPage() {
  const session = await auth();
  await requireMenuAccess(session, 'news');

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <Link href="/admin/news">뉴스 · 미디어</Link>
            <span>/</span>
            <span>새 게시물</span>
          </div>
          <h1 className="admin-title">새 게시물 작성</h1>
          <p className="admin-subtitle">
            분류(소식·언론 보도·영상)를 먼저 선택하면 필요한 입력 항목이 표시됩니다.
          </p>
        </div>
      </div>

      <div className="admin-content">
        <NewsForm isNew />
      </div>
    </div>
  );
}
