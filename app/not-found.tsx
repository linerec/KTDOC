/**
 * 전역 404 (Not Found)
 *
 * 루트 레이아웃 안에서 렌더되므로 글로벌 잉크 앰비언트 레이어(z-index:0) 위에 올라온다.
 * 자체 비네트(.notfound::before)로 가독성을 확보해, 먹 배경에 묻히던 Next 기본 404를 대체한다.
 * 순수 서버 컴포넌트(Link만 사용) — 클라이언트 자바스크립트가 필요 없다.
 */

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '페이지를 찾을 수 없습니다',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="notfound">
      <div className="notfound-inner">
        <p className="notfound-eyebrow">KTDOC</p>
        <p className="notfound-code">
          <b>4</b>0<b>4</b>
        </p>
        <span className="dancheong-divider" aria-hidden="true" />
        <h1 className="notfound-title">길이 보이지 않습니다</h1>
        <p className="notfound-text">
          찾으시는 페이지가 사라졌거나 주소가 바뀌었습니다.
          <br />
          아래에서 다시 길을 찾아 주세요.
        </p>
        <div className="notfound-actions">
          <Link href="/" className="btn-ink-primary">
            홈으로 돌아가기
          </Link>
          <Link href="/performances" className="btn-ink-ghost">
            공연 둘러보기
          </Link>
        </div>
      </div>
    </main>
  );
}
