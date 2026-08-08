'use client';

/**
 * ShareQrCard — "이 페이지를 QR로 보여주고 공유한다"
 *
 * 수업 상세에서 처음 쓰지만 페이지에 매이지 않는다. 기본값은 지금 보고 있는
 * 주소라서 어느 페이지에 놓든 그 페이지의 QR이 나오고, path를 주면 다른 곳을
 * 가리키게도 할 수 있다(예: 공연 관리에서 /rsvp/12의 QR을 뽑아 인쇄).
 *
 *   <ShareQrCard title={program.title_ko} />
 *   <ShareQrCard title="가을 공연 회람" path={`/rsvp/${id}`} />
 *
 * 되는 길을 찾아가는 분기(공유 시트 유무, 클립보드 이미지 거부, 사파리의
 * 제스처 규칙)는 전부 lib/share/qrShare.ts에 있고 시험으로 잠겨 있다.
 * 이 파일은 그리기와 안내 문구만 맡는다.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/useT';
import {
  browserCopyQrDeps,
  browserShareDeps,
  copyQrImage,
  qrDownloadFileName,
  shareLink,
  toShareUrl,
  type ShareOutcome,
} from '@/lib/share/qrShare';

interface ShareQrCardProps {
  /** 공유 시트 제목과 내려받기 파일 이름에 쓰인다. */
  title?: string;
  /** 가리킬 주소. 생략하면 지금 보고 있는 페이지. */
  path?: string;
  /** QR 아래 안내. 생략하면 "휴대폰으로 스캔하세요". */
  hint?: string;
  /** QR 한 변(css px). 사이드바 기본은 190. */
  size?: number;
  className?: string;
}

/** 무슨 일이 일어났는지 → 사용자에게 보여 줄 문구. */
const OUTCOME_MESSAGE: Record<ShareOutcome, { key: string; ko: string } | null> = {
  shared: null, // 공유 시트가 떴으면 화면이 이미 말해 준다
  cancelled: null, // 사용자가 닫았다 — 아무 말도 하지 않는다
  'link-copied': { key: 'share.linkCopied', ko: '링크를 복사했습니다.' },
  'qr-copied': { key: 'share.qrCopied', ko: 'QR코드를 복사했습니다.' },
  'qr-downloaded': { key: 'share.qrDownloaded', ko: 'QR코드를 이미지로 저장했습니다.' },
  failed: { key: 'share.failed', ko: '복사하지 못했습니다' },
};

export default function ShareQrCard({
  title,
  path,
  hint,
  size = 190,
  className,
}: ShareQrCardProps) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [drawn, setDrawn] = useState(false);
  const [status, setStatus] = useState<string>('');

  // 주소는 브라우저만 안다(서버 렌더 시점에는 알 수 없다).
  useEffect(() => {
    setUrl(toShareUrl(path ?? window.location.href, window.location.origin));
  }, [path]);

  // QR은 필요할 때만 불러 온다 — 첫 화면 번들에 얹지 않는다.
  useEffect(() => {
    if (!url) return;
    let alive = true;
    (async () => {
      try {
        const { default: QRCode } = await import('qrcode');
        const canvas = canvasRef.current;
        if (!alive || !canvas) return;
        await QRCode.toCanvas(canvas, url, {
          // 화면 크기의 두 배로 그려 둔다 — 고해상도 화면에서 선명하고,
          // 복사·저장된 그림도 인쇄에 쓸 만하다.
          width: size * 2,
          margin: 2,
          // QR은 스캐너가 읽는 그림이라 테마를 따르지 않는다(CSS 쪽 주석 참고).
          color: { dark: '#000000', light: '#ffffff' },
        });
        // qrcode는 canvas.style.width/height에 그린 픽셀 크기를 직접 박아 넣는다.
        // 인라인 스타일이라 클래스보다 세므로, 여기서 보일 크기로 되돌린다.
        // (되돌리지 않으면 QR이 두 배 크기로 나와 카드를 뚫고 나간다)
        canvas.style.width = `${size}px`;
        canvas.style.height = `${size}px`;
        if (alive) setDrawn(true);
      } catch {
        if (alive) setDrawn(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [url, size]);

  // 결과 문구는 안내 문구("휴대폰으로 스캔하세요") 자리를 잠시 빌려 쓴다.
  // 따로 줄을 두면 평소에 빈 줄이 남아 카드 아래가 허전해진다.
  const statusTimer = useRef<number | null>(null);
  const announce = useCallback(
    (outcome: ShareOutcome) => {
      if (statusTimer.current) window.clearTimeout(statusTimer.current);
      const message = OUTCOME_MESSAGE[outcome];
      if (!message) {
        setStatus('');
        return;
      }
      setStatus(t(message.key, message.ko));
      statusTimer.current = window.setTimeout(() => setStatus(''), 4000);
    },
    [t]
  );

  useEffect(
    () => () => {
      if (statusTimer.current) window.clearTimeout(statusTimer.current);
    },
    []
  );

  const handleShare = useCallback(async () => {
    if (!url) return;
    announce(await shareLink(url, title, browserShareDeps()));
  }, [url, title, announce]);

  const handleCopyQr = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !drawn) return;
    const outcome = await copyQrImage(
      () => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png')),
      qrDownloadFileName(title),
      browserCopyQrDeps()
    );
    announce(outcome);
  }, [drawn, title, announce]);

  const scanHint = hint ?? t('share.qrHint', '휴대폰으로 스캔하세요');

  return (
    <div className={className ? `share-qr-card ${className}` : 'share-qr-card'}>
      <div className="share-qr-frame" style={{ width: size, height: size }}>
        <canvas
          ref={canvasRef}
          className="share-qr-canvas"
          role="img"
          aria-label={t('share.qrAlt', '이 페이지로 이동하는 QR코드')}
        />
      </div>
      {/* 안내와 결과가 한 자리를 나눠 쓴다. 화면을 보지 않는 사람에게도
          결과가 전해져야 하므로 이 줄이 aria-live를 맡는다. */}
      <p className={status ? 'share-qr-hint is-status' : 'share-qr-hint'} aria-live="polite">
        {status || scanHint}
      </p>

      <div className="share-qr-actions">
        <button type="button" className="share-qr-btn" onClick={handleShare} disabled={!url}>
          {t('share.shareCta', '공유하기')}
        </button>
        <button
          type="button"
          className="share-qr-btn"
          onClick={handleCopyQr}
          disabled={!drawn}
        >
          {t('share.copyQrCta', 'QR 복사')}
        </button>
      </div>
    </div>
  );
}
