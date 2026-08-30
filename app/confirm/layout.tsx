import type { Metadata } from 'next';

/**
 * 확인 요청 문서 — 링크를 받은 분만 보는 한 장짜리 화면
 *
 * 사이트 헤더·푸터를 붙이지 않는다. 메뉴를 타고 들어오는 자리가 아니라
 * 문자로 받은 주소 하나로 열어 보고 답하는 자리다. (auth) 그룹과 같은 방식.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function ConfirmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="cb-shell">{children}</div>;
}
