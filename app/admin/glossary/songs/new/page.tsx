/**
 * Admin Glossary Song Create (말모이 노래)
 */

import Link from 'next/link';
import T from '@/components/common/T';
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
            <Link href="/admin">
              <T k="admin.common.breadcrumbHome">관리 홈</T>
            </Link>
            <span>/</span>
            <Link href="/admin/glossary">
              <T k="admin.nav.glossary">말모이 (용어집)</T>
            </Link>
            <span>/</span>
            <Link href="/admin/glossary/songs">
              <T k="admin.glossary.tabSongs">노래</T>
            </Link>
            <span>/</span>
            <span>
              <T k="admin.songs.newCrumb">새 노래</T>
            </span>
          </div>
          <h1 className="admin-title">
            <T k="admin.songs.newTitle">새 노래 추가</T>
          </h1>
          <p className="admin-subtitle">
            <T k="admin.songs.newSubtitle">제목과 가사를 줄 단위로 입력하세요.</T>
          </p>
        </div>
      </div>

      <SongForm isNew />
    </div>
  );
}
