/**
 * 제출 완료 — /f/[slug]/done?r={접수번호}
 *
 * **이 화면이 영수증이다.** 메일 발송은 아직 믿을 수 없는 상태라(앱 비밀번호 만료 이력),
 * 제출한 사람이 붙잡을 수 있는 유일한 증거가 화면의 접수번호다. 그래서 크게 세운다.
 *
 * r 파라미터는 접수번호를 표시하는 데만 쓴다. 응답 내용은 어떤 경로로도 보여주지 않으므로
 * 남의 번호를 넣어도 얻을 것이 없다 — 소유 확인을 위한 토큰을 따로 두지 않는 이유다.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getFormBySlugAnyStatus } from '@/lib/d1';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  // 루트 레이아웃이 template '%s | KTDOC' 을 붙인다.
  title: '신청서 접수 완료',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ r?: string }>;
}

export default async function FormDonePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { r } = await searchParams;
  const form = await getFormBySlugAnyStatus(slug);

  const receipt = Number(r);
  const receiptNo = Number.isInteger(receipt) && receipt > 0 ? String(receipt).padStart(4, '0') : null;

  return (
    <main className="form-page">
      <div className="form-shell form-shell-done">
        <p className="form-done-mark" aria-hidden="true">
          접수 완료 · RECEIVED
        </p>
        <h1 className="form-title">신청서가 접수되었습니다</h1>

        {receiptNo && (
          <div className="form-receipt">
            <span className="form-receipt-label">접수번호 · Reference</span>
            <strong className="form-receipt-no">{receiptNo}</strong>
          </div>
        )}

        <div className="form-done-body">
          <p>
            {form?.title_ko ?? '신청서'}를 잘 받았습니다.
            내용을 확인한 뒤 <strong>최종 등록금과 결제 방법을 개별적으로 안내</strong>드리겠습니다.
          </p>
          <p>
            문의가 있으시면 접수번호와 함께 학원으로 연락 주세요.
            이 화면을 캡처해 두시면 편합니다.
          </p>
          <p className="form-notice-alt">
            Your registration has been received. We will review it and contact you individually with
            the final tuition and payment details. If you have questions, please contact the studio
            with your reference number above — a screenshot of this page is handy.
          </p>
        </div>

        <Link href="/" className="form-notice-link">
          KTDOC 홈으로 / Home
        </Link>
      </div>
    </main>
  );
}
