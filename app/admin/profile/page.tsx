/**
 * Admin Profile
 * 내 프로필 — 자신의 기본 정보(이름) 변경 및 비밀번호 변경
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/isAdmin';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getMemberById, type MemberRole } from '@/lib/members';
import ProfileForm from '@/components/admin/profile/ProfileForm';
import ChangePasswordCard from '@/components/admin/ChangePasswordCard';

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
            <Link href="/admin">관리 홈</Link>
            <span>/</span>
            <span>내 프로필</span>
          </div>
          <h1 className="admin-title">내 프로필</h1>
          <p className="admin-subtitle">
            내 계정 정보를 확인하고, 이름과 비밀번호를 변경합니다.
          </p>
        </div>
      </div>

      <div className="admin-profile-grid">
        <ProfileForm initialName={name} email={email} role={role} joinedAt={joinedAt} />
        <ChangePasswordCard />
      </div>
    </div>
  );
}
