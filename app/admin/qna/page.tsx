/**
 * Admin QnA Page
 * Q&A 열람 — 선생님이 미리 등록한 공통·이벤트별 질문/답변 (원생·학부모·선생님)
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getFaqItems } from '@/lib/d1';
import QnaBrowser from '@/components/admin/faq/QnaBrowser';
import ContactChannels from '@/components/common/ContactChannels';

export const metadata = {
  title: 'Q&A | KTDOC Admin',
};

export default async function AdminQnaPage() {
  const session = await auth();
  await requireMenuAccess(session, 'qna');

  const items = await getFaqItems({ published: true });

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <span>Q&A</span>
          </div>
          <h1 className="admin-title">Q&A</h1>
          <p className="admin-subtitle">
            공연·행사 준비에 자주 나오는 질문을 미리 정리했습니다. 찾는 내용이 없으면
            선생님께 문의해 주세요.
          </p>
        </div>
      </div>

      <QnaBrowser items={items} />

      {/* 문의 동선 — 정리된 답으로 해결되지 않으면 바로 사람에게 닿게 한다 */}
      <div className="qna-contact">
        <p className="qna-contact-title">찾는 답이 없나요?</p>
        <p className="qna-contact-desc">
          전화나 카카오톡으로 문의해 주시면 선생님이 직접 안내해 드립니다.
        </p>
        <ContactChannels />
      </div>
    </div>
  );
}
