'use client';

/**
 * NotifyStatus — 알림 현황(누가 어느 기기에 켜 뒀는지, 누가 안 켰는지, 무엇이 바뀌었는지).
 *
 * 발송 화면의 "기기 N대"는 합계일 뿐이라 운영진이 "○○ 어머님께 알림이 가고 있나"를
 * 확인할 수 없었다. 여기서 세 가지를 본다:
 *   켠 회원 — 기기별 도달 성적까지(켜 뒀는데 계속 실패하는 기기를 잡아낸다)
 *   안 켠 회원 — 안내가 필요한 사람 명단
 *   변경 이력 — 언제 누가 켜고 껐는지(행이 지워져도 남는 기록)
 */

import { useMemo, useState } from 'react';
import { MEMBER_ROLE_LABELS, type MemberRole } from '@/types/members';
import {
  PUSH_EVENT_LABELS,
  type PushEventEntry,
  type PushMemberOff,
  type PushMemberStatus,
  type PushSummary,
} from '@/types/push';
import { DEVICE_KIND_LABELS, describeDevice, deviceKind } from '@/lib/push/deviceLabel';

type StatusTab = 'on' | 'off' | 'events';

// 발송 이력과 같은 규칙(Asia/Seoul 고정)으로 찍어 서버·클라 렌더를 일치시킨다.
function formatWhen(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

function formatDay(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(d);
}

function memberLabel(name: string | null, email: string | null): string {
  return name || email || '(이름 없음)';
}

export default function NotifyStatus({
  summary,
  members,
  off,
  events,
}: {
  summary: PushSummary;
  members: PushMemberStatus[];
  off: PushMemberOff[];
  events: PushEventEntry[];
}) {
  const [tab, setTab] = useState<StatusTab>('on');

  // 기기 종류 분포(iPhone 3 · 안드로이드 1 …) — 어떤 기기를 챙겨야 하는지 알려준다.
  const kindCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of members) {
      for (const d of m.devices) {
        const kind = deviceKind(d.userAgent);
        counts.set(kind, (counts.get(kind) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [members]);

  const tabs: [StatusTab, string, number][] = [
    ['on', '알림 켠 회원', members.length],
    ['off', '안 켠 정회원', off.length],
    ['events', '변경 이력', events.length],
  ];

  return (
    <section className="admin-form-section admin-account-card notify-status">
      <h2 className="admin-form-section-title">알림 현황</h2>
      <p className="admin-form-help">
        회원이 휴대폰·PC에서 각각 알림을 켤 수 있어, 한 사람이 여러 기기에 켜 두기도 합니다.
        아래는 지금 켜져 있는 기기와 그동안의 변화입니다.
      </p>

      {/* 요약 */}
      <div className="notify-stat-grid">
        <div className="notify-stat">
          <span className="notify-stat-value">{summary.memberCount}명</span>
          <span className="notify-stat-label">알림 켠 회원</span>
          <span className="notify-stat-sub">정회원 {summary.activeMemberCount}명 중</span>
        </div>
        <div className="notify-stat">
          <span className="notify-stat-value">{summary.deviceCount}대</span>
          <span className="notify-stat-label">켜진 기기</span>
          <span className="notify-stat-sub">
            {kindCounts.length
              ? kindCounts
                  .map(
                    ([kind, n]) =>
                      `${DEVICE_KIND_LABELS[kind as keyof typeof DEVICE_KIND_LABELS] ?? kind} ${n}`
                  )
                  .join(' · ')
              : '아직 없습니다'}
          </span>
        </div>
        <div className="notify-stat">
          <span className="notify-stat-value">{summary.offCount}명</span>
          <span className="notify-stat-label">안 켠 정회원</span>
          <span className="notify-stat-sub">알림이 가지 않습니다</span>
        </div>
        <div className="notify-stat">
          <span className="notify-stat-value">
            +{summary.subscribed30d} / −{summary.unsubscribed30d + summary.expired30d}
          </span>
          <span className="notify-stat-label">최근 30일 변화</span>
          <span className="notify-stat-sub">
            켬 {summary.subscribed30d} · 끔 {summary.unsubscribed30d} · 만료 {summary.expired30d}
          </span>
        </div>
      </div>

      {/* 탭 */}
      <div className="notify-target-tabs notify-status-tabs">
        {tabs.map(([val, label, count]) => (
          <button
            key={val}
            type="button"
            className={`notify-tab${tab === val ? ' is-active' : ''}`}
            onClick={() => setTab(val)}
          >
            {label} <span className="notify-tab-count">{count}</span>
          </button>
        ))}
      </div>

      {/* 켠 회원 */}
      {tab === 'on' &&
        (members.length === 0 ? (
          <p className="admin-form-help">
            아직 알림을 켠 회원이 없습니다. 회원이 로그인한 뒤 대시보드에서 ‘알림 켜기’를
            누르면 여기에 나타납니다.
          </p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table notify-status-table">
              <thead>
                <tr>
                  <th>회원</th>
                  <th>역할</th>
                  <th>켜 둔 기기</th>
                  <th>마지막 도달</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const lastSuccess = m.devices
                    .map((d) => d.lastSuccessAt)
                    .filter((v): v is string => !!v)
                    .sort()
                    .pop();
                  return (
                    <tr key={m.userId}>
                      <td>
                        <span className="admin-table-title">{memberLabel(m.name, m.email)}</span>
                        <span className="admin-table-subtitle">{m.email}</span>
                      </td>
                      <td>
                        <span className="notify-chip">{MEMBER_ROLE_LABELS[m.role]}</span>
                      </td>
                      <td>
                        <ul className="notify-device-list">
                          {m.devices.map((d) => {
                            // 마지막 시도가 실패였는지 — 도달 성적보다 이게 더 급한 신호다.
                            const failing =
                              d.failCount > 0 &&
                              (!d.lastSuccessAt ||
                                (d.lastFailureAt ?? '') > (d.lastSuccessAt ?? ''));
                            return (
                              <li key={d.id} className="notify-device">
                                <span className="notify-device-name">
                                  {describeDevice(d.userAgent).label}
                                </span>
                                <span className="notify-device-meta">
                                  {formatDay(d.createdAt)}부터 · 도달 {d.successCount}
                                  {d.failCount > 0 && ` · 실패 ${d.failCount}`}
                                </span>
                                {failing && (
                                  <span className="notify-warn-chip">최근 발송 실패</span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                      <td className="notify-nowrap">{formatWhen(lastSuccess ?? null)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

      {/* 안 켠 회원 */}
      {tab === 'off' &&
        (off.length === 0 ? (
          <p className="admin-form-help">정회원 모두가 알림을 켜 두었습니다.</p>
        ) : (
          <>
            <p className="admin-form-help">
              이 회원들에게는 푸시 알림이 가지 않습니다(‘내 알림’함에는 남습니다).
              휴대폰으로 로그인 → 홈 화면에 추가 → 대시보드의 ‘알림 켜기’ 순서로 안내하세요.
            </p>
            <ul className="notify-off-list">
              {off.map((m) => (
                <li key={m.userId} className="notify-off-item">
                  <span className="notify-off-name">{memberLabel(m.name, m.email)}</span>
                  <span className="notify-chip">{MEMBER_ROLE_LABELS[m.role as MemberRole]}</span>
                  <span className="notify-off-note">
                    {m.lastOffAt
                      ? `${formatDay(m.lastOffAt)}에 꺼짐`
                      : '한 번도 켠 적 없음'}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ))}

      {/* 변경 이력 */}
      {tab === 'events' &&
        (events.length === 0 ? (
          <p className="admin-form-help">
            아직 기록된 변화가 없습니다. 이제부터 회원이 알림을 켜거나 끄면 여기에 쌓입니다.
          </p>
        ) : (
          <ul className="notify-event-list">
            {events.map((e) => (
              <li key={e.id} className="notify-event-item">
                <span className={`notify-event-chip notify-event-${e.event}`}>
                  {PUSH_EVENT_LABELS[e.event]}
                </span>
                <span className="notify-event-who">{memberLabel(e.name, e.email)}</span>
                <span className="notify-event-device">{describeDevice(e.userAgent).label}</span>
                <span className="notify-event-when">{formatWhen(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
