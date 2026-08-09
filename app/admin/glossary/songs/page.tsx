/**
 * Admin Glossary Songs List (말모이 — 노래 뷰)
 */

import Link from 'next/link';
import T from '@/components/common/T';
import GlossaryFilters from '@/components/admin/glossary/GlossaryFilters';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getGlossarySongs, getGlossaryCounts } from '@/lib/d1';
import SongTable from '@/components/admin/glossary/SongTable';
import GlossaryViewTabs from '@/components/admin/glossary/GlossaryViewTabs';

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
  const [{ songs, total }, counts] = await Promise.all([
    getGlossarySongs({
      search: params.search || undefined,
      published: 'all',
    }),
    getGlossaryCounts(),
  ]);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">
              <T k="admin.common.breadcrumbHome">관리 홈</T>
            </Link>
            <span>/</span>
            <span>
              <T k="admin.glossary.crumb">말모이</T>
            </span>
          </div>
          <h1 className="admin-title">
            <T k="admin.glossary.crumb">말모이</T>
          </h1>
          <p className="admin-subtitle">
            <T k="admin.songs.subtitle">
              별달거리처럼 가사를 외워 부르는 노래를 줄별 한국어·발음·영어로 정리합니다. 공개된
              노래는 말모이 ‘노래’ 탭에 표시됩니다.
            </T>
          </p>
        </div>
        <div className="admin-header-actions">
          <Link href="/glossary" target="_blank" className="admin-btn admin-btn-outline">
            <T k="admin.common.viewPublicPage">공개 페이지 보기</T>
          </Link>
          <Link href="/admin/glossary/songs/new" className="admin-btn admin-btn-primary">
            <T k="admin.songs.new">+ 새 노래 추가</T>
          </Link>
        </div>
      </div>

      <GlossaryViewTabs active="songs" termCount={counts.terms} songCount={counts.songs} />

      <GlossaryFilters
        search={params.search || ''}
        total={total}
        resetHref="/admin/glossary/songs"
        countKey="admin.songs.total"
        countKo="총 {n}곡"
        searchPlaceholderKey="admin.songs.searchPlaceholder"
        searchPlaceholderKo="노래 제목 검색..."
      />

      <SongTable songs={songs} />
    </div>
  );
}
