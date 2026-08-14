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
  searchParams: Promise<{ r?: string; a?: string; trial?: string }>;
}

export default async function FormDonePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { r, a, trial } = await searchParams;
  const form = await getFormBySlugAnyStatus(slug);

  const isTrial = trial === '1';
  const receipt = Number(r);
  const receiptNo = Number.isInteger(receipt) && receipt > 0 ? String(receipt).padStart(4, '0') : null;

  return (
    <main className="form-page">
      <div className="form-shell form-shell-done">
        {isTrial ? (
          <>
            <p className="form-done-mark form-done-mark-trial" aria-hidden="true">
              임시 게시 · NOT SAVED
            </p>
            <h1 className="form-title">여기까지 정상적으로 작성되었습니다</h1>
            <div className="done-account done-account-note">
              <h2>다만 저장되지는 않았습니다</h2>
              <p>
                이 신청서는 <strong>확인용으로 열어 둔 상태</strong>라 방금 작성하신 내용이
                남지 않습니다. 실제 접수는 정식으로 문을 연 뒤에 시작됩니다.
              </p>
              <p className="form-notice-alt">
                This form is open for review only — what you just filled in was not saved. Real
                registrations begin once the form is officially opened.
              </p>
            </div>
          </>
        ) : (
          <>
            <p className="form-done-mark" aria-hidden="true">
              접수 완료 · RECEIVED
            </p>
            <h1 className="form-title">신청서가 접수되었습니다</h1>
          </>
        )}

        {!isTrial && receiptNo && (
          <div className="form-receipt">
            <span className="form-receipt-label">접수번호 · Reference</span>
            <strong className="form-receipt-no">{receiptNo}</strong>
          </div>
        )}

        {!isTrial && (
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
        )}

        {!isTrial && a === 'created' && (
          <div className="done-account done-account-ok">
            <h2>회원가입도 함께 접수되었습니다</h2>
            <p>
              학원에서 확인한 뒤 승인되면 로그인하실 수 있습니다. 승인되면 알림으로 알려드립니다.
              로그인하시면 신청 내역과 수업 일정을 확인하실 수 있습니다.
            </p>
            <p className="form-notice-alt">
              Your account request was submitted too. You can sign in once the studio approves it.
            </p>
            <Link href="/login" className="form-notice-link">
              로그인 화면으로 / Sign in
            </Link>
          </div>
        )}

        {!isTrial && a === 'email_taken' && (
          <div className="done-account done-account-note">
            <h2>이미 가입된 이메일입니다</h2>
            <p>
              적어주신 이메일로 이미 계정이 있어 새로 만들지 않았습니다.
              <strong> 신청서는 정상적으로 접수되었습니다.</strong> 로그인하시면 신청 내역을
              확인하실 수 있고, 다음부터는 정보가 자동으로 채워집니다.
            </p>
            <p className="form-notice-alt">
              An account already exists for that email, so we didn&rsquo;t create a new one. Your
              registration was received — sign in to see it.
            </p>
            <Link href="/login" className="form-notice-link">
              로그인 화면으로 / Sign in
            </Link>
          </div>
        )}

        {!isTrial && a === 'failed' && (
          <div className="done-account done-account-note">
            <h2>회원가입은 완료되지 않았습니다</h2>
            <p>
              <strong>신청서는 정상적으로 접수되었습니다.</strong> 다만 회원 계정을 만드는 과정에서
              문제가 있었습니다. 회원가입 화면에서 다시 시도하시거나, 학원으로 문의해 주세요.
            </p>
            <p className="form-notice-alt">
              Your registration was received, but we couldn&rsquo;t create the account. Please try
              signing up again or contact the studio.
            </p>
            <Link href="/register" className="form-notice-link">
              회원가입 하러 가기 / Sign up
            </Link>
          </div>
        )}

        <Link href="/" className="form-notice-link">
          KTDOC 홈으로 / Home
        </Link>
      </div>
    </main>
  );
}
