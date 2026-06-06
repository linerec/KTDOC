/**
 * Admin Program Edit
 */

import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { getProgramById } from '@/lib/d1';
import ProgramForm from '@/components/admin/programs/ProgramForm';

export const metadata = {
  title: '프로그램 편집 | KTDOC Admin',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProgramPage({ params }: PageProps) {
  const session = await auth();
  if (!isAdmin(session)) {
    redirect('/login');
  }

  const { id } = await params;
  const programId = parseInt(id);
  if (isNaN(programId)) {
    notFound();
  }

  const program = await getProgramById(programId);
  if (!program) {
    notFound();
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <Link href="/admin/programs">수업 및 프로그램</Link>
            <span>/</span>
            <span>{program.title_ko}</span>
          </div>
          <h1 className="admin-title">프로그램 편집</h1>
        </div>
        <div className="admin-header-actions">
          {program.is_published === 1 && (
            <Link
              href={`/classes/${program.slug}`}
              target="_blank"
              className="admin-btn admin-btn-outline"
            >
              공개 페이지 보기
            </Link>
          )}
        </div>
      </div>

      <ProgramForm program={program} />
    </div>
  );
}
