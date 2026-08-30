/**
 * Admin 신청서 편집
 *
 * 운영 준비 상태 패널 + 5탭 편집기. 문안·과목·동의·추가 질문·공유를 한 자리에서 다룬다.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import T from '@/components/common/T';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { countDirty, getFormById, getPrograms } from '@/lib/d1';
import { warnSchema } from '@/lib/forms/schema';
import FormEditor from '@/components/admin/forms/FormEditor';
import type { FormSchema } from '@/types/forms';

export const metadata: Metadata = {
  title: '신청서 편집 | KTDOC Admin',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminFormEditPage({ params }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'forms');

  const { id } = await params;
  const formId = Number(id);
  if (!Number.isInteger(formId)) notFound();

  const form = await getFormById(formId);
  if (!form) notFound();

  const schema = JSON.parse(form.schema_json) as FormSchema;
  const [dirtyCount, programsResult] = await Promise.all([
    countDirty(formId),
    // 아직 공개하지 않은 수업에도 과목을 연결할 수 있어야 한다 — 공개 여부는 별개 축이다.
    getPrograms({ limit: 200, published: 'all' }),
  ]);

  const programs = programsResult.programs.map((p) => ({ id: p.id, title_ko: p.title_ko }));

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">
              <T k="admin.common.breadcrumbHome">관리 홈</T>
            </Link>
            <span>/</span>
            <Link href="/admin/forms">
              <T k="admin.nav.forms">신청서 관리</T>
            </Link>
          </div>
          <h1 className="admin-title">{form.title_ko}</h1>
          <p className="admin-subtitle">
            {form.season ? `${form.season} · ` : ''}
            {form.status === 'open'
              ? '접수 중입니다. 학부모님들이 작성할 수 있습니다.'
              : form.status === 'trial'
                ? '임시 게시 상태입니다. 링크를 아는 분은 열어 볼 수 있지만 제출해도 저장되지 않습니다.'
                : form.status === 'closed'
                  ? '마감되었습니다. 응답은 그대로 남아 있습니다.'
                  : '초안입니다. 아직 아무에게도 보이지 않습니다.'}
          </p>
        </div>
      </div>

      <FormEditor
        form={form}
        initialSchema={schema}
        warnings={warnSchema(schema)}
        dirtyCount={dirtyCount}
        programs={programs}
      />
    </div>
  );
}
