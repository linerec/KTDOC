import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getCategories, getEvents, getGalleryPhotos, getPrograms, getApplicationCounts } from '@/lib/d1';
import { getMemberCounts } from '@/lib/members';

export const metadata: Metadata = {
  title: '관리 홈 | KTDOC Admin',
};

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
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

type StepState = 'done' | 'todo' | 'attention';
interface GuideStep {
  n: number;
  label: string;
  title: string;
  desc: string;
  state: StepState;
  status: string;
  tip?: string;
  ctaHref: string;
  ctaLabel: string;
}

export default async function AdminDashboardPage() {
  const session = await auth();
  await requireMenuAccess(session, 'home');

  const [
    programsAll,
    programsPub,
    programsFeat,
    appCounts,
    eventsPub,
    eventsShow,
    loosePhotos,
    categories,
    memberCounts,
  ] = await Promise.all([
    getPrograms({ published: 'all', limit: 1 }),
    getPrograms({ published: true, limit: 1 }),
    getPrograms({ published: true, featured: true, limit: 1 }),
    getApplicationCounts(),
    getEvents({ published: true, limit: 1 }),
    getEvents({ published: true, showcase: true, limit: 1 }),
    getGalleryPhotos({ published: undefined, organized: 'unassigned', limit: 1 }),
    getCategories(),
    // 회원 수는 MySQL에서 조회 — 장애 시에도 대시보드가 깨지지 않도록 폴백.
    getMemberCounts().catch(() => ({ total: 0, admins: 0, users: 0, verified: 0 })),
  ]);

  const programsTotal = programsAll.total;
  const programsPublished = programsPub.total;
  const programsFeatured = programsFeat.total;
  const appsTotal = appCounts.total;
  const appsNew = appCounts.new;
  const eventsPublished = eventsPub.total;
  const eventsShowcase = eventsShow.total;
  const loose = loosePhotos.total;
  const categoryCount = categories.length;
  const membersTotal = memberCounts.total;

  const adminName = session?.user?.name || session?.user?.email?.split('@')[0] || '관리자';
  const isFreshSite = programsTotal === 0 && eventsPublished === 0 && appsTotal === 0;
  const hasNewApps = appsNew > 0;

  const steps: GuideStep[] = [
    {
      n: 1,
      label: '수업 등록',
      title: '수업과 캠프를 등록합니다',
      desc: '방문자가 가장 먼저 확인하는 것은 어떤 수업을 운영하는지입니다. 정규 수업과 기간이 정해진 단기 캠프를 등록해 주세요. 내용을 입력하고 사진을 올리면 됩니다.',
      state: programsTotal > 0 ? 'done' : 'todo',
      status:
        programsTotal > 0
          ? `수업·프로그램 ${programsTotal}개 등록됨`
          : '아직 등록된 수업이 없습니다.',
      tip:
        programsFeatured === 0
          ? "캠프 하나를 '대표로 강조'하면 수업 페이지 상단에 크게 소개됩니다."
          : undefined,
      ctaHref: '/admin/programs/new',
      ctaLabel: '+ 첫 수업 등록',
    },
    {
      n: 2,
      label: '공개',
      title: '수업을 공개합니다',
      desc: "등록한 수업은 아직 관리자에게만 보입니다. '공개'로 바꾸면 비로소 수업 페이지에 표시되고 신청을 받을 수 있습니다.",
      state: programsPublished > 0 ? 'done' : 'todo',
      status:
        programsPublished > 0
          ? `공개된 수업 ${programsPublished}개`
          : programsTotal > 0
          ? `작성 중 ${programsTotal}개 · 공개 0개 (공개로 바꿔야 표시됩니다)`
          : '먼저 수업을 등록해 주세요.',
      ctaHref: '/admin/programs',
      ctaLabel: '프로그램 관리 →',
    },
    {
      n: 3,
      label: '신청',
      title: '신청을 받고 응대합니다',
      desc: '수업이 공개되면 방문자가 신청서를 보냅니다. 새 신청은 이 화면에 자동으로 모입니다. 이메일이나 전화로 연락한 뒤, 상태를 신규 → 연락함 → 확정 순으로 바꿔 주세요.',
      state: appsNew > 0 ? 'attention' : appsTotal > 0 ? 'done' : 'todo',
      status:
        appsNew > 0
          ? `새 신청 ${appsNew}건이 답변을 기다리고 있습니다`
          : appsTotal > 0
          ? `전체 신청 ${appsTotal}건 · 새 신청 없음`
          : '수업을 공개하면 이곳으로 신청이 들어옵니다.',
      ctaHref: '/admin/applications',
      ctaLabel: '신청자 보기',
    },
    {
      n: 4,
      label: '공연 기록',
      title: '공연을 기록합니다',
      desc: "지난 공연을 사진·유튜브 영상과 함께 등록합니다. '공개'한 공연은 갤러리에 연도별로 정리되어 쌓입니다. 무용단을 대표하는 무대 기록입니다.",
      state: eventsPublished > 0 ? 'done' : 'todo',
      status:
        eventsPublished > 0
          ? `공개 공연 ${eventsPublished}개${eventsShowcase > 0 ? ` · 대표 공연 ${eventsShowcase}개` : ''}`
          : '아직 공개된 공연이 없습니다.',
      tip: loose > 0 ? `정리되지 않은 사진 ${loose}장이 사진 보관함에 있습니다.` : undefined,
      ctaHref: '/admin/gallery/new',
      ctaLabel: '+ 첫 공연 등록',
    },
    {
      n: 5,
      label: '대표 공연',
      title: '대표 공연을 지정합니다',
      desc: "가장 내세우고 싶은 공연 하나를 '대표 공연'으로 지정하면, 공연 페이지 상단에 크게 소개됩니다. 마지막 단계입니다.",
      state: eventsShowcase > 0 ? 'done' : 'todo',
      status:
        eventsShowcase > 0
          ? `대표 공연 ${eventsShowcase}개 · 공연 페이지에 소개됩니다`
          : eventsPublished > 0
          ? '대표 공연을 아직 지정하지 않았습니다.'
          : '먼저 공연을 등록해 주세요.',
      ctaHref: '/admin/gallery',
      ctaLabel: '이벤트 관리 →',
    },
  ];

  const doneCount = steps.filter((s) => s.state === 'done').length;
  const currentIdx = steps.findIndex((s) => s.state !== 'done');
  const railRatio = doneCount / steps.length;

  const progressMicro =
    doneCount === 0
      ? '한 단계씩 진행하시면 됩니다. 한 번에 모두 마치지 않으셔도 됩니다.'
      : doneCount >= steps.length
      ? '준비가 모두 끝났습니다. 이제 관리실에서 일상적인 운영을 이어가시면 됩니다.'
      : '남은 단계를 마치시면 홈페이지가 한층 충실해집니다.';

  const stateText: Record<StepState, string> = { done: '완료', todo: '예정', attention: '확인 필요' };

  return (
    <div className="admin-page admin-console">
      {/* 환영 헤더 + 진행도 */}
      <header className="admin-onboard-head">
        <div className="admin-onboard-headtop">
          <div>
            <p className="admin-kicker">KTDOC ADMIN</p>
            <h1 className="admin-onboard-greet">
              <b>{adminName}</b>님, {isFreshSite ? '환영합니다.' : '안녕하세요.'}
            </h1>
            <p className="admin-onboard-lede">
              {isFreshSite
                ? '춤누리 홈페이지를 관리하는 공간입니다.'
                : `오늘의 현황 — 공개 수업 ${programsPublished} · 새 신청 ${appsNew} · 공개 공연 ${eventsPublished}`}
            </p>
          </div>
          <Link href="/" target="_blank" className="admin-btn admin-btn-outline">
            사이트 보기 ↗
          </Link>
        </div>

        <div className="admin-onboard-progress">
          <div
            className={`admin-rail${doneCount >= steps.length ? ' is-complete' : ''}`}
            style={{ '--p': railRatio } as CSSProperties}
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={steps.length}
            aria-label="시작 가이드 진행도"
          />
          <span className="admin-rail-count">
            <b>{doneCount}</b>/{steps.length}
          </span>
          <span className="admin-rail-micro">{progressMicro}</span>
        </div>
      </header>

      {/* 긴급: 새 신청 (페이지 내 유일한 빨강 강조) */}
      {hasNewApps && (
        <section className="admin-urgent-callout">
          <p>가장 먼저 처리할 일 — 새 신청 {appsNew}건이 답변을 기다리고 있습니다</p>
          <Link href="/admin/applications" className="admin-btn admin-btn-danger">
            신청자 보기
          </Link>
        </section>
      )}

      {/* 가이드 저니 — 두루마리 */}
      <ol className="admin-scroll">
        {steps.map((step, i) => {
          const isCurrent = i === currentIdx;
          const isDone = step.state === 'done';
          const isAttention = step.state === 'attention';
          const stateClass = isDone ? 'is-done' : isCurrent ? 'is-current' : 'is-todo';
          return (
            <li
              key={step.n}
              className={`admin-step ${stateClass}${isCurrent && isAttention ? ' is-attention' : ''}`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span className="admin-step-medallion" aria-hidden="true">
                {isDone ? <IconCheck /> : step.n}
              </span>
              <div className="admin-step-body">
                <p className="admin-step-eyebrow">
                  단계 {step.n} · {step.label}
                  <span className="admin-sr-only"> ({stateText[step.state]})</span>
                  {isCurrent &&
                    (isAttention ? (
                      <span className="admin-step-pill is-attention">답변 필요</span>
                    ) : (
                      <span className="admin-step-pill">진행할 차례</span>
                    ))}
                </p>
                <h2 className="admin-step-title">{step.title}</h2>
                {isCurrent && <p className="admin-step-desc">{step.desc}</p>}
                <p className="admin-step-status">{step.status}</p>
                {isCurrent && step.tip && <p className="admin-step-tip">{step.tip}</p>}
                {!isDone && (
                  <div className="admin-step-actions">
                    <Link
                      href={step.ctaHref}
                      className={`admin-btn ${
                        isCurrent ? (isAttention ? 'admin-btn-danger' : 'admin-btn-gold') : 'admin-btn-outline'
                      }`}
                    >
                      {step.ctaLabel}
                    </Link>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* 관리실 — 기존 기능 도메인 (항상 존재) */}
      <section className={`admin-workshop${isFreshSite ? ' admin-workshop--quiet' : ''}`}>
        <div className="admin-workshop-head">
          <h2>관리실</h2>
        </div>
        {isFreshSite && (
          <p className="admin-workshop-quiet-line">
            익숙해지신 뒤에는 이곳에서 바로 관리하실 수 있습니다 — 프로그램 · 신청 · 회원 · 공연·갤러리
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
                <span>개 프로그램</span>
              </span>
            </div>
            <h2 className="admin-domain-title">수업 · 프로그램 · 캠프</h2>
            <p className="admin-domain-desc">
              방문자에게 보여줄 수업과 여름 캠프를 등록하고, 공개 여부와 사진을 관리합니다.
            </p>
            <div className="admin-domain-actions">
              <Link href="/admin/programs" className="admin-btn admin-btn-primary">
                프로그램 관리
              </Link>
              <Link href="/admin/programs/new" className="admin-btn admin-btn-outline">
                + 새로 만들기
              </Link>
            </div>
          </section>

          <section className={`admin-domain${appsNew > 0 ? ' admin-domain--alert' : ''}`}>
            <div className="admin-domain-top">
              <span className="admin-domain-icon">
                <IconInbox />
              </span>
              {appsNew > 0 ? (
                <span className="admin-domain-flag">● 신규 {appsNew}</span>
              ) : (
                <span className="admin-domain-stat-inline">
                  <strong>{appsTotal}</strong>
                  <span>건</span>
                </span>
              )}
            </div>
            <h2 className="admin-domain-title">신청 현황</h2>
            <p className="admin-domain-desc">
              수업·캠프 신청자를 확인하고, 이메일·전화로 바로 연락합니다.
            </p>
            <p className="admin-domain-meta">
              신규 {appsNew} · 전체 {appsTotal}
            </p>
            <div className="admin-domain-actions">
              <Link href="/admin/applications" className="admin-btn admin-btn-primary">
                신청자 보기
              </Link>
            </div>
          </section>

          <section className="admin-domain">
            <div className="admin-domain-top">
              <span className="admin-domain-icon">
                <IconUsers />
              </span>
              <span className="admin-domain-stat-inline">
                <strong>{membersTotal}</strong>
                <span>명 회원</span>
              </span>
            </div>
            <h2 className="admin-domain-title">회원 관리</h2>
            <p className="admin-domain-desc">
              사이트에 가입한 회원을 확인합니다. 이메일·가입일·권한을 한눈에 볼 수 있습니다.
            </p>
            <div className="admin-domain-actions">
              <Link href="/admin/members" className="admin-btn admin-btn-primary">
                회원 목록 보기
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
                  <span>공개 이벤트</span>
                </span>
                <span className="admin-domain-stat">
                  <strong>{loose}</strong>
                  <span>미정리 사진</span>
                </span>
                <span className="admin-domain-stat">
                  <strong>{categoryCount}</strong>
                  <span>카테고리</span>
                </span>
              </div>
            </div>
            <h2 className="admin-domain-title">공연 · 갤러리</h2>
            <p className="admin-domain-desc">
              공연 기록과 현장 사진·영상을 관리하고, 대표 공연을 공연 페이지 쇼케이스에 노출합니다.
              연도별 아카이브는 갤러리에 표시됩니다.
            </p>
            <div className="admin-domain-actions">
              <Link href="/admin/gallery" className="admin-btn admin-btn-primary">
                이벤트 관리
              </Link>
              <Link href="/admin/gallery/new" className="admin-btn admin-btn-outline">
                + 새 이벤트
              </Link>
              <Link href="/admin/gallery/photos" className="admin-btn admin-btn-outline">
                사진 보관함
              </Link>
              <Link href="/admin/gallery/categories" className="admin-btn admin-btn-outline">
                이벤트 카테고리
              </Link>
            </div>
          </section>
        </div>
      </section>

      {/* 안내 풋노트 */}
      <div className="admin-guide-footnote">
        <span>로그인한 상태에서 홈페이지를 열고 상단의 &lsquo;편집&rsquo;을 켜면, 페이지의 글과 사진을 그 자리에서 직접 수정할 수 있습니다. 코드를 다룰 필요가 없습니다.</span>
        <span>한 번에 모두 끝내지 않으셔도 됩니다. 저장해 두면 언제든 이어서 진행하실 수 있습니다.</span>
      </div>
    </div>
  );
}
