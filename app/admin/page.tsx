import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { getCategories, getEvents, getGalleryPhotos } from '@/lib/d1';

export const metadata = {
  title: '관리 홈 | KTDOC Admin',
};

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session) {
    redirect('/login');
  }

  const [allEvents, publishedEvents, categories, loosePhotos] = await Promise.all([
    getEvents({ published: 'all', limit: 1 }),
    getEvents({ published: true, limit: 1 }),
    getCategories(),
    getGalleryPhotos({ published: undefined, organized: 'unassigned', limit: 1 }),
  ]);

  const cards = [
    {
      label: '아카이브 이벤트',
      value: allEvents.total,
      href: '/admin/gallery',
      action: '공개 Gallery에 올라갈 이벤트 관리',
    },
    {
      label: '공개된 이벤트',
      value: publishedEvents.total,
      href: '/gallery',
      action: '방문자 화면에서 확인',
    },
    {
      label: '이벤트 카테고리',
      value: categories.length,
      href: '/admin/gallery/categories',
      action: '분류 이름과 순서 관리',
    },
    {
      label: '미정리 사진',
      value: loosePhotos.total,
      href: '/admin/gallery/photos',
      action: '날짜 없이 먼저 올린 사진 정리',
    },
  ];

  return (
    <div className="admin-page">
      <div className="admin-header admin-dashboard-header">
        <div className="admin-header-content">
          <p className="admin-kicker">KTDOC Admin</p>
          <h1 className="admin-title">이벤트 아카이브 관리</h1>
          <p className="admin-subtitle">
            공개 Gallery에 표시될 이벤트와 그 안의 사진, 영상, 카테고리를 관리합니다.
          </p>
        </div>
        <div className="admin-header-actions">
          <Link href="/" className="admin-btn admin-btn-outline">
            사이트 보기
          </Link>
          <Link href="/admin/gallery/new" className="admin-btn admin-btn-primary">
            + 새 이벤트
          </Link>
          <Link href="/admin/gallery/photos" className="admin-btn admin-btn-outline">
            사진 먼저 올리기
          </Link>
        </div>
      </div>

      <section className="admin-model-panel" aria-label="관리 구조 안내">
        <div className="admin-model-item">
          <span className="admin-model-label">1. 이벤트</span>
          <strong>갤러리에 보이는 하나의 카드와 상세 페이지</strong>
          <p>공연, 워크숍, 커뮤니티 활동처럼 날짜와 제목이 있는 기록입니다.</p>
        </div>
        <div className="admin-model-arrow" aria-hidden="true">→</div>
        <div className="admin-model-item">
          <span className="admin-model-label">2. 사진·영상</span>
          <strong>각 이벤트 안에 추가되는 미디어</strong>
          <p>포스터, 현장 사진, YouTube 영상은 이벤트 상세 페이지에 표시됩니다.</p>
        </div>
        <div className="admin-model-arrow" aria-hidden="true">→</div>
        <div className="admin-model-item">
          <span className="admin-model-label">3. 공개 Gallery</span>
          <strong>방문자가 보는 아카이브 화면</strong>
          <p>공개 상태인 이벤트만 연도와 카테고리 기준으로 노출됩니다.</p>
        </div>
      </section>

      <div className="admin-dashboard-grid">
        {cards.map((card) => (
          <Link href={card.href} className="admin-dashboard-card" key={card.label}>
            <span className="admin-dashboard-label">{card.label}</span>
            <strong className="admin-dashboard-value">{card.value}</strong>
            <span className="admin-dashboard-action">{card.action}</span>
          </Link>
        ))}
      </div>

      <div className="admin-dashboard-panels">
        <section className="admin-card">
          <h2 className="admin-panel-title">콘텐츠 관리 흐름</h2>
          <ol className="admin-checklist">
            <li>이벤트 카테고리를 먼저 정리합니다.</li>
            <li>새 이벤트를 만들고 비공개 상태로 기본 정보를 저장합니다.</li>
            <li>이벤트 상세에 표시될 사진과 YouTube 영상을 추가합니다.</li>
            <li>공개 상태로 전환한 뒤 실제 Gallery 화면에서 확인합니다.</li>
          </ol>
        </section>

        <section className="admin-card">
          <h2 className="admin-panel-title">빠른 이동</h2>
          <div className="admin-quick-links">
            <Link href="/admin/gallery" className="admin-btn admin-btn-outline">이벤트 아카이브</Link>
            <Link href="/admin/gallery/photos" className="admin-btn admin-btn-outline">사진 보관함</Link>
            <Link href="/admin/gallery/categories" className="admin-btn admin-btn-outline">이벤트 카테고리</Link>
            <Link href="/gallery" className="admin-btn admin-btn-outline">공개 Gallery</Link>
            <Link href="/classes" className="admin-btn admin-btn-outline">수업 페이지</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
