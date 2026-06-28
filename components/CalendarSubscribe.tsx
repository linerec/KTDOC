'use client';

/**
 * 캘린더 구독 위젯 — 공개 .ics 피드를 애플/구글/아웃룩 캘린더에 추가하도록 안내.
 *
 * 한 번 구독하면 학원의 공연·행사·캠프가 등록/수정/삭제될 때마다 각 기기의 캘린더에
 * 자동으로 반영된다(앱별 새로고침 주기에 따름).
 *
 * 문구는 i18n(useLanguage)로 ko/en을 지원한다. 번역 키는 locale/*.json + D1 locale_content.
 */

import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface CalendarSubscribeProps {
  /** 절대 https 피드 URL (예: https://ktdoc.org/calendar.ics) */
  feedUrl: string;
}

export default function CalendarSubscribe({ feedUrl }: CalendarSubscribeProps) {
  const { messages } = useLanguage();
  const t = (key: string) => messages[key] ?? '';

  const [copied, setCopied] = useState(false);

  // webcal:// 링크는 애플/iOS/맥OS·아웃룩에서 기본 캘린더 앱으로 바로 구독 창을 연다.
  const webcalUrl = feedUrl.replace(/^https?:\/\//, 'webcal://');
  // 구글 캘린더 "URL로 추가" 흐름으로 연결.
  const googleUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(feedUrl)}`;

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(feedUrl);
      } else {
        const ta = document.createElement('textarea');
        ta.value = feedUrl;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const guides: { titleKey: string; bodyKey: string }[] = [
    { titleKey: 'pages.calendar.sub.guide.appleIos.title', bodyKey: 'pages.calendar.sub.guide.appleIos.body' },
    { titleKey: 'pages.calendar.sub.guide.mac.title', bodyKey: 'pages.calendar.sub.guide.mac.body' },
    { titleKey: 'pages.calendar.sub.guide.google.title', bodyKey: 'pages.calendar.sub.guide.google.body' },
    { titleKey: 'pages.calendar.sub.guide.outlook.title', bodyKey: 'pages.calendar.sub.guide.outlook.body' },
  ];

  return (
    <div className="cal-sub">
      <div className="cal-sub-actions">
        <a className="cal-sub-btn cal-sub-btn--primary" href={webcalUrl}>
          <span dangerouslySetInnerHTML={{ __html: t('pages.calendar.sub.addDevice') }} />
          <span className="cal-sub-btn-note">{t('pages.calendar.sub.addDeviceNote')}</span>
        </a>
        <a className="cal-sub-btn" href={googleUrl} target="_blank" rel="noopener noreferrer">
          <span dangerouslySetInnerHTML={{ __html: t('pages.calendar.sub.addGoogle') }} />
          <span className="cal-sub-btn-note">{t('pages.calendar.sub.addGoogleNote')}</span>
        </a>
      </div>

      <div className="cal-sub-url">
        <code className="cal-sub-url-text">{feedUrl}</code>
        <button type="button" className="cal-sub-copy" onClick={handleCopy}>
          {copied ? t('pages.calendar.sub.copied') : t('pages.calendar.sub.copy')}
        </button>
      </div>

      <div className="cal-sub-guides">
        {guides.map((g) => (
          <details className="cal-sub-guide" key={g.titleKey}>
            <summary>{t(g.titleKey)}</summary>
            <ol dangerouslySetInnerHTML={{ __html: t(g.bodyKey) }} />
          </details>
        ))}
      </div>

      <p className="cal-sub-hint" dangerouslySetInnerHTML={{ __html: t('pages.calendar.sub.hint') }} />
    </div>
  );
}
