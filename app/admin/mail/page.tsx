/**
 * Admin 이메일 설정 — /admin/mail (admin 전용)
 *
 * 발송 방법(Resend·SMTP) · 발신 정보 · 어떤 일에 메일을 보낼지 · 보낸 내역.
 * 사이트 기능들은 lib/mail의 notifyEvent('이벤트키', …)로 여기 설정을 따른다.
 */

import Link from 'next/link';
import T from '@/components/common/T';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import MailSettingsManager from '@/components/admin/mail/MailSettingsManager';

export const metadata = {
  title: '이메일 설정 | KTDOC Admin',
};

export default async function AdminMailPage() {
  const session = await auth();
  await requireMenuAccess(session, 'settings.mail');

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
              <T k="admin.nav.settings.mail">이메일 설정</T>
            </span>
          </div>
          <h1 className="admin-title">
            <T k="admin.nav.settings.mail">이메일 설정</T>
          </h1>
          <p className="admin-subtitle">
            <T k="admin.mail.pageSubtitle">
              사이트에서 나가는 메일을 설정합니다. 어떤 방법으로 보낼지 정하고, 보내는 사람
              정보를 입력한 뒤, 어떤 일이 있을 때 누구에게 알릴지 골라 주세요.
            </T>
          </p>
        </div>
      </div>

      <MailSettingsManager />
    </div>
  );
}
