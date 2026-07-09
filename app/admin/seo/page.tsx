/**
 * Admin SEO — SEO · 사이트 정보(NAP) 관리
 * 상호·주소·전화·운영시간을 한 곳에서 입력하면 푸터의 연락처 블록과
 * <head>의 LocalBusiness 구조화 데이터(JSON-LD)에 동시에 반영된다.
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getSetting } from '@/lib/d1';
import { SETTING_SEO_BUSINESS, parseSeoBusiness } from '@/lib/seoBusiness';
import SeoBusinessManager from '@/components/admin/seo/SeoBusinessManager';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'SEO · 사이트 정보 | KTDOC Admin',
};

export default async function AdminSeoPage() {
  const session = await auth();
  await requireMenuAccess(session, 'settings.seo');

  const raw = await getSetting(SETTING_SEO_BUSINESS).catch(() => null);
  const info = parseSeoBusiness(raw);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">홈</Link>
            <span>/</span>
            <span>SEO · 사이트 정보</span>
          </div>
          <h1 className="admin-title">SEO · 사이트 정보</h1>
          <p className="admin-subtitle">
            학원의 상호·주소·전화(NAP)·운영시간을 입력하면 모든 페이지 푸터와
            검색엔진용 구조화 데이터(LocalBusiness)에 자동으로 반영됩니다.
            구글 비즈니스 프로필과 글자 단위로 동일하게 입력하는 것이 지역 검색 순위의 핵심입니다.
          </p>
        </div>
      </div>

      <SeoBusinessManager initialInfo={info} />
    </div>
  );
}
