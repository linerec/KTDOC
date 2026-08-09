'use client';

/**
 * MemberTable
 * 관리자용 회원 목록 + 승인/거절/정지/복구/역할변경/원생연결 액션.
 * - 운영진(선생님·관리자)이 가입 회원을 승인한다.
 * - 역할 변경은 관리자(canManageRoles)만 노출.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Member, MemberRole } from '@/types/members';
import { useT, type TFunction } from '@/lib/i18n/useT';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatTimestampDate } from '@/lib/i18n/formatDate';
import { roleLabel, statusLabel } from '@/lib/i18n/memberLabels';

interface StudentOption {
  id: string;
  name: string | null;
  enrollment_year: number | null;
}

interface MemberTableProps {
  members: Member[];
  students: StudentOption[];
  canManageRoles: boolean;
  /** 회원 id → 알림이 켜진 기기 수(없으면 0). 자세한 현황은 /admin/notify. */
  pushDevices?: Record<string, number>;
}

/**
 * 관리자가 부여 가능한 **신분** (레거시 'user'·'admin' 제외).
 * 관리 권한은 신분이 아니라 옆의 토글이 맡는다(0034).
 */
const ASSIGNABLE_ROLES: MemberRole[] = ['student', 'parent', 'teacher', 'staff'];

const STATUS_BADGE_CLASS: Record<string, string> = {
  pending: 'admin-badge-warning',
  active: 'admin-badge-success',
  rejected: 'admin-badge-danger',
  suspended: 'admin-badge-muted',
};

