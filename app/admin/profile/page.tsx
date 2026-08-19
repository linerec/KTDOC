/**
 * Admin Profile
 * 내 프로필 — 자신의 기본 정보(이름) 변경, 비밀번호 변경, 이 기기의 알림 설정
 */

import Link from 'next/link';
import T from '@/components/common/T';
import { auth } from '@/auth';
import { isAdmin, isStaff } from '@/lib/isAdmin';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getMemberById, type MemberRole } from '@/lib/members';
import ProfileForm from '@/components/admin/profile/ProfileForm';
import ChildrenCard from '@/components/admin/profile/ChildrenCard';
import ChangePasswordCard from '@/components/admin/ChangePasswordCard';
import PushOptInCard from '@/components/push/PushOptInCard';
import EmailOptInCard from '@/components/admin/mail/EmailOptInCard';

export const metadata = {
  title: '내 프로필 | KTDOC Admin',
};

export default async function AdminProfilePage() {
  const session = await auth();
  await requireMenuAccess(session, 'profile');

  // DB를 단일 출처로 사용 (세션 토큰보다 최신). 실패 시 세션 값으로 폴백.
  const member = await getMemberById(session!.user!.id!).catch(() => null);

  const name = member?.name || session!.user?.name || '';
  const email = member?.email || session!.user?.email || '';
  const role: MemberRole = member?.role || (isAdmin(session) ? 'admin' : 'user');
  const joinedAt = member?.created_at || null;

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
              <T k="admin.nav.profile">내 프로필</T>
            </span>
          </div>
          <h1 className="admin-title">
            <T k="admin.nav.profile">내 프로필</T>
          </h1>
          <p className="admin-subtitle">
            <T k="admin.profile.pageSubtitle">
              내 계정 정보를 확인하고, 이름·비밀번호와 이 기기의 알림 설정을 변경합니다.
            </T>
          </p>
        </div>
      </div>

      <div className="admin-profile-grid">
        <ProfileForm
          initialName={name}
          email={email}
          role={role}
          joinedAt={joinedAt}
          initialConsent={member?.public_archive_consent ?? false}
          initialPhotoUrl={member?.profile_photo_url ?? null}
        />
        <ChangePasswordCard />
      </div>

      {/* 학부모: 자녀 연결 관리 — 가입 때 못 적은 둘째·셋째를 여기서 잇는다(형제자매 지원).
          신청은 '확인 대기'로 만들어지고 운영진이 회원 관리에서 확정한다. */}
      {role === 'parent' && (
        <div className="admin-profile-grid">
          <ChildrenCard initialChildren={member?.children ?? []} />
        </div>
      )}

      {/* 알림 설정 — 대시보드 카드는 켜고 나면 사라지므로 끄기·테스트는 여기가 집이다.
          구독은 기기(브라우저)마다 따로이므로 지금 보고 있는 기기의 상태를 보여준다.
          이메일은 기기와 무관한 계정 단위 설정이라 바로 옆에 나란히 둔다 —
          "알림을 어떻게 받을지"가 한자리에 모여야 무엇을 껐는지 헷갈리지 않는다. */}
      <div className="admin-profile-push">
        <PushOptInCard
          placement="settings"
          audience={isStaff(session) ? 'staff' : 'member'}
        />
        <EmailOptInCard />
      </div>
    </div>
  );
}
