/**
 * 공개 신청서 — /f/[slug]
 *
 * 링크·QR로 들어오는 자리다. 히어로 없이 문서처럼 세우고 --page-offset-tight 를 쓴다.
 *
 * 검색엔진에는 올리지 않되(robots noindex) 카톡 미리보기는 살린다 — 링크를 뿌리는
 * 것이 이 폼의 유일한 배포 경로이기 때문이다.
 *
 * 게시되지 않은 신청서라도 **운영진(forms 권한)에게는 미리 보기로 열어 준다.**
 * 게시 전에 실제 화면을 확인할 방법이 없으면, 확인하려고 게시하게 된다 —
 * 그런데 게시하는 순간 선택지 구조가 잠긴다.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { hasMenuAccess } from '@/lib/admin/permissions';
import { getFormBySlugAnyStatus } from '@/lib/d1';
import { allQuestions } from '@/lib/forms/schema';
import FormHead from '@/components/forms/FormHead';
import FormRenderer, { type FormPrefill } from '@/components/forms/FormRenderer';
import type { Answers, FormRow, FormSchema } from '@/types/forms';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const form = await getFormBySlugAnyStatus(slug);
  // 루트 레이아웃이 template '%s | KTDOC' 을 붙인다 — 여기서 또 붙이면 두 번 나온다.
  if (!form) return { title: '신청서', robots: { index: false, follow: false } };

  return {
    title: form.title_ko,
    description: form.description_ko?.split('\n')[0] ?? undefined,
    robots: { index: false, follow: false },
    openGraph: {
      title: form.title_ko,
      description: form.description_ko?.split('\n')[0] ?? undefined,
      type: 'website',
    },
  };
}

/** 세션에서 채울 수 있는 값을 문항의 bind 지시자에 맞춰 놓는다. */
function buildPrefill(
  schema: FormSchema,
  user: { name?: string | null; email?: string | null; role?: string | null } | undefined
): FormPrefill | undefined {
  if (!user) return undefined;

  const values: Answers = {};
  for (const q of allQuestions(schema)) {
    if (q.bind === 'email' && user.email) values[q.key] = user.email;
    // 학생 본인이 로그인했을 때만 이름을 학생 이름으로 채운다.
    // 학부모 계정이면 자녀 이름이 따로이므로 비워 두는 것이 맞다.
    if (q.bind === 'student_name' && user.role === 'student' && user.name) values[q.key] = user.name;
    if (q.bind === 'guardian_name' && user.role === 'parent' && user.name) values[q.key] = user.name;
  }

  if (Object.keys(values).length === 0) return undefined;
  return { values, memberName: user.name ?? null };
}

function ClosedNotice({ form }: { form: FormRow }) {
  const closed = form.status === 'closed' || form.status === 'archived';
  return (
    <main className="form-page">
      <div className="form-shell form-shell-notice">
        <h1 className="form-title">{form.title_ko}</h1>
        <p className="form-notice-body">
          {closed
            ? '접수가 마감되었습니다. 문의가 있으시면 학원으로 연락 주세요.'
            : '아직 접수가 시작되지 않았습니다. 잠시 후 다시 확인해 주세요.'}
        </p>
        <p className="form-notice-body form-notice-alt">
          {closed
            ? 'Registration is closed. Please contact the studio if you have questions.'
            : 'Registration has not opened yet. Please check back a little later.'}
        </p>
        <Link href="/" className="form-notice-link">
          KTDOC 홈으로 / Home
        </Link>
      </div>
    </main>
  );
}

export default async function PublicFormPage({ params }: PageProps) {
  const { slug } = await params;
  const form = await getFormBySlugAnyStatus(slug);

  if (!form) {
    return (
      <main className="form-page">
        <div className="form-shell form-shell-notice">
          <h1 className="form-title">신청서를 찾을 수 없습니다</h1>
          <p className="form-notice-body">
            주소가 바뀌었거나 삭제된 신청서입니다. 받으신 링크를 다시 확인해 주세요.
          </p>
          <p className="form-notice-body form-notice-alt">
            We couldn&rsquo;t find this form. The address may have changed — please check the link
            you received.
          </p>
          <Link href="/" className="form-notice-link">
            KTDOC 홈으로 / Home
          </Link>
        </div>
      </main>
    );
  }

  const session = await auth();
  const isOpen = form.status === 'open';
  const canPreview = !isOpen && (await hasMenuAccess(session, 'forms'));

  // 마감·초안은 무슨 일인지 알려 준다. 404 로 내치면 링크를 받은 사람이 영문을 모른다.
  if (!isOpen && !canPreview) return <ClosedNotice form={form} />;

  if (form.requires_login && !session?.user) {
    return (
      <main className="form-page">
        <div className="form-shell form-shell-notice">
          <h1 className="form-title">{form.title_ko}</h1>
          <p className="form-notice-body">이 신청서는 로그인 후 작성하실 수 있습니다.</p>
          <p className="form-notice-body form-notice-alt">
            Please sign in to fill out this form.
          </p>
          <Link href={`/login?callbackUrl=/f/${encodeURIComponent(slug)}`} className="form-notice-link">
            로그인하고 작성하기 / Sign in
          </Link>
        </div>
      </main>
    );
  }

  const schema = JSON.parse(form.schema_json) as FormSchema;
  const prefill = buildPrefill(schema, session?.user);

  return (
    <main className="form-page">
      <div className="form-shell">
        {canPreview && (
          <div className="form-preview-banner" role="status">
            <strong>미리 보기</strong> — 아직 게시되지 않은 신청서입니다. 여기서 제출해도 접수되지
            않습니다. 학부모님께는 보이지 않습니다.
          </div>
        )}

        <FormHead
          season={form.season}
          titleKo={form.title_ko}
          titleEn={form.title_en}
          descriptionKo={form.description_ko}
          descriptionEn={form.description_en}
        />

        <FormRenderer slug={form.slug} schema={schema} prefill={prefill} preview={canPreview} />
      </div>
    </main>
  );
}
