/**
 * Admin 대리 입력 — 카톡·전화·종이로 온 신청을 운영진이 대신 넣는다
 *
 * 학기 초 업무의 절반이 이것이다. 공개 폼 렌더러를 그대로 재사용한다 —
 * 운영진이 학부모가 보는 것과 같은 화면을 봐야 문항을 헷갈리지 않는다.
 * 다르게 두는 것은 보낼 곳(관리 라우트)과 이메일을 비울 수 있다는 점뿐이다.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getFormById } from '@/lib/d1';
import FormRenderer from '@/components/forms/FormRenderer';
import type { FormSchema } from '@/types/forms';

export const metadata: Metadata = {
  title: '대신 입력 | KTDOC Admin',
};

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminStaffEntryPage({ params }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'forms');

  const { id } = await params;
  const formId = Number(id);
  if (!Number.isInteger(formId)) notFound();

  const form = await getFormById(formId);
  if (!form) notFound();

  const schema = JSON.parse(form.schema_json) as FormSchema;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin/forms">신청서 관리</Link>
            <span>/</span>
            <Link href={`/admin/forms/${formId}/responses`}>신청 응답</Link>
          </div>
          <h1 className="admin-title">대신 입력</h1>
          <p className="admin-subtitle">
            전화·카톡·종이로 받은 신청을 대신 넣습니다. 이메일을 못 받았으면 비워 두셔도 되고,
            대신 연락처를 꼭 적어 주세요. 마감된 신청서에도 넣을 수 있습니다.
          </p>
        </div>
      </div>

      <div className="admin-card staff-entry">
        <FormRenderer
          slug={form.slug}
          schema={schema}
          submitTo={`/api/admin/forms/${formId}/responses`}
          doneHref={(responseId) => `/admin/forms/${formId}/responses/${responseId}`}
          submitLabel="이 내용으로 접수하기"
        />
      </div>
    </div>
  );
}
