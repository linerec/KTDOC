/**
 * Admin QnA Page
 * Q&A 열람 — 선생님이 미리 등록한 공통·공연별 질문/답변 (원생·학부모·선생님)
 */

import Link from 'next/link';
import T from '@/components/common/T';
import { auth } from '@/auth';
import { hasMenuAccess, requireMenuAccess } from '@/lib/admin/permissions';
import { getFaqItems } from '@/lib/d1';
import QnaBrowser from '@/components/admin/faq/QnaBrowser';
import ContactChannels from '@/components/common/ContactChannels';

export const metadata = {
  title: 'Q&A | KTDOC Admin',
};

export default async function AdminQnaPage() {
  const session = await auth();
  await requireMenuAccess(session, 'qna');

  // 편집 화면은 사이드바에 세우지 않고 여기서만 연다(메뉴 하나로 통합).
  // 버튼 노출과 페이지 접근이 같은 판정(menu_key 'faq')을 쓰므로 어긋날 수 없다.
  const canManage = await hasMenuAccess(session, 'faq');

  const items = await getFaqItems({ published: true });

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">
              <T k="admin.common.breadcrumbHome">관리 홈</T>
            </Link>
            <span>/</span>
            <span>
              <T k="admin.nav.qna">Q&A</T>
            </span>
          </div>
          <h1 className="admin-title">
            <T k="admin.nav.qna">Q&A</T>
          </h1>
          <p className="admin-subtitle">
            <T k="admin.qna.subtitle">
              공연·행사 준비에 자주 나오는 질문을 미리 정리했습니다. 찾는 내용이 없으면 선생님께
              문의해 주세요.
            </T>
          </p>
        </div>
        {canManage && (
          <div className="admin-header-actions">
            <Link href="/admin/faq" className="admin-btn admin-btn-outline">
              <T k="admin.nav.faq">Q&A 관리</T>
            </Link>
          </div>
        )}
      </div>

      <QnaBrowser items={items} />

      {/* 문의 동선 — 정리된 답으로 해결되지 않으면 바로 사람에게 닿게 한다 */}
      <div className="qna-contact">
        <p className="qna-contact-title">
          <T k="admin.qna.contactTitle">찾는 답이 없나요?</T>
        </p>
        <p className="qna-contact-desc">
          <T k="admin.qna.contactDesc">
            전화나 카카오톡으로 문의해 주시면 선생님이 직접 안내해 드립니다.
          </T>
        </p>
        <ContactChannels />
      </div>
    </div>
  );
}
