/**
 * 수업 상세 (원생·학부모용)
 *
 * '내 수업'·캘린더·아카이브의 수업 카드를 누르면 열리는 상세. 배정된 수업만 볼 수 있다
 * (학생=본인, 학부모=자녀, admin=전체). 수업 정보와 함께 '사진 올리기'(모달)를 제공하고,
 * 본인이 이 수업에 올린 사진의 검토 상태를 보여준다.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import {
  getProgramById,
  getEnrollmentsForUser,
  getEnrollmentsForUsers,
  getGalleryPhotos,
  getProgramSupplies,
  getProgramSupplySets,
} from '@/lib/d1';
import { getGuardianChildren } from '@/lib/members';
import SupplyList from '@/components/supplies/SupplyList';
import type { MemberRole } from '@/types/members';
import type { ProgramDetail } from '@/types/programs';
import { PROGRAM_TYPE_LABELS } from '@/types/programs';
import PhotoSubmitModal from '@/components/admin/library/PhotoSubmitModal';

export const metadata: Metadata = {
  title: '수업 상세 | KTDOC',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

function scheduleLine(p: ProgramDetail): string {
  if (p.program_type === 'camp') {
    if (p.start_date && p.end_date) return `${p.start_date} ~ ${p.end_date}`;
    return p.start_date || '';
  }
  const days = (p.weekdays || '').split(',').filter(Boolean);
  if (days.length > 0) {
    const label = days.map((d) => WEEKDAY_KO[Number(d)] ?? '').join('·');
    const time = p.class_start_time
      ? ` ${p.class_start_time}${p.class_end_time ? `~${p.class_end_time}` : ''}`
      : '';
    return `매주 ${label}${time}`;
  }
  return p.schedule_ko || '';
}

export default async function MyClassDetailPage({ params }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'my-classes');

  const { id } = await params;
  const programId = parseInt(id, 10);
  if (Number.isNaN(programId)) notFound();

  const role = (session?.user?.role ?? 'user') as MemberRole;
  const userId = session?.user?.id ?? '';

  const program = await getProgramById(programId);
  if (!program) notFound();

  // 배정 검증 — 본인(학생) 또는 자녀(학부모)에 배정된 수업만. admin은 통과.
  let allowed = role === 'admin';
  if (!allowed && userId) {
    let enrollments;
    if (role === 'parent') {
      const children = await getGuardianChildren(userId);
      enrollments = children.length > 0
        ? await getEnrollmentsForUsers(children.map((c) => c.studentId))
        : [];
    } else {
      enrollments = await getEnrollmentsForUser(userId);
    }
    allowed = enrollments.some((e) => e.program.id === programId);
  }
  if (!allowed) notFound();

  // 본인이 이 수업에 올린 사진(검토 상태 표시)
  const myPhotos = userId
    ? (await getGalleryPhotos({ programId, uploadedBy: userId, limit: 60, sort: 'recent' })).photos
    : [];

  const schedule = scheduleLine(program);
  const [programSupplies, programSupplySets] = await Promise.all([
    getProgramSupplies(programId),
    getProgramSupplySets(programId),
  ]);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin/my-classes">내 수업</Link>
            <span>/</span>
            <span>{program.title_ko}</span>
          </div>
          <h1 className="admin-title">{program.title_ko}</h1>
          <p className="admin-subtitle library-detail-sub">
            <span>{PROGRAM_TYPE_LABELS[program.program_type].ko}</span>
            {schedule && <span>{schedule}</span>}
          </p>
        </div>
      </div>

      <section className="event-logistics">
        {schedule && (
          <div className="event-logistics-item">
            <span className="event-logistics-label">일정</span>
            <span className="event-logistics-value">{schedule}</span>
          </div>
        )}
        {program.location_ko && (
          <div className="event-logistics-item">
            <span className="event-logistics-label">장소</span>
            <span className="event-logistics-value">{program.location_ko}</span>
          </div>
        )}
        {program.age_range && (
          <div className="event-logistics-item">
            <span className="event-logistics-label">대상</span>
            <span className="event-logistics-value">{program.age_range}</span>
          </div>
        )}
        {program.price_ko && (
          <div className="event-logistics-item">
            <span className="event-logistics-label">수강료</span>
            <span className="event-logistics-value">{program.price_ko}</span>
          </div>
        )}
      </section>

      <SupplyList supplies={programSupplies} sets={programSupplySets} />

      {program.description_ko && (
        <p className="library-detail-desc">{program.description_ko}</p>
      )}

      <section className="library-detail-section">
        <div className="myclass-detail-photohead">
          <h2 className="library-detail-section-title">내 사진</h2>
          <PhotoSubmitModal programId={programId} buttonLabel="이 수업에 사진 올리기" />
        </div>
        {myPhotos.length === 0 ? (
          <p className="admin-form-help">
            아직 올린 사진이 없습니다. 수업·연습 사진을 올리면 운영진 검토 후 공개됩니다.
          </p>
        ) : (
          <div className="myclass-photo-grid">
            {myPhotos.map((ph) => (
              <figure key={ph.id} className="myclass-photo">
                <Image
                  src={ph.image_url}
                  alt=""
                  width={140}
                  height={140}
                  className="myclass-photo-img"
                />
                <figcaption
                  className={`myclass-photo-status${ph.is_published ? ' is-pub' : ''}`}
                >
                  {ph.is_published ? '게시됨' : '검토 중'}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
