'use client';

/**
 * RsvpView — 공연 모집(회람) 화면.
 * 공지(일시·모이는 시간·장소·안내) + 참여 명단 + 참여 응답 버튼.
 *
 * - guest: 공지만 보이고 로그인 CTA(callbackUrl로 복귀)
 * - pending: 승인 대기 안내
 * - active: 명단(카톡 명단처럼 번호 목록) + 본인/자녀별 참여·취소 토글
 *   (기존 체크인 API /api/library/checkins 재사용, 학부모는 forUserId 대행)
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';

export interface RsvpParticipant {
  userId: string;
  name: string;
  /** 내(또는 내 자녀) 응답 여부 — 명단에서 강조 */
  isMine: boolean;
}

export interface RsvpTarget {
  userId: string;
  name: string;
  joined?: boolean;
}

interface RsvpEventInfo {
  id: number;
  title_ko: string;
  title_en: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  call_time: string | null;
  location: string | null;
  location_address: string | null;
  location_url: string | null;
  description_ko: string | null;
  description_en: string | null;
  prep_notes: string | null;
  posterUrl: string | null;
}

interface RsvpViewProps {
  event: RsvpEventInfo;
  viewer: 'guest' | 'pending' | 'active';
  participants: RsvpParticipant[];
  targets: RsvpTarget[];
}

/** 'YYYY-MM-DD' → 로케일 날짜 문구(요일 포함). 파싱 실패 시 원문 그대로. */
function formatDate(dateStr: string, locale: string): string {
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return dateStr;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date);
}

export default function RsvpView({ event, viewer, participants, targets }: RsvpViewProps) {
  const router = useRouter();
  const { locale, messages } = useLanguage();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const title = locale === 'en' && event.title_en ? event.title_en : event.title_ko;
  const description =
    locale === 'en' && event.description_en ? event.description_en : event.description_ko;
  const timeRange = [event.start_time, event.end_time].filter(Boolean).join(' ~ ');
  const loginHref = `/login?callbackUrl=${encodeURIComponent(`/rsvp/${event.id}`)}`;

  /** 참여/취소 토글 — 성공 시 서버 재렌더로 명단 갱신 */
  const toggle = async (target: RsvpTarget) => {
    setBusyId(target.userId);
    setError('');
    try {
      const res = await fetch('/api/library/checkins', {
        method: target.joined ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, forUserId: target.userId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || messages['rsvp.error']);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : messages['rsvp.error']);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      {/* ── 회람 공지 ── */}
      <section className="rsvp-hero">
        <div className="container rsvp-hero-inner">
          <p className="rsvp-eyebrow">{messages['rsvp.eyebrow']}</p>
          <h1 className="rsvp-title">{title}</h1>

          <div className="rsvp-notice">
            {event.posterUrl && (
              // R2 원본 — 로컬 미리보기와 동일하게 일반 img로 렌더
              // eslint-disable-next-line @next/next/no-img-element
              <img src={event.posterUrl} alt={title} className="rsvp-poster" />
            )}

            <dl className="rsvp-facts">
              <div className="rsvp-fact">
                <dt>{messages['rsvp.when']}</dt>
                <dd>
                  {formatDate(event.event_date, locale)}
                  {timeRange && <span className="rsvp-fact-sub">{timeRange}</span>}
                </dd>
              </div>
              {event.call_time && (
                <div className="rsvp-fact rsvp-fact--accent">
                  <dt>{messages['rsvp.callTime']}</dt>
                  <dd>{event.call_time}</dd>
                </div>
              )}
              {event.location && (
                <div className="rsvp-fact">
                  <dt>{messages['rsvp.location']}</dt>
                  <dd>
                    {event.location}
                    {event.location_address && (
                      <span className="rsvp-fact-sub">{event.location_address}</span>
                    )}
                    {event.location_url && (
                      <a
                        href={event.location_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rsvp-map-link"
                      >
                        {messages['rsvp.mapLink']}
                      </a>
                    )}
                  </dd>
                </div>
              )}
              {event.prep_notes && (
                <div className="rsvp-fact">
                  <dt>{messages['rsvp.prep']}</dt>
                  <dd>{event.prep_notes}</dd>
                </div>
              )}
            </dl>

            {description && <p className="rsvp-desc">{description}</p>}
          </div>
        </div>
      </section>

      {/* ── 참여 명단 · 응답 ── */}
      <section className="rsvp-body">
        <div className="container rsvp-body-inner">
          {viewer === 'guest' && (
            <div className="rsvp-gate">
              <p className="rsvp-gate-note">{messages['rsvp.loginNote']}</p>
              <Link href={loginHref} className="auth-button rsvp-login-btn">
                {messages['rsvp.loginCta']}
              </Link>
            </div>
          )}

          {viewer === 'pending' && (
            <div className="rsvp-gate">
              <p className="rsvp-gate-note">{messages['rsvp.pendingNote']}</p>
            </div>
          )}

          {viewer === 'active' && (
            <>
              {/* 내 응답 */}
              <div className="rsvp-respond">
                <h2 className="rsvp-section-title">{messages['rsvp.myResponse']}</h2>
                {error && <p className="rsvp-error" role="alert">{error}</p>}
                {targets.length === 0 ? (
                  <p className="rsvp-gate-note">{messages['rsvp.noTargets']}</p>
                ) : (
                  <ul className="rsvp-targets">
                    {targets.map((t) => (
                      <li key={t.userId} className="rsvp-target">
                        <span className="rsvp-target-name">
                          {t.name}
                          {t.joined && (
                            <span className="rsvp-badge">{messages['rsvp.joined']}</span>
                          )}
                        </span>
                        <button
                          type="button"
                          className={`rsvp-toggle ${t.joined ? 'is-leave' : 'is-join'}`}
                          disabled={busyId !== null}
                          onClick={() => toggle(t)}
                        >
                          {busyId === t.userId
                            ? '…'
                            : t.joined
                              ? messages['rsvp.leave']
                              : messages['rsvp.join']}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 참여 명단 — 카톡 명단처럼 번호 목록 */}
              <div className="rsvp-roster">
                <h2 className="rsvp-section-title">
                  {messages['rsvp.participants']}
                  <span className="rsvp-roster-count">({participants.length})</span>
                </h2>
                {participants.length === 0 ? (
                  <p className="rsvp-gate-note">{messages['rsvp.empty']}</p>
                ) : (
                  <ol className="rsvp-roster-list">
                    {participants.map((p) => (
                      <li key={p.userId} className={p.isMine ? 'is-mine' : undefined}>
                        {p.name}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
