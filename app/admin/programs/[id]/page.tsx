/**
 * Admin Program Edit
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getProgramById, getProgramEnrollments, getActiveSupplyItems, getProgramSupplies } from '@/lib/d1';
import { getStudentOptions, getUserNamesByIds } from '@/lib/members';
import ProgramForm from '@/components/admin/programs/ProgramForm';
import EnrollmentManager from '@/components/admin/programs/EnrollmentManager';
import type { EnrollmentWithMember } from '@/types/programs';

export const metadata = {
  title: '프로그램 편집 | KTDOC Admin',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProgramPage({ params }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'programs');

  const { id } = await params;
  const programId = parseInt(id);
  if (isNaN(programId)) {
    notFound();
  }

  const program = await getProgramById(programId);
  if (!program) {
    notFound();
  }

  // 수강생(배정된 원생) + 회원 이름 결합. studentOptions는 추가 드롭다운·입학년도 표시용.
  const [enrollmentRows, studentOptions, activeSupplies, programSupplies] = await Promise.all([
    getProgramEnrollments(programId),
    getStudentOptions(),
    getActiveSupplyItems(),
    getProgramSupplies(programId),
  ]);
  const initialSupplies = programSupplies.map((s) => ({
    supply_item_id: s.supply_item_id,
    quantity: s.quantity ?? '',
    note_ko: s.note_ko ?? '',
    note_en: s.note_en ?? '',
    is_required: s.is_required === 1,
  }));
  const names = await getUserNamesByIds(enrollmentRows.map((e) => e.user_id));
  const yearById = new Map(studentOptions.map((s) => [s.id, s.enrollment_year]));
  const enrollments: EnrollmentWithMember[] = enrollmentRows.map((e) => ({
    ...e,
    member_name: names.get(e.user_id) ?? null,
    enrollment_year: yearById.get(e.user_id) ?? null,
  }));

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <Link href="/admin/programs">수업 · 프로그램 관리</Link>
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

      <ProgramForm
        program={program}
        activeSupplies={activeSupplies}
        initialSupplies={initialSupplies}
      />

      <div className="admin-form" style={{ marginTop: '24px' }}>
        <div className="admin-form-section">
          <h3 className="admin-form-section-title">수강생</h3>
          <p className="admin-form-help">
            이 수업·프로그램에 원생을 배정합니다. 배정된 원생은 본인의 &lsquo;내 수업&rsquo;에서
            확인할 수 있고, 학부모는 자녀의 수업으로 볼 수 있습니다.
          </p>
          <EnrollmentManager
            programId={program.id}
            initialEnrollments={enrollments}
            studentOptions={studentOptions}
          />
        </div>
      </div>
    </div>
  );
}
