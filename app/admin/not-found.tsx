/**
 * 관리 콘솔 404 (Not Found)
 *
 * app/admin/layout.tsx(AdminShell) 안에서 렌더되므로 사이드바 네비게이션이 함께 보인다.
 * 셸이 이미 배경을 가지므로 전역 404와 달리 차분한 카드 톤(.admin-notfound)을 쓴다.
 * 역할별 진입점은 레이아웃이 권한에 맞게 보정하므로 '/admin' 링크는 누구에게나 안전하다.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import T from '@/components/common/T';

export const metadata: Metadata = {
  title: '페이지를 찾을 수 없습니다 | KTDOC Admin',
  robots: { index: false, follow: false },
};

export default function AdminNotFound() {
  return (
    <div className="admin-page">
      <div className="admin-notfound">
        <p className="admin-notfound-code">404</p>
        <h1 className="admin-notfound-title">
          <T k="admin.notFound.title">찾을 수 없는 페이지입니다</T>
        </h1>
        <p className="admin-notfound-text">
          <T k="admin.notFound.text">
            요청하신 화면이 없거나 주소가 바뀌었습니다. 왼쪽 메뉴에서 원하는 항목을 선택하시거나,
            아래 버튼으로 처음으로 돌아갈 수 있습니다.
          </T>
        </p>
        <div className="admin-notfound-actions">
          <Link href="/admin" className="admin-btn admin-btn-primary">
            <T k="admin.notFound.home">처음으로</T>
          </Link>
          <Link href="/" className="admin-btn admin-btn-outline">
            <T k="admin.shell.viewSite">사이트 보기</T> ↗
          </Link>
        </div>
      </div>
    </div>
  );
}
