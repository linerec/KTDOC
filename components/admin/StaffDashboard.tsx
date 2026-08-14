'use client';

/**
 * StaffDashboard — 운영진(선생님·관리자)용 콘솔 홈(/admin 착지 화면)
 *
 * 집계 수치는 서버(app/admin/page.tsx)가 읽어 넘기고, 여기서는 화면만 그린다.
 * 원생·학부모용 StudentDashboard와 같은 자리를 나눠 쓰는 짝이다.
 *
 * 클라이언트 컴포넌트인 이유는 문구를 useT로 번역하기 때문이다 — SSR은 한국어로
 * 그려지고 하이드레이션 후 사용자 언어(localStorage['lang'])로 바뀐다.
 */

import Link from 'next/link';
import SiteViewLink from '@/components/common/SiteViewLink';
import PushOptInCard from '@/components/push/PushOptInCard';
import TodayEventBanner from '@/components/admin/TodayEventBanner';
import type { EventWithCategory } from '@/types/gallery';
import { useT } from '@/lib/i18n/useT';

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4.5" width="18" height="17" rx="2" />
      <path d="M16 2.5v4M8 2.5v4M3 9.5h18" />
    </svg>
  );
}
function IconInbox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 13h4l1.5 2.5h5L16 13h4" />
      <path d="M4 13 6 5.5A2 2 0 0 1 7.9 4h8.2A2 2 0 0 1 18 5.5L20 13v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    </svg>
  );
}
function IconGallery() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3.5" width="18" height="17" rx="2" />
      <circle cx="8.5" cy="9" r="1.6" />
      <path d="m21 16-5-5L5 20.5" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

/**
 * 인사말에서 이름만 굵게. 언어마다 이름이 오는 자리가 달라서
 * ("{name}님, 안녕하세요." vs "Hello, {name}.") 자리표시자를 기준으로 가른다.
 * t()에 params를 넘기지 않아야 여기까지 {name}이 남아 온다.
 */
function Greeting({ template, name }: { template: string; name: string }) {
  const [head, ...tail] = template.split('{name}');
  return (
    <>
      {head}
      <b>{name}</b>
      {tail.join('{name}')}
    </>
  );
}

export interface StaffDashboardProps {
  adminName: string;
  programsTotal: number;
  programsPublished: number;
  appsTotal: number;
  appsNew: number;
  /** 신청서(질문지)로 들어온 처리 대기 응답 수 */
  formResponsesNew: number;
  canSeeForms: boolean;
  eventsPublished: number;
  loosePhotos: number;
  categoryCount: number;
  membersTotal: number;
  /** 오늘 열리는 공개 행사. 없으면 빈 배열 — 배너가 스스로 사라진다. */
  todayEvents: EventWithCategory[];
  /**
   * 신청 현황·사진 보관함을 이 사람이 열 수 있는가(서버가 menu_key로 판정해 넘긴다).
   * 둘 다 사이드바에 없는 화면이라 여기 카드가 사실상의 진입점이다 — 갈 수 없는 곳으로
   * 부르지 않는다. 신청은 카드째 감춘다: 링크만 빼면 못 여는 집계만 남아 더 답답하다.
   */
  canSeeApplications: boolean;
  canSeePhotos: boolean;
}

