/**
 * Admin Glossary Song Edit (말모이 노래)
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getGlossarySongById } from '@/lib/d1';
import SongForm from '@/components/admin/glossary/SongForm';

export const metadata = {
  title: '노래 편집 | KTDOC Admin',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditSongPage({ params }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'glossary');

  const { id } = await params;
  const songId = parseInt(id);
  if (isNaN(songId)) {
    notFound();
  }

  const song = await getGlossarySongById(songId);
  if (!song) {
    notFound();
  }

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
            <span>{song.title_ko}</span>
          </div>
          <h1 className="admin-title">노래 편집</h1>
        </div>
      </div>

      <SongForm song={song} />
    </div>
  );
}
