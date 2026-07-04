/**
 * Admin Glossary Songs List (말모이 노래)
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getGlossarySongs } from '@/lib/d1';
import SongTable from '@/components/admin/glossary/SongTable';

export const metadata = {
  title: '말모이 노래 | KTDOC Admin',
};

interface PageProps {
  searchParams: Promise<{ search?: string }>;
}

export default async function AdminGlossarySongsPage({ searchParams }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'glossary');

  const params = await searchParams;
  const { songs, total } = await getGlossarySongs({
    search: params.search || undefined,
    published: 'all',
  });

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <Link href="/admin/glossary">말모이 (용어집)</Link>
            <span>/</span>
            <span>노래</span>
          </div>
          <h1 className="admin-title">말모이 노래 · 노랫말</h1>
          <p className="admin-subtitle">
            별달거리처럼 가사를 외워 부르는 노래를 줄별 한국어·발음·영어로 정리합니다. 공개된 노래는 말모이 &lsquo;노래&rsquo; 탭에 표시됩니다.
          </p>
        </div>
        <div className="admin-header-actions">
          <Link href="/admin/glossary" className="admin-btn admin-btn-outline">
            용어 목록
          </Link>
          <Link href="/admin/glossary/songs/new" className="admin-btn admin-btn-primary">
            + 새 노래 추가
          </Link>
        </div>
      </div>

      <div className="admin-filters">
        <form className="admin-filter-form" method="get">
          <input
            type="text"
            name="search"
            placeholder="노래 제목 검색..."
            className="admin-filter-input"
            defaultValue={params.search || ''}
          />
          <button type="submit" className="admin-btn admin-btn-sm">검색</button>
          {params.search && (
            <Link href="/admin/glossary/songs" className="admin-btn admin-btn-sm admin-btn-outline">
              초기화
            </Link>
          )}
        </form>
        <div className="admin-filter-info">총 {total}곡</div>
      </div>

      <SongTable songs={songs} />
    </div>
  );
}
