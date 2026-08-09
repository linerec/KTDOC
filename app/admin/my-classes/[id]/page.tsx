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
import { isAdmin } from '@/lib/isAdmin';
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
import { isStaff } from '@/lib/isAdmin';
import SupplyList from '@/components/supplies/SupplyList';
import { getCommentThreads } from '@/lib/comments/thread';
import CommentSection from '@/components/comments/CommentSection';
import type { MemberRole } from '@/types/members';
import { PROGRAM_TYPE_LABELS } from '@/types/programs';
import { formatClassSchedule } from '@/lib/programText';
import PhotoSubmitModal from '@/components/admin/library/PhotoSubmitModal';
import T from '@/components/common/T';
import LocaleText from '@/components/common/LocaleText';

export const metadata: Metadata = {
  title: '수업 상세 | KTDOC',
};

interface PageProps {
  params: Promise<{ id: string }>;
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

  // 배정 검증 — 본인(학생) 또는 자녀(학부모)에 배정된 수업만. 관리 권한자는 통과.
  let allowed = isAdmin(session);
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

  // 일정 문구는 두 언어를 모두 지어 <LocaleText>에 넘긴다 — 이 페이지를 서버 컴포넌트로 둔 채
  // 언어 전환에 따라가게 하는 방법이다.
  const scheduleKo = formatClassSchedule(program, 'ko');
  const scheduleEn = formatClassSchedule(program, 'en');
  const [programSupplies, programSupplySets, commentThreads] = await Promise.all([
    getProgramSupplies(programId),
    getProgramSupplySets(programId),
    getCommentThreads('program', programId),
  ]);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin/my-classes">
              <T k="admin.nav.my-classes">내 수업</T>
            </Link>
            <span>/</span>
            <span>
              <LocaleText ko={program.title_ko} en={program.title_en} />
            </span>
          </div>
          <h1 className="admin-title">
            <LocaleText ko={program.title_ko} en={program.title_en} />
          </h1>
          <p className="admin-subtitle library-detail-sub">
            <span>
              <T k={`admin.program.type.${program.program_type}`}>
                {PROGRAM_TYPE_LABELS[program.program_type].ko}
              </T>
            </span>
            {scheduleKo && (
              <span>
                <LocaleText ko={scheduleKo} en={scheduleEn} />
              </span>
            )}
          </p>
        </div>
      </div>

      <section className="event-logistics">
        {scheduleKo && (
          <div className="event-logistics-item">
            <span className="event-logistics-label">
              <T k="admin.programs.colSchedule">일정</T>
            </span>
            <span className="event-logistics-value">
              <LocaleText ko={scheduleKo} en={scheduleEn} />
            </span>
          </div>
        )}
        {program.location_ko && (
          <div className="event-logistics-item">
            <span className="event-logistics-label">
              <T k="admin.common.location">장소</T>
            </span>
            <span className="event-logistics-value">
              <LocaleText ko={program.location_ko} en={program.location_en} />
            </span>
          </div>
        )}
        {program.age_range && (
          <div className="event-logistics-item">
            <span className="event-logistics-label">
              <T k="admin.myClasses.target">대상</T>
            </span>
            <span className="event-logistics-value">{program.age_range}</span>
          </div>
        )}
        {program.price_ko && (
          <div className="event-logistics-item">
            <span className="event-logistics-label">
              <T k="admin.myClasses.price">수강료</T>
            </span>
            <span className="event-logistics-value">
              <LocaleText ko={program.price_ko} en={program.price_en} />
            </span>
          </div>
        )}
      </section>

      <SupplyList supplies={programSupplies} sets={programSupplySets} />

      {program.description_ko && (
        <p className="library-detail-desc">
          <LocaleText ko={program.description_ko} en={program.description_en} />
        </p>
      )}

      <section className="library-detail-section">
        <div className="myclass-detail-photohead">
          <h2 className="library-detail-section-title">
            <T k="admin.myClasses.myPhotos">내 사진</T>
          </h2>
          <PhotoSubmitModal
            programId={programId}
            buttonLabelKey="admin.myClasses.submitPhoto"
            buttonLabel="이 수업에 사진 올리기"
          />
        </div>
        {myPhotos.length === 0 ? (
          <p className="admin-form-help">
            <T k="admin.myClasses.noPhotos">
              아직 올린 사진이 없습니다. 수업·연습 사진을 올리면 운영진 검토 후 공개됩니다.
            </T>
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
                  {ph.is_published ? (
                    <T k="admin.common.posted">게시됨</T>
                  ) : (
                    <T k="admin.common.underReview">검토 중</T>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>

      {userId && (
        <CommentSection
          targetType="program"
          targetId={programId}
          currentUserId={userId}
          currentUserName={session?.user?.name || '회원'}
          canAnnounce={isStaff(session)}
          threads={commentThreads}
        />
      )}
    </div>
  );
}
