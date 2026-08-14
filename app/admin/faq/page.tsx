/**
 * Admin FAQ Page
 * Q&A 관리 — 공통·공연별 질문/답변 등록 (관리자·선생님)
 */

import Link from 'next/link';
import T from '@/components/common/T';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getFaqItems, getEvents, adminAllEvents} from '@/lib/d1';
import FaqManager from '@/components/admin/faq/FaqManager';
import type { FaqEventOption } from '@/components/admin/faq/FaqManager';

export const metadata = {
  title: 'Q&A 관리 | KTDOC Admin',
};

export default async function AdminFaqPage() {
  const session = await auth();
  await requireMenuAccess(session, 'faq');

  const [items, eventsResult] = await Promise.all([
    getFaqItems({ published: 'all' }),
    getEvents(adminAllEvents({ limit: 500 })),
  ]);

  // 연결 선택지는 최소 메타만 클라이언트로 전달
  const eventOptions: FaqEventOption[] = eventsResult.events.map((e) => ({
    id: e.id,
    title_ko: e.title_ko,
    year: e.year,
  }));

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          {/* 사이드바에 이 화면의 메뉴는 없다 — 돌아갈 곳(Q&A)을 빵부스러기가 대신 짚어 준다. */}
          <div className="admin-breadcrumb">
            <Link href="/admin">
              <T k="admin.common.breadcrumbHome">관리 홈</T>
            </Link>
            <span>/</span>
            <Link href="/admin/qna">
              <T k="admin.nav.qna">Q&A</T>
            </Link>
            <span>/</span>
            <span>
              <T k="admin.nav.faq">Q&A 관리</T>
            </span>
          </div>
          <h1 className="admin-title">
            <T k="admin.nav.faq">Q&A 관리</T>
          </h1>
          <p className="admin-subtitle">
            <T k="admin.faq.subtitle">
              공연·행사에 대해 자주 묻는 질문과 답변을 미리 등록합니다. 공개된 항목은 원생·학부모가
              ‘Q&A’ 메뉴에서 확인할 수 있습니다.
            </T>
          </p>
        </div>
        {/* '회원 화면 미리 보기' 버튼은 두지 않는다 — 빵부스러기의 Q&A가 곧 그 화면이다. */}
      </div>

      <FaqManager items={items} events={eventOptions} />
    </div>
  );
}
