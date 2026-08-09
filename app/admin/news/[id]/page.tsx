/**
 * Admin News Edit Page
 * 뉴스·미디어 게시물 편집
 */

import { notFound } from 'next/navigation';
import T from '@/components/common/T';
import LocaleText from '@/components/common/LocaleText';
import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getNewsPostById } from '@/lib/d1';
import { NEWS_CATEGORY_LABELS } from '@/types/news';
import NewsForm from '@/components/admin/news/NewsForm';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const post = await getNewsPostById(parseInt(id));

  return {
    title: post ? `${post.title_ko} 편집 | KTDOC Admin` : '게시물 편집 | KTDOC Admin',
  };
}

export default async function AdminNewsEditPage({ params }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'news');

  const { id } = await params;
  const postId = parseInt(id);

  if (isNaN(postId)) {
    notFound();
  }

  const post = await getNewsPostById(postId);

  if (!post) {
    notFound();
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">
              <T k="admin.common.breadcrumbHome">관리 홈</T>
            </Link>
            <span>/</span>
            <Link href="/admin/news">
              <T k="admin.news.crumb">뉴스 · 미디어</T>
            </Link>
            <span>/</span>
            <span>
              <LocaleText ko={post.title_ko} en={post.title_en} />
            </span>
          </div>
          <h1 className="admin-title">
            <T k="admin.news.editTitle">게시물 편집</T>
          </h1>
          <p className="admin-subtitle">
            <T k={`admin.news.category.${post.category}`}>
              {NEWS_CATEGORY_LABELS[post.category]}
            </T>{' '}
            ·{' '}
            {post.is_published ? (
              <T k="admin.news.shownPublic">공개 미디어 페이지에 표시 중</T>
            ) : (
              <T k="admin.events.savedPrivate">비공개 저장 중</T>
            )}
          </p>
        </div>
        <div className="admin-header-actions">
          {post.is_published ? (
            <Link
              href={`/media/${post.id}`}
              target="_blank"
              className="admin-btn admin-btn-outline"
            >
              <T k="admin.common.viewPublicPage">공개 페이지 보기</T>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="admin-content">
        <NewsForm post={post} />
      </div>
    </div>
  );
}