export default function MemberTable({
  members,
  students,
  canManageRoles,
  pushDevices = {},
}: MemberTableProps) {
  const router = useRouter();
  const t = useT();
  const { locale } = useLanguage();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  // 임시 비밀번호 발급 결과 — 평문은 이 모달에서 한 번만 표시된다
  const [tempResult, setTempResult] = useState<{ name: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function runAction(memberId: string, body: Record<string, unknown>) {
    setBusyId(memberId);
    setError('');
    try {
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || t('admin.common.actionFailed', '작업에 실패했습니다.'));
        return;
      }
      router.refresh();
    } catch {
      setError(t('admin.common.actionError', '작업 중 오류가 발생했습니다.'));
    } finally {
      setBusyId(null);
    }
  }

  // 임시 비밀번호 발급 — 응답의 평문을 모달로 보여주고 다시 조회할 수 없다.
  async function issueTempPassword(member: Member) {
    const displayName = member.name || member.email;
    const ok = window.confirm(
      t(
        'admin.members.tempPwConfirm',
        '{name} 회원에게 임시 비밀번호를 발급할까요?\n기존 비밀번호는 즉시 사용할 수 없게 됩니다.',
        { name: displayName }
      )
    );
    if (!ok) return;

    setBusyId(member.id);
    setError('');
    try {
      const res = await fetch(`/api/admin/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'issueTempPassword' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.tempPassword) {
        setError(
          data.error || t('admin.members.tempPwFailed', '임시 비밀번호 발급에 실패했습니다.')
        );
        return;
      }
      setCopied(false);
      setTempResult({ name: displayName, password: data.tempPassword });
      router.refresh();
    } catch {
      setError(t('admin.common.actionError', '작업 중 오류가 발생했습니다.'));
    } finally {
      setBusyId(null);
    }
  }

  async function copyTempPassword() {
    if (!tempResult) return;
    try {
      await navigator.clipboard.writeText(tempResult.password);
      setCopied(true);
    } catch {
      // 클립보드 미지원 환경 — 화면의 숫자를 직접 읽어 전달하면 된다
    }
  }

  if (members.length === 0) {
    return (
      <div className="admin-empty-state">
        <p>{t('admin.members.empty', '조건에 맞는 회원이 없습니다.')}</p>
      </div>
    );
  }

  return (
    <>
      {error && <div className="admin-inline-error">{error}</div>}
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('admin.members.colMember', '회원')}</th>
              <th style={{ width: '110px' }}>{t('admin.members.colRole', '역할')}</th>
              <th style={{ width: '100px' }}>{t('admin.members.colStatus', '상태')}</th>
              <th style={{ width: '90px' }}>{t('admin.members.colPush', '알림')}</th>
              <th style={{ width: '220px' }}>{t('admin.members.colLink', '연결')}</th>
              <th style={{ width: '120px' }}>{t('admin.members.colJoined', '가입일')}</th>
              <th style={{ width: '200px' }}>{t('admin.common.colActions', '작업')}</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const displayName = member.name || member.email.split('@')[0];
              const busy = busyId === member.id;
              const devices = pushDevices[member.id] ?? 0;
              return (
                <tr key={member.id} className={busy ? 'is-busy' : undefined}>
                  {/* 회원 */}
                  <td>
                    <div className="admin-table-link">
                      <span className="admin-table-title">{displayName}</span>
                      <a
                        href={`mailto:${member.email}`}
                        className="admin-table-link-inline admin-table-subtitle"
                      >
                        {member.email}
                      </a>
                      {member.phone && (
                        <span className="admin-table-subtitle">{member.phone}</span>
                      )}
                      {member.role === 'student' && member.enrollment_year && (
                        <span className="admin-table-subtitle">
                          {t('admin.members.enrolledYear', '{y}년 입학', {
                            y: member.enrollment_year,
                          })}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 신분 + 관리 권한 — 둘은 별개이므로 배지도 따로 단다 */}
                  <td>
                    <span
                      className={`admin-badge ${
                        member.role === 'teacher' || member.role === 'staff'
                          ? 'admin-badge-role'
                          : 'admin-badge-muted'
                      }`}
                    >
                      {roleLabel(t, member.role)}
                    </span>
                    {member.is_admin && (
                      <span className="admin-badge admin-badge-admin">
                        {t('admin.members.adminFlag', '관리자')}
                      </span>
                    )}
                  </td>

                  {/* 상태 */}
                  <td>
                    <span
                      className={`admin-badge ${
                        STATUS_BADGE_CLASS[member.status] || 'admin-badge-muted'
                      }`}
                    >
                      {statusLabel(t, member.status)}
                    </span>
                  </td>

                  {/* 알림(푸시)을 켠 기기 수 — 0이면 이 회원에게는 푸시가 가지 않는다 */}
                  <td>
                    {devices > 0 ? (
                      <span
                        className="admin-badge admin-badge-success"
                        title={t(
                          'admin.members.pushOnTitle',
                          '기기 {n}대에 알림이 켜져 있습니다.',
                          { n: devices }
                        )}
                      >
                        {t('admin.members.pushDevices', '{n}대', { n: devices })}
                      </span>
                    ) : (
                      <span
                        className="admin-badge admin-badge-muted"
                        title={t(
                          'admin.members.pushOffTitle',
                          '알림을 켜지 않아 푸시가 가지 않습니다(‘내 알림’함에는 남습니다).'
                        )}
                      >
                        {t('admin.members.pushOff', '꺼짐')}
                      </span>
                    )}
                  </td>

                  {/* 연결 (학부모→자녀 / 원생→보호자) */}
                  <td>
                    {member.role === 'parent' && (
                      <div className="admin-conn">
                        {(member.children ?? []).map((c) => (
                          <div key={c.linkId} className="admin-conn-item">
                            {c.studentId ? (
                              <span className="admin-conn-ok">
                                {t('admin.members.child', '자녀: {name}', {
                                  name: c.studentName || c.claimedName,
                                })}
                              </span>
                            ) : (
                              <div className="admin-conn-unresolved">
                                <span className="admin-conn-warn">
                                  {t('admin.members.unlinked', '미연결: {name}', {
                                    name: c.claimedName,
                                  })}
                                  {c.claimedEnrollmentYear
                                    ? ` ${t('admin.members.yearParen', '({y}년)', {
                                        y: c.claimedEnrollmentYear,
                                      })}`
                                    : ''}
                                </span>
                                <ResolveStudent
                                  t={t}
                                  students={students}
                                  disabled={busy}
                                  onLink={(studentId) =>
                                    runAction(member.id, {
                                      action: 'linkStudent',
                                      linkId: c.linkId,
                                      studentId,
                                    })
                                  }
                                />
                              </div>
                            )}
                          </div>
                        ))}
                        {(member.children ?? []).length === 0 && (
                          <span className="admin-table-muted">-</span>
                        )}
                      </div>
                    )}
                    {member.role === 'student' && (
                      <div className="admin-conn">
                        {(member.guardians ?? []).map((g) => (
                          <span key={g.guardianId} className="admin-conn-item admin-conn-ok">
                            {t('admin.members.guardian', '보호자: {name}', {
                              name: g.guardianName || g.guardianEmail,
                            })}
                          </span>
                        ))}
                        {(member.guardians ?? []).length === 0 && (
                          <span className="admin-table-muted">-</span>
                        )}
                      </div>
                    )}
                    {member.role !== 'parent' && member.role !== 'student' && (
                      <span className="admin-table-muted">-</span>
                    )}
                  </td>

                  {/* 가입일 */}
                  <td>{formatTimestampDate(member.created_at, locale)}</td>

                  {/* 작업 */}
                  <td>
                    <div className="admin-table-actions admin-table-actions-col">
                      {member.status === 'pending' && (
                        <div className="admin-btn-row">
                          <button
                            type="button"
                            className="admin-btn admin-btn-sm admin-btn-primary"
                            disabled={busy}
                            onClick={() => runAction(member.id, { action: 'approve' })}
                          >
                            {t('admin.members.approve', '승인')}
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn-sm admin-btn-outline"
                            disabled={busy}
                            onClick={() => runAction(member.id, { action: 'reject' })}
                          >
                            {t('admin.members.reject', '거절')}
                          </button>
                        </div>
                      )}
                      {member.status === 'active' && (
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm admin-btn-outline"
                          disabled={busy}
                          onClick={() => runAction(member.id, { action: 'suspend' })}
                        >
                          {t('admin.members.suspend', '정지')}
                        </button>
                      )}
                      {(member.status === 'rejected' || member.status === 'suspended') && (
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm admin-btn-primary"
                          disabled={busy}
                          onClick={() => runAction(member.id, { action: 'restore' })}
                        >
                          {t('admin.members.restore', '복구(승인)')}
                        </button>
                      )}

                      {/* 임시 비밀번호 발급 — 로그인 가능한 상태(대기·정회원)만 의미가 있다 */}
                      {(member.status === 'pending' || member.status === 'active') && (
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm admin-btn-outline"
                          disabled={busy}
                          onClick={() => issueTempPassword(member)}
                          title={t(
                            'admin.members.tempPwTitle',
                            '비밀번호를 잊은 회원에게 임시 비밀번호를 발급합니다'
                          )}
                        >
                          {t('admin.members.tempPw', '임시 비밀번호')}
                        </button>
                      )}

                      {canManageRoles && (
                        <select
                          className="admin-filter-select admin-role-select"
                          value={member.role}
                          disabled={busy}
                          onChange={(e) =>
                            runAction(member.id, {
                              action: 'setRole',
                              role: e.target.value,
                            })
                          }
                        >
                          {!ASSIGNABLE_ROLES.includes(member.role) && (
                            <option value={member.role}>{roleLabel(t, member.role)}</option>
                          )}
                          {ASSIGNABLE_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {roleLabel(t, r)}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* 관리 권한은 신분과 별개로 붙였다 뗀다 — 선생님에게 관리를
                          맡겼다 거둬도 그 사람은 계속 선생님이다. */}
                      {canManageRoles && (
                        <label className="admin-admin-toggle">
                          <input
                            type="checkbox"
                            checked={member.is_admin}
                            disabled={busy}
                            onChange={(e) =>
                              runAction(member.id, {
                                action: 'setAdmin',
                                isAdmin: e.target.checked,
                              })
                            }
                          />
                          <span>{t('admin.members.adminFlag', '관리자')}</span>
                        </label>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {tempResult && (
        <div
          className="admin-temp-pw-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t('admin.members.tempPwDone', '임시 비밀번호 발급 완료')}
          onClick={() => setTempResult(null)}
        >
          <div className="admin-temp-pw-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="admin-temp-pw-title">
              {t('admin.members.tempPwDone', '임시 비밀번호 발급 완료')}
            </h3>
            <p className="admin-temp-pw-target">{tempResult.name}</p>
            <div className="admin-temp-pw-code">{tempResult.password}</div>
            <p className="admin-temp-pw-guide">
              {t(
                'admin.members.tempPwGuide',
                '이 비밀번호는 지금 한 번만 표시됩니다. 전화·문자 등으로 회원에게 직접 전달해 주세요. 회원이 이 비밀번호로 로그인하면 새 비밀번호를 만들도록 안내됩니다.'
              )}
            </p>
            <div className="admin-btn-row admin-temp-pw-actions">
              <button
                type="button"
                className="admin-btn admin-btn-sm admin-btn-outline"
                onClick={copyTempPassword}
              >
                {copied
                  ? t('admin.common.copied', '복사됨')
                  : t('admin.common.copy', '복사')}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-sm admin-btn-primary"
                onClick={() => setTempResult(null)}
              >
                {t('admin.common.close', '닫기')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** 미연결 학부모에게 실제 원생을 지정하는 셀렉트 */
function ResolveStudent({
  t,
  students,
  disabled,
  onLink,
}: {
  t: TFunction;
  students: StudentOption[];
  disabled: boolean;
  onLink: (studentId: string) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <div className="admin-conn-resolve">
      <select
        className="admin-filter-select"
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
      >
        <option value="">{t('admin.members.pickStudent', '원생 선택...')}</option>
        {students.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name || t('admin.common.noName', '(이름없음)')}
            {s.enrollment_year
              ? ` · ${t('admin.members.yearSuffix', '{y}년', { y: s.enrollment_year })}`
              : ''}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="admin-btn admin-btn-sm"
        disabled={disabled || !value}
        onClick={() => value && onLink(value)}
      >
        {t('admin.members.link', '연결')}
      </button>
    </div>
  );
}
