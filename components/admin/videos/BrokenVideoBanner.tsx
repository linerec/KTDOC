/**
 * BrokenVideoBanner — 재생 안 되는 영상이 있을 때만 뜨는 띠
 *
 * '영상 점검' 화면은 사이드바에 없다. 평소엔 볼 필요가 없는 화면이고, **봐야 할 때는
 * 시스템이 먼저 말해야** 하기 때문이다. 사람이 기억해서 들어가 확인하는 종류의
 * 고장이 아니다 — 관리 화면에서는 아무 티가 나지 않고 방문자 화면에서만 막힌다.
 *
 * 그래서 영상을 다루는 목록 화면(공연·행사 관리, 뉴스·미디어 관리) 맨 위에 이 띠를 둔다.
 * 문제가 없으면 아무것도 그리지 않는다.
 *
 * 서버 컴포넌트다 — 목록을 그리는 김에 유튜브에 한 번 묻는다(Data API 1회).
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { hasMenuAccess } from '@/lib/admin/permissions';
import { auditYouTubeVideos } from '@/lib/youtube/audit';
import T from '@/components/common/T';

export default async function BrokenVideoBanner() {
  const session = await auth();
  // 점검 화면에 못 가는 사람에게 문제만 알려 주면 막다른 골목이다.
  if (!(await hasMenuAccess(session, 'gallery.videos'))) return null;

  let audit;
  try {
    audit = await auditYouTubeVideos();
  } catch {
    // 점검은 있으면 좋은 것이다 — 실패해도 목록 화면은 그대로 열려야 한다.
    return null;
  }
  if (audit.problems.length === 0) return null;

  const live = audit.liveProblems.length;
  const total = audit.problems.length;

  return (
    <div className={`vb${live > 0 ? ' is-live' : ''}`} role="alert">
      <div className="vb-text">
        <strong className="vb-head">
          {live > 0 ? (
            <T k="admin.videoAudit.bannerLive" params={{ n: total, live }}>
              {'재생되지 않는 영상 {n}건 — 그중 {live}건은 지금 방문자에게 보입니다'}
            </T>
          ) : (
            <T k="admin.videoAudit.banner" params={{ n: total }}>
              {'재생되지 않는 영상 {n}건'}
            </T>
          )}
        </strong>
        <span className="vb-sub">
          <T k="admin.videoAudit.bannerSub">
            유튜브에서 ‘퍼가기 허용’이 꺼졌거나 영상이 지워졌습니다. 링크는 멀쩡해 보여도
            사이트 안에서는 오류만 나옵니다.
          </T>
        </span>
      </div>
      <Link href="/admin/videos" className="admin-btn admin-btn-primary admin-btn-sm">
        <T k="admin.videoAudit.bannerCta">확인하고 고치기</T>
      </Link>
    </div>
  );
}
