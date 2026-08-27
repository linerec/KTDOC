/**
 * Admin Notify
 * 알림 — 보내기(운영진 → 원생·학부모)와 현황(누가 어떤 기기로 받고 있는가)을 탭으로 가른다.
 *
 * 현황은 원래 보내기 화면 맨 아래에 붙어 있었는데, 발송 폼이 길어 스크롤 끝까지
 * 내려가지 않으면 있는 줄도 몰랐다. 탭으로 올려 "볼 수 있는 것"으로 만든다.
 *
 * 탭 상태는 화면 상태가 아니라 주소(?view=status)에 둔다 — 링크로 건네줄 수 있고,
 * 뒤로 가기가 동작하며, 탭마다 필요한 질의만 돌 수 있다(예전엔 안 보는 쪽의
 * 무거운 조인까지 매번 돌았다).
 */

import Link from 'next/link';
import { auth } from '@/auth';
import { requireMenuAccess } from '@/lib/admin/permissions';
import { getMembers } from '@/lib/members';
import { getRecentNotifications } from '@/lib/push/notifications';
import { getPrograms, getActiveEnrollmentCounts } from '@/lib/d1';
import { countSubscriptions } from '@/lib/push/subscriptions';
import {
  getMembersWithoutPush,
  getPushMemberStatuses,
  getPushSummary,
  getRecentPushEvents,
} from '@/lib/push/tracking';
import NotifyComposer from '@/components/admin/NotifyComposer';
import NotifyStatus from '@/components/admin/NotifyStatus';
import T from '@/components/common/T';
import AdminPageTabs, { type AdminPageTab } from '@/components/admin/AdminPageTabs';

export const metadata = {
  title: '알림 보내기 | KTDOC Admin',
};

type View = 'send' | 'status';

const EMPTY_SUMMARY = {
  memberCount: 0,
  deviceCount: 0,
  activeMemberCount: 0,
  offCount: 0,
  subscribed30d: 0,
  unsubscribed30d: 0,
  expired30d: 0,
};

interface PageProps {
  searchParams: Promise<{ view?: string }>;
}

export default async function AdminNotifyPage({ searchParams }: PageProps) {
  const session = await auth();
  await requireMenuAccess(session, 'notify');

  const params = await searchParams;
  const view: View = params.view === 'status' ? 'status' : 'send';

  // 두 탭 모두 머리글과 탭 뱃지에 쓰는 값싼 집계 — 항상 부른다.
  const [subscriberCount, summary] = await Promise.all([
    countSubscriptions().catch(() => 0),
    getPushSummary().catch(() => EMPTY_SUMMARY),
  ]);

  // 보이는 탭에 필요한 것만 부른다.
  // 수업 목록은 '수업' 대상 선택과 발송 내역의 이름 표시 둘 다에 쓴다.
  const [membersResult, recent, programsResult] =
    view === 'send'
      ? await Promise.all([
          getMembers({ status: 'active', limit: 500 }).catch(() => ({ members: [], total: 0 })),
          getRecentNotifications(20).catch(() => []),
          getPrograms({ limit: 200 }).catch(() => ({ programs: [], total: 0 })),
        ])
      : [{ members: [], total: 0 }, [], { programs: [], total: 0 }];

  // 수강 인원은 프로그램 id가 나온 뒤에야 셀 수 있다. 발송 대상과 같은 기준('active')으로 센다.
  const enrollCounts = await getActiveEnrollmentCounts(
    programsResult.programs.map((p) => p.id)
  ).catch(() => new Map<number, number>());

  const [pushMembers, pushOff, pushEvents] =
    view === 'status'
      ? await Promise.all([
          getPushMemberStatuses().catch(() => []),
          getMembersWithoutPush().catch(() => []),
          getRecentPushEvents(50).catch(() => []),
        ])
      : [[], [], []];

  const memberOptions = membersResult.members.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
  }));

  const programOptions = programsResult.programs.map((p) => ({
    id: p.id,
    title: p.title_ko,
    activeCount: enrollCounts.get(p.id) ?? 0,
  }));

  // 탭 라벨은 AdminPageTabs가 그릴 때 번역한다 — 여기서는 키와 한국어 폴백만 정한다.
  const tabs: AdminPageTab[] = [
    {
      value: 'send',
      href: '/admin/notify',
      labelKey: 'admin.nav.notify',
      labelKo: '알림 보내기',
    },
    {
      value: 'status',
      href: '/admin/notify?view=status',
      labelKey: 'admin.notify.statusTitle',
      labelKo: '알림 현황',
      count: summary.memberCount,
    },
  ];

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <div className="admin-breadcrumb">
            <Link href="/admin">
              <T k="admin.nav.home">홈</T>
            </Link>
            <span>/</span>
            <span>
              <T k="admin.navGroup.notify">알림</T>
            </span>
          </div>
          <h1 className="admin-title">
            {view === 'status' ? (
              <T k="admin.notify.statusTitle">알림 현황</T>
            ) : (
              <T k="admin.nav.notify">알림 보내기</T>
            )}
          </h1>
          <p className="admin-subtitle">
            {view === 'status' ? (
              <T k="admin.notify.statusLede">
                누가 어떤 기기로 알림을 받고 있는지 봅니다. 한 사람이 휴대폰과 컴퓨터에 따로 켤 수
                있어 회원 수와 기기 수는 다릅니다.
              </T>
            ) : (
              <T k="admin.notify.sendLede">
                원생·학부모에게 휴대폰 푸시 알림을 보냅니다. 알림을 켠 회원에게만 도착합니다.
              </T>
            )}{' '}
            <T
              k="admin.notify.currentOn"
              params={{
                people: <strong>{summary.memberCount}</strong>,
                devices: <strong>{subscriberCount}</strong>,
              }}
            >
              {'현재 {people}명이 기기 {devices}대에 알림을 켜 두었습니다.'}
            </T>
          </p>
        </div>
      </div>

      <AdminPageTabs
        tabs={tabs}
        current={view}
        ariaLabelKey="admin.notify.tabsAria"
        ariaLabelKo="알림 화면"
      />

      {view === 'send' ? (
        <NotifyComposer
          members={memberOptions}
          programs={programOptions}
          recent={recent}
          subscriberCount={subscriberCount}
        />
      ) : (
        <NotifyStatus
          summary={summary}
          members={pushMembers}
          off={pushOff}
          events={pushEvents}
        />
      )}
    </div>
  );
}