export default function StaffDashboard({
  adminName,
  programsTotal,
  programsPublished,
  appsTotal,
  appsNew,
  formResponsesNew,
  canSeeForms,
  eventsPublished,
  loosePhotos,
  categoryCount,
  membersTotal,
  todayEvents,
  canSeeApplications,
  canSeePhotos,
}: StaffDashboardProps) {
  const t = useT();

  const isFreshSite = programsTotal === 0 && eventsPublished === 0 && appsTotal === 0;
  const hasNewApps = appsNew > 0 && canSeeApplications;
  const hasNewFormResponses = formResponsesNew > 0 && canSeeForms;

  return (
    <div className="admin-page admin-console">
      {/* 환영 헤더 */}
      <header className="admin-onboard-head">
        <div className="admin-onboard-headtop">
          <div>
            <p className="admin-kicker">KTDOC ADMIN</p>
            <h1 className="admin-onboard-greet">
              <Greeting
                template={
                  isFreshSite
                    ? t('admin.home.greetWelcome', '{name}님, 환영합니다.')
                    : t('admin.home.greetHello', '{name}님, 안녕하세요.')
                }
                name={adminName}
              />
            </h1>
            <p className="admin-onboard-lede">
              {isFreshSite
                ? t('admin.home.ledeFresh', '춤누리 홈페이지를 관리하는 공간입니다.')
                : t(
                    'admin.home.ledeStats',
                    '오늘의 현황 — 공개 수업 {programs} · 새 신청 {apps} · 공개 공연 {events}',
                    { programs: programsPublished, apps: appsNew, events: eventsPublished }
                  )}
            </p>
          </div>
          <SiteViewLink href="/" className="admin-btn admin-btn-outline" arrow>
            {t('admin.shell.viewSite', '사이트 보기')}
          </SiteViewLink>
        </div>
      </header>

      {/* 오늘 행사 — 처리할 일(아래 신청 알림)보다 먼저 온다. 오늘 어디서 몇 시에
          서는지는 '언젠가 할 일'이 아니라 지금 알아야 하는 사실이고, 홈 화면
          아이콘(PWA)으로 열면 이 화면이 첫 장면이기 때문이다. */}
      <TodayEventBanner events={todayEvents} />

      {/* 긴급: 새 신청 (페이지 내 유일한 빨강 강조) */}
      {hasNewApps && (
        <section className="admin-urgent-callout">
          <p>
            {t(
              'admin.home.urgent',
              '가장 먼저 처리할 일 — 새 신청 {n}건이 답변을 기다리고 있습니다',
              { n: appsNew }
            )}
          </p>
          <Link href="/admin/applications" className="admin-btn admin-btn-danger">
            {t('admin.home.viewApplicants', '신청자 보기')}
          </Link>
        </section>
      )}

      {/* 신청서(질문지)로 들어온 응답 — 옛 /classes 신청과 축이 다르므로 따로 세운다.
          한 줄에 합치면 어느 경로로 온 신청인지 알 수 없어 찾으러 두 곳을 뒤지게 된다. */}
      {hasNewFormResponses && (
        <section className="admin-callout admin-callout-urgent">
          <p>
            {t(
              'admin.home.urgentForms',
              '신청서로 새 신청 {n}건이 들어왔습니다',
              { n: formResponsesNew }
            )}
          </p>
          <Link href="/admin/forms" className="admin-btn admin-btn-danger">
            {t('admin.home.viewFormResponses', '신청서 보기')}
          </Link>
        </section>
      )}

      {/* 알림 받기 — 운영진도 받는 쪽이다. 새 가입 신청 알림(lib/push/system.ts)은
          이미 teacher·admin을 대상으로 발송되지만, 기기를 등록해 두지 않으면 도착할
          곳이 없어 알림함에만 쌓인다. 이 기기에서 켜고 나면 카드는 사라진다. */}
      <PushOptInCard placement="dashboard" audience="staff" />

      {/* 관리실 — 기존 기능 도메인 (항상 존재) */}
      <section className={`admin-workshop${isFreshSite ? ' admin-workshop--quiet' : ''}`}>
        <div className="admin-workshop-head">
          <h2>{t('admin.home.workshop', '관리실')}</h2>
        </div>
        {isFreshSite && (
          <p className="admin-workshop-quiet-line">
            {t(
              'admin.home.workshopQuiet',
              '익숙해지신 뒤에는 이곳에서 바로 관리하실 수 있습니다 — 프로그램 · 신청 · 회원 · 공연'
            )}
          </p>
        )}

        <div className="admin-domains">
          <section className="admin-domain admin-domain--accent">
            <div className="admin-domain-top">
              <span className="admin-domain-icon">
                <IconCalendar />
              </span>
              <span className="admin-domain-stat-inline">
                <strong>{programsTotal}</strong>
                <span>{t('admin.home.unitPrograms', '개 프로그램')}</span>
              </span>
            </div>
            <h2 className="admin-domain-title">
              {t('admin.home.programsTitle', '수업 · 프로그램 · 캠프')}
            </h2>
            <p className="admin-domain-desc">
              {t(
                'admin.home.programsDesc',
                '방문자에게 보여줄 수업과 여름 캠프를 등록하고, 공개 여부와 사진을 관리합니다.'
              )}
            </p>
            <div className="admin-domain-actions">
              <Link href="/admin/programs" className="admin-btn admin-btn-primary">
                {t('admin.home.programsManage', '프로그램 관리')}
              </Link>
              <Link href="/admin/programs/new" className="admin-btn admin-btn-outline">
                {t('admin.home.programsNew', '+ 새로 만들기')}
              </Link>
            </div>
          </section>

          {canSeeApplications && (
          <section className={`admin-domain${appsNew > 0 ? ' admin-domain--alert' : ''}`}>
            <div className="admin-domain-top">
              <span className="admin-domain-icon">
                <IconInbox />
              </span>
              {appsNew > 0 ? (
                <span className="admin-domain-flag">
                  {t('admin.home.appsNewFlag', '● 신규 {n}', { n: appsNew })}
                </span>
              ) : (
                <span className="admin-domain-stat-inline">
                  <strong>{appsTotal}</strong>
                  <span>{t('admin.home.unitApplications', '건')}</span>
                </span>
              )}
            </div>
            <h2 className="admin-domain-title">{t('admin.home.appsTitle', '신청 현황')}</h2>
            <p className="admin-domain-desc">
              {t(
                'admin.home.appsDesc',
                '수업·캠프 신청자를 확인하고, 이메일·전화로 바로 연락합니다.'
              )}
            </p>
            <p className="admin-domain-meta">
              {t('admin.home.appsMeta', '신규 {new} · 전체 {total}', {
                new: appsNew,
                total: appsTotal,
              })}
            </p>
            <div className="admin-domain-actions">
              <Link href="/admin/applications" className="admin-btn admin-btn-primary">
                {t('admin.home.viewApplicants', '신청자 보기')}
              </Link>
            </div>
          </section>
          )}

          <section className="admin-domain">
            <div className="admin-domain-top">
              <span className="admin-domain-icon">
                <IconUsers />
              </span>
              <span className="admin-domain-stat-inline">
                <strong>{membersTotal}</strong>
                <span>{t('admin.home.unitMembers', '명 회원')}</span>
              </span>
            </div>
            <h2 className="admin-domain-title">{t('admin.home.membersTitle', '회원 관리')}</h2>
            <p className="admin-domain-desc">
              {t(
                'admin.home.membersDesc',
                '사이트에 가입한 회원을 확인합니다. 이메일·가입일·권한을 한눈에 볼 수 있습니다.'
              )}
            </p>
            <div className="admin-domain-actions">
              <Link href="/admin/members" className="admin-btn admin-btn-primary">
                {t('admin.home.membersView', '회원 목록 보기')}
              </Link>
            </div>
          </section>

          <section className="admin-domain admin-domain--wide">
            <div className="admin-domain-top">
              <span className="admin-domain-icon">
                <IconGallery />
              </span>
              <div className="admin-domain-stats">
                <span className="admin-domain-stat">
                  <strong>{eventsPublished}</strong>
                  <span>{t('admin.home.statEventsPublished', '공개 공연')}</span>
                </span>
                <span className="admin-domain-stat">
                  <strong>{loosePhotos}</strong>
                  <span>{t('admin.home.statLoosePhotos', '미정리 사진')}</span>
                </span>
                <span className="admin-domain-stat">
                  <strong>{categoryCount}</strong>
                  <span>{t('admin.home.statCategories', '카테고리')}</span>
                </span>
              </div>
            </div>
            <h2 className="admin-domain-title">{t('admin.home.galleryTitle', '공연 관리')}</h2>
            <p className="admin-domain-desc">
              {t(
                'admin.home.galleryDesc',
                '공연·행사 기록과 현장 사진·영상을 관리하고, 대표 공연을 공연 페이지 쇼케이스에 노출합니다. 연도별 아카이브는 갤러리 페이지에 표시됩니다.'
              )}
            </p>
            <div className="admin-domain-actions">
              <Link href="/admin/gallery" className="admin-btn admin-btn-primary">
                {t('admin.home.galleryManage', '공연 관리')}
              </Link>
              <Link href="/admin/gallery/new" className="admin-btn admin-btn-outline">
                {t('admin.home.galleryNew', '+ 새 공연')}
              </Link>
              {canSeePhotos && (
                <Link href="/admin/gallery/photos" className="admin-btn admin-btn-outline">
                  {t('admin.nav.gallery.photos', '사진 보관함')}
                </Link>
              )}
            </div>
          </section>
        </div>
      </section>

      {/* 안내 풋노트 */}
      <div className="admin-guide-footnote">
        <span>
          {t(
            'admin.home.footnote',
            '로그인한 상태에서 홈페이지를 열고 상단의 ‘편집’을 켜면, 페이지의 글과 사진을 그 자리에서 직접 수정할 수 있습니다. 코드를 다룰 필요가 없습니다.'
          )}
        </span>
      </div>
    </div>
  );
}
