/**
 * Admin QnA Page
 * Q&A 열람 — 선생님이 미리 등록한 공통·이벤트별 질문/답변 (원생·학부모·선생님)
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getFaqItems } from '@/lib/d1';
import QnaBrowser from '@/components/admin/faq/QnaBrowser';

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
    </div>
  );
}
