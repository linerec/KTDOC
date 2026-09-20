/**
 * /admin/videos — 영상 점검
 *
 * 유튜브 영상은 우리가 손대지 않아도 고장난다. '퍼가기 허용'을 끄거나 영상을 지우면
 * 관리 화면에서는 아무 티가 나지 않고 **방문자 화면에서만** 재생이 막힌다.
 * 사람이 기억해서 확인할 수 있는 종류의 고장이 아니다 — 그래서 한 화면에 모았다.
 *
 * 들어오는 길은 사이드바가 아니라 공연·뉴스 목록 화면의 경고 띠다(문제가 있을 때만
 * 뜬다). 평소에 볼 필요가 없는 화면이고, 봐야 할 때는 시스템이 먼저 말한다.
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { auditYouTubeVideos } from '@/lib/youtube/audit';
import VideoAuditList from '@/components/admin/videos/VideoAuditList';
import T from '@/components/common/T';

export const metadata = {
  title: '영상 점검 | KTDOC Admin',
};

// 유튜브에 매번 새로 물어야 한다 — 고쳤는지 확인하려고 들어오는 화면이다.
export const dynamic = 'force-dynamic';

export default async function AdminVideoAuditPage() {
  const session = await auth();
  await requireMenuAccess(session, 'gallery.videos');

  const audit = await auditYouTubeVideos();
  const healthy = audit.items.filter((i) => !i.problem);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">
              <T k="admin.common.breadcrumbHome">관리 홈</T>
            </Link>
            <span>/</span>
            <Link href="/admin/gallery">
              <T k="admin.nav.gallery">공연 · 행사 관리</T>
            </Link>
            <span>/</span>
            <span>
              <T k="admin.nav.gallery.videos">영상 점검</T>
            </span>
          </div>
          <h1 className="admin-title">
            <T k="admin.nav.gallery.videos">영상 점검</T>
          </h1>
          <p className="admin-subtitle">
            <T k="admin.videoAudit.subtitle">
              사이트에 걸어 둔 유튜브 영상이 지금도 재생되는지 확인합니다. 유튜브에서 ‘퍼가기
              허용’이 꺼지거나 영상이 지워지면 관리 화면에는 아무 표시가 나지 않고 방문자
              화면에서만 재생이 막힙니다 — 그래서 여기서 한 번에 봅니다.
            </T>
          </p>
        </div>
      </div>

      {audit.liveProblems.length > 0 && (
        <div className="admin-alert admin-alert-error" role="alert">
          <T k="admin.videoAudit.liveWarn">
            지금 공개 중인 영상 가운데 재생되지 않는 것이 있습니다. 방문자에게 오류 화면이
            보이고 있습니다.
          </T>
        </div>
      )}

      <VideoAuditList
        problems={audit.problems}
        healthy={healthy}
        checked={audit.checked}
      />
    </div>
  );
}
