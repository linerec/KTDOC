/**
 * Admin Glossary Song Create (말모이 노래)
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import SongForm from '@/components/admin/glossary/SongForm';

export const metadata = {
  title: '새 노래 | KTDOC Admin',
};

export default async function NewSongPage() {
  const session = await auth();
  await requireMenuAccess(session, 'glossary');

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <Link href="/admin/glossary">말모이 (용어집)</Link>
            <span>/</span>
            <Link href="/admin/glossary/songs">노래</Link>
            <span>/</span>
            <span>새 노래</span>
          </div>
          <h1 className="admin-title">새 노래 추가</h1>
          <p className="admin-subtitle">제목과 가사를 줄 단위로 입력하세요.</p>
        </div>
      </div>

      <SongForm isNew />
    </div>
  );
}
