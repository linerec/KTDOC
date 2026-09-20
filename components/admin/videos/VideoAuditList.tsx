'use client';

/**
 * VideoAuditList — 점검 결과를 보여 주고, 고치는 곳으로 바로 보낸다
 *
 * 고장난 영상은 유튜브에서만 고칠 수 있다. 그래서 이 화면이 할 수 있는 최선은
 * **"어느 영상이 왜 안 되는지"와 "그 영상의 설정 화면"을 한 번에 주는 것**이다.
 * '스튜디오를 열고 영상을 찾아서…'로 시작하는 안내는 거기서 끊긴다.
 *
 * 고친 뒤에는 [다시 점검]으로 그 자리에서 확인할 수 있다 — 고쳤는지 아닌지를
 * 공개 페이지를 열어 눈으로 확인하게 두지 않는다.
 */

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n/useT';
import type { AuditedVideo, VideoSource } from '@/lib/youtube/audit';
import { youtubeStudioEditUrl } from '@/lib/youtube/audit';

interface Props {
  problems: AuditedVideo[];
  healthy: AuditedVideo[];
  checked: boolean;
}

export default function VideoAuditList({ problems, healthy, checked }: Props) {
  const t = useT();
  const router = useRouter();
  const [rechecking, setRechecking] = useState(false);
  const [showHealthy, setShowHealthy] = useState(false);

  const sourceLabel = (s: VideoSource) =>
    s === 'event'
      ? t('admin.videoAudit.srcEvent', '공연 · 행사')
      : s === 'news'
        ? t('admin.videoAudit.srcNews', '뉴스 · 미디어')
        : t('admin.videoAudit.srcSong', '말모이 노래');

  const recheck = () => {
    setRechecking(true);
    router.refresh();
    // 서버 컴포넌트가 다시 그려질 때까지 버튼을 잠가 둔다(두 번 누르면 헷갈린다)
    setTimeout(() => setRechecking(false), 2500);
  };

  return (
    <div className="va">
      <div className="va-bar">
        <button
          type="button"
          className="admin-btn admin-btn-outline admin-btn-sm"
          onClick={recheck}
          disabled={rechecking}
        >
          {rechecking
            ? t('admin.videoAudit.rechecking', '다시 확인하는 중…')
            : t('admin.videoAudit.recheck', '다시 점검')}
        </button>
      </div>

      {!checked && (
        <div className="admin-alert admin-alert-error admin-alert-sm" role="alert">
          {t(
            'admin.videoAudit.cannotCheck',
            '지금은 유튜브에 확인할 수 없습니다. 잠시 뒤 [다시 점검]을 눌러 주세요.'
          )}
        </div>
      )}

      {checked && problems.length === 0 && (
        <div className="admin-alert admin-alert-success admin-alert-sm" role="status">
          {t('admin.videoAudit.allOk', '모든 영상이 정상으로 재생됩니다.')}
        </div>
      )}

      {problems.length > 0 && (
        <ul className="va-list">
          {problems.map((v, i) => (
            <li key={`${v.videoId}-${v.adminHref}-${i}`} className="va-item">
              <div className="va-thumb">
                <Image src={v.thumbnail} alt="" width={120} height={68} unoptimized />
              </div>

              <div className="va-body">
                <p className="va-title">{v.title}</p>
                <p className="va-meta">
                  <span className={`va-state${v.isLive ? ' is-live' : ''}`}>
                    {v.isLive
                      ? t('admin.videoAudit.live', '공개 중 — 방문자에게 보입니다')
                      : t('admin.videoAudit.draft', '비공개 — 아직 방문자에겐 안 보입니다')}
                  </span>
                  <span className="va-sep">·</span>
                  <span>{sourceLabel(v.source)}</span>
                  <span className="va-sep">·</span>
                  <Link href={v.adminHref} className="va-link">
                    {v.sourceTitle}
                  </Link>
                </p>

                <p className="va-why">
                  {v.problem === 'notEmbeddable'
                    ? t(
                        'admin.videoAudit.whyEmbed',
                        '유튜브에서 ‘퍼가기 허용’이 꺼져 있습니다. 링크는 멀쩡하지만 우리 사이트 안에서는 재생되지 않습니다.'
                      )
                    : t(
                        'admin.videoAudit.whyMissing',
                        '유튜브에서 이 영상을 찾을 수 없습니다. 지워졌거나 비공개(일부 공개 포함)로 바뀐 것 같습니다.'
                      )}
                </p>

                {v.problem === 'notEmbeddable' ? (
                  <div className="va-fix">
                    <p className="va-fix-head">
                      {t('admin.videoAudit.fixHead', '고치는 법 — 유튜브에서 한 번만 켜면 됩니다')}
                    </p>
                    <ol className="va-fix-steps">
                      <li>{t('admin.videoAudit.fix1', '아래 버튼을 누르면 그 영상의 설정 화면이 열립니다')}</li>
                      <li>{t('admin.videoAudit.fix2', '아래로 내려 ‘자세히 보기’(모든 설정 표시)를 누릅니다')}</li>
                      <li>{t('admin.videoAudit.fix3', '‘퍼가기 허용’에 체크하고 저장합니다')}</li>
                      <li>{t('admin.videoAudit.fix4', '여기로 돌아와 [다시 점검]을 누릅니다')}</li>
                    </ol>
                  </div>
                ) : (
                  <div className="va-fix">
                    <p className="va-fix-head">{t('admin.videoAudit.fixHeadMissing', '고치는 법')}</p>
                    <ol className="va-fix-steps">
                      <li>{t('admin.videoAudit.fixM1', '유튜브에서 영상을 되살릴 수 있으면 공개로 바꿉니다')}</li>
                      <li>
                        {t(
                          'admin.videoAudit.fixM2',
                          '되살릴 수 없으면 위의 이름을 눌러 그 화면에서 영상을 지우거나 다른 링크로 바꿉니다'
                        )}
                      </li>
                    </ol>
                  </div>
                )}

                <div className="va-actions">
                  {v.problem === 'notEmbeddable' && (
                    <a
                      className="admin-btn admin-btn-primary admin-btn-sm"
                      href={youtubeStudioEditUrl(v.videoId)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t('admin.videoAudit.openStudio', '유튜브에서 이 영상 설정 열기')}
                    </a>
                  )}
                  <Link href={v.adminHref} className="admin-btn admin-btn-outline admin-btn-sm">
                    {t('admin.videoAudit.openAdmin', '이 영상이 걸린 화면 열기')}
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {healthy.length > 0 && (
        <div className="va-healthy">
          <button
            type="button"
            className="va-healthy-toggle"
            onClick={() => setShowHealthy((v) => !v)}
            aria-expanded={showHealthy}
          >
            {t('admin.videoAudit.healthyCount', '정상인 영상 {n}건', { n: healthy.length })}
            {showHealthy ? ' ▾' : ' ▸'}
          </button>
          {showHealthy && (
            <ul className="va-healthy-list">
              {healthy.map((v, i) => (
                <li key={`${v.videoId}-${i}`}>
                  <Link href={v.adminHref}>{v.title}</Link>
                  <span className="va-sep">·</span>
                  <span className="va-dim">{sourceLabel(v.source)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
