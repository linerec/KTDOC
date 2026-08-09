/**
 * Admin Program Edit
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getProgramById, getProgramEnrollments, getActiveSupplyItems, getProgramSupplies, getActiveSupplySets, getProgramSupplySets } from '@/lib/d1';
import { getEnrollableMembers, getUserNamesByIds } from '@/lib/members';
import { isStaff } from '@/lib/isAdmin';
import ProgramForm from '@/components/admin/programs/ProgramForm';
import EnrollmentManager from '@/components/admin/programs/EnrollmentManager';
import { getCommentThreads } from '@/lib/comments/thread';
import CommentSection from '@/components/comments/CommentSection';
import type { EnrollmentWithMember } from '@/types/programs';
import T from '@/components/common/T';
import LocaleText from '@/components/common/LocaleText';

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

  // 배정된 사람 + 회원 이름 결합. memberOptions는 추가 드롭다운·입학년도 표시용
  // (원생뿐 아니라 선생님도 수업에 들어간다 — getEnrollableMembers 참고).
  const [enrollmentRows, memberOptions, activeSupplies, programSupplies, activeSupplySets, programSupplySets, commentThreads] = await Promise.all([
    getProgramEnrollments(programId),
    getEnrollableMembers(),
    getActiveSupplyItems(),
    getProgramSupplies(programId),
    getActiveSupplySets(),
    getProgramSupplySets(programId),
    getCommentThreads('program', programId),
  ]);
  const initialSupplies = programSupplies.map((s) => ({
    supply_item_id: s.supply_item_id,
    quantity: s.quantity ?? '',
    note_ko: s.note_ko ?? '',
    note_en: s.note_en ?? '',
    is_required: s.is_required === 1,
  }));
  const initialSupplySets = programSupplySets.map((s) => ({
    supply_set_id: s.supply_set_id,
    quantity: s.quantity ?? '',
    note_ko: s.note_ko ?? '',
    note_en: s.note_en ?? '',
    is_required: s.is_required === 1,
  }));
  const names = await getUserNamesByIds(enrollmentRows.map((e) => e.user_id));
  const yearById = new Map(memberOptions.map((s) => [s.id, s.enrollment_year]));
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
            <Link href="/admin">
              <T k="admin.common.breadcrumbHome">관리 홈</T>
            </Link>
            <span>/</span>
            <Link href="/admin/programs">
              <T k="admin.nav.programs">수업 · 프로그램 관리</T>
            </Link>
            <span>/</span>
            <span>
              <LocaleText ko={program.title_ko} en={program.title_en} />
            </span>
          </div>
          <h1 className="admin-title">
            <T k="admin.programs.editTitle">프로그램 편집</T>
          </h1>
        </div>
        <div className="admin-header-actions">
          {program.is_published === 1 && (
            <Link
              href={`/classes/${program.slug}`}
              target="_blank"
              className="admin-btn admin-btn-outline"
            >
              <T k="admin.common.viewPublicPage">공개 페이지 보기</T>
            </Link>
          )}
        </div>
      </div>

      <ProgramForm
        program={program}
        activeSupplies={activeSupplies}
        initialSupplies={initialSupplies}
        activeSupplySets={activeSupplySets}
        initialSupplySets={initialSupplySets}
      />

      <div className="admin-form" style={{ marginTop: '24px' }}>
        <div className="admin-form-section">
          <h3 className="admin-form-section-title">
            <T k="admin.enroll.section">수강생</T>
          </h3>
          <p className="admin-form-help">
            <T k="admin.enroll.sectionHelp">
              이 수업·프로그램에 원생을 배정합니다. 배정된 원생은 본인의 ‘내 수업’에서 확인할 수
              있고, 학부모는 자녀의 수업으로 볼 수 있습니다.
            </T>
          </p>
          <EnrollmentManager
            programId={program.id}
            initialEnrollments={enrollments}
            memberOptions={memberOptions}
          />
        </div>
      </div>

      {session?.user?.id && (
        <CommentSection
          targetType="program"
          targetId={program.id}
          currentUserId={session.user.id}
          currentUserName={session.user.name || '선생님'}
          canAnnounce={isStaff(session)}
          threads={commentThreads}
        />
      )}
    </div>
  );
}
