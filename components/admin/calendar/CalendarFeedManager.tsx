'use client';

/**
 * CalendarFeedManager — 캘린더 구독 피드 관리(운영진).
 * 좌: 구독 주소 공유 / 우: 피드 설정(이름·설명·타임존·포함범위·활성화). 저장은 /api/admin/settings.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CalendarConfig } from '@/lib/calendar';

const SETTING_KEY = 'calendar.config';

const TIMEZONES: [string, string][] = [
  ['America/New_York', '미국 동부 · New York'],
  ['America/Chicago', '미국 중부 · Chicago'],
  ['America/Denver', '미국 산악 · Denver'],
  ['America/Los_Angeles', '미국 서부 · Los Angeles'],
  ['America/Toronto', '캐나다 동부 · Toronto'],
  ['Asia/Seoul', '대한민국 · Seoul'],
];

export default function CalendarFeedManager({
  initialConfig,
  feedUrl,
  eventCount,
  campCount,
}: {
  initialConfig: CalendarConfig;
  feedUrl: string;
  eventCount: number;
  campCount: number;
}) {
  const router = useRouter();

  const [name, setName] = useState(initialConfig.name);
  const [description, setDescription] = useState(initialConfig.description);
  const [timezone, setTimezone] = useState(initialConfig.timezone);
  const [enabled, setEnabled] = useState(initialConfig.enabled);
  const [includeEvents, setIncludeEvents] = useState(initialConfig.includeEvents);
  const [includeCamps, setIncludeCamps] = useState(initialConfig.includeCamps);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);

  // 저장된 타임존이 목록에 없으면 옵션에 추가해 보존한다.
  const tzOptions = useMemo<[string, string][]>(() => {
    if (TIMEZONES.some(([v]) => v === timezone)) return TIMEZONES;
    return [[timezone, timezone], ...TIMEZONES];
  }, [timezone]);

  const webcalUrl = feedUrl.replace(/^https?:\/\//, 'webcal://');
  const googleUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(feedUrl)}`;

  const includedCount =
    (includeEvents ? eventCount : 0) + (includeCamps ? campCount : 0);

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

  async function handleSave() {
    setError('');
    setResult('');
    if (!name.trim()) {
      setError('캘린더 이름을 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      const value = JSON.stringify({
        name: name.trim(),
        description: description.trim(),
        timezone,
        enabled,
        includeEvents,
        includeCamps,
      });
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: SETTING_KEY, value }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || '저장에 실패했습니다.');
        return;
      }
      setResult('저장했습니다. 구독자에게는 각 캘린더 앱의 새로고침 주기에 맞춰 반영됩니다.');
      router.refresh();
    } catch {
      setError('서버 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-cal-grid">
      {/* 구독 주소 공유 */}
      <section className="admin-form-section admin-account-card">
        <h2 className="admin-form-section-title">구독 주소</h2>
        <p className="admin-form-help">
          아래 주소를 원생·선생님에게 공유하세요. 한 번 구독하면 일정 변경이 자동 반영됩니다.
        </p>

        <div className={`admin-cal-status${enabled ? ' is-on' : ' is-off'}`}>
          <span className="admin-cal-status-dot" aria-hidden="true" />
          {enabled ? (
            <span>
              피드 활성화됨 · 현재 <strong>{includedCount}건</strong>의 공개 일정
              {' '}(공연·행사 {includeEvents ? eventCount : 0} · 캠프 {includeCamps ? campCount : 0})
            </span>
          ) : (
            <span>피드가 비활성화되어 있습니다. 설정에서 켜면 구독자에게 일정이 보입니다.</span>
          )}
        </div>

        <div className="admin-cal-url">
          <code className="admin-cal-url-text">{feedUrl}</code>
          <button type="button" className="admin-btn admin-btn-outline admin-btn-sm" onClick={handleCopy}>
            {copied ? '복사됨 ✓' : '주소 복사'}
          </button>
        </div>

        <div className="admin-cal-share-actions">
          <a className="admin-btn admin-btn-outline admin-btn-sm" href={webcalUrl}>
            기기 캘린더에 추가
          </a>
          <a
            className="admin-btn admin-btn-outline admin-btn-sm"
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            구글 캘린더에 추가
          </a>
          <a className="admin-btn admin-btn-outline admin-btn-sm" href="/calendar" target="_blank" rel="noopener noreferrer">
            공개 안내 페이지
          </a>
          <a className="admin-btn admin-btn-outline admin-btn-sm" href="/calendar.ics" target="_blank" rel="noopener noreferrer">
            피드 원본(.ics)
          </a>
        </div>
      </section>

      {/* 피드 설정 */}
      <section className="admin-form-section admin-account-card">
        <h2 className="admin-form-section-title">피드 설정</h2>

        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="cal-name">
            캘린더 이름 <span className="required">*</span>
          </label>
          <input
            id="cal-name"
            type="text"
            className="admin-form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="예: 춤누리 일정"
            disabled={saving}
          />
          <p className="admin-form-help">구독한 캘린더 앱에 표시되는 이름입니다.</p>
        </div>

        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="cal-desc">설명</label>
          <textarea
            id="cal-desc"
            className="admin-form-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="예: 춤누리 한국전통무용학원 공연·행사·캠프 일정"
            disabled={saving}
          />
        </div>

        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="cal-tz">타임존</label>
          <select
            id="cal-tz"
            className="admin-form-input"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            disabled={saving}
          >
            {tzOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <p className="admin-form-help">이벤트 시작·종료 시각을 해석하는 기준입니다(학원 소재지 기준).</p>
        </div>

        <div className="admin-form-group">
          <span className="admin-form-label">포함할 일정</span>
          <label className="admin-cal-check">
            <input
              type="checkbox"
              checked={includeEvents}
              onChange={(e) => setIncludeEvents(e.target.checked)}
              disabled={saving}
            />
            <span>공연 · 행사 ({eventCount}건)</span>
          </label>
          <label className="admin-cal-check">
            <input
              type="checkbox"
              checked={includeCamps}
              onChange={(e) => setIncludeCamps(e.target.checked)}
              disabled={saving}
            />
            <span>캠프 ({campCount}건)</span>
          </label>
        </div>

        <div className="admin-form-group">
          <span className="admin-form-label">피드 활성화</span>
          <label className="admin-cal-check">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={saving}
            />
            <span>구독자에게 공개(끄면 빈 캘린더가 제공됩니다)</span>
          </label>
        </div>

        {error && (
          <p className="admin-account-feedback admin-account-feedback--error" role="alert">{error}</p>
        )}
        {result && (
          <p className="admin-account-feedback admin-account-feedback--success" role="status">{result}</p>
        )}

        <div className="admin-domain-actions">
          <button type="button" className="admin-btn admin-btn-gold" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중…' : '설정 저장'}
          </button>
        </div>
      </section>
    </div>
  );
}
