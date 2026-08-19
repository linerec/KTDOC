'use client';

/**
 * ChildrenCard — 학부모 프로필의 자녀 연결 관리(형제자매 지원)
 *
 * 가입 때 못 적은 둘째·셋째를 나중에 잇는 자리다. 신청은 항상 '확인 대기'로
 * 만들어지고 운영진이 회원 관리에서 확정한다 — 이름만으로 자동 연결하면
 * 남의 자녀에게 스스로를 붙일 수 있기 때문이다(서버 주석 참조).
 * 확정된 연결의 해제는 학원에 요청한다(버튼 없음).
 */

import { useState } from 'react';
import type { GuardianChild } from '@/types/members';
import { useT } from '@/lib/i18n/useT';
import { MAX_CHILDREN, enrollmentYearOptions } from '@/lib/members/childEntries';

export default function ChildrenCard({ initialChildren }: { initialChildren: GuardianChild[] }) {
  const t = useT();
  const [children, setChildren] = useState<GuardianChild[]>(initialChildren);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [year, setYear] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const years = enrollmentYearOptions();

  /**
   * 신청·삭제가 같은 API를 다른 메서드로 부른다 — 호출 골격(잠금·오류·목록 갱신)을
   * 한 벌로 접는다. 성공 시 갱신된 자녀 목록을 반환하고, 실패 시 null.
   * 이전 성공 안내(notice)는 어떤 호출이든 시작할 때 지운다 — 남겨 두면
   * "삭제했는데 '신청되었습니다'가 보이는" 모순이 생긴다.
   */
  async function callChildrenApi(
    method: 'POST' | 'DELETE',
    body: Record<string, string>
  ): Promise<GuardianChild[] | null> {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/profile/children', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || t('admin.common.actionFailed', '작업에 실패했습니다.'));
        return null;
      }
      setChildren(data.data.children);
      return data.data.children;
    } catch {
      setError(t('admin.common.actionError', '작업 중 오류가 발생했습니다.'));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function submitAdd() {
    if (!name.trim() || !year) return;
    const updated = await callChildrenApi('POST', { name, enrollmentYear: year });
    if (!updated) return;
    setName('');
    setYear('');
    setAdding(false);
    setNotice(
      t(
        'admin.profile.children.requested',
        '신청되었습니다. 운영진이 확인해 연결하면 자녀의 수업·일정이 보이기 시작합니다.'
      )
    );
  }

  async function removePending(linkId: string, childName: string) {
    const ok = window.confirm(
      t('admin.profile.children.removeConfirm', "'{name}' 연결 신청을 삭제할까요?", {
        name: childName,
      })
    );
    if (!ok) return;
    await callChildrenApi('DELETE', { linkId });
  }

  return (
    <section className="admin-form-section admin-account-card profile-children">
      <h2 className="admin-form-section-title">{t('admin.profile.children.title', '내 자녀')}</h2>
      <p className="admin-form-help">
        {t(
          'admin.profile.children.guide',
          '연결된 자녀의 수업·일정·참여 기록을 보고, 공연 참여를 대신 응답할 수 있습니다. 자녀가 여러 명이면 모두 연결해 주세요.'
        )}
      </p>

      {error && <div className="admin-inline-error">{error}</div>}
      {notice && (
        <div className="admin-account-feedback admin-account-feedback--success">{notice}</div>
      )}

      {children.length === 0 ? (
        <p className="admin-form-help">
          {t('admin.profile.children.empty', '아직 연결된 자녀가 없습니다.')}
        </p>
      ) : (
        <ul className="profile-children-list">
          {children.map((c) => (
            <li key={c.linkId} className="profile-children-item">
              <span className="profile-children-name">
                {c.studentName || c.claimedName}
                {c.claimedEnrollmentYear && !c.studentId
                  ? ` (${c.claimedEnrollmentYear})`
                  : ''}
              </span>
              {c.studentId ? (
                <span className="admin-badge admin-badge-success">
                  {t('admin.profile.children.linked', '연결됨')}
                </span>
              ) : (
                <>
                  <span className="admin-badge admin-badge-warning">
                    {t('admin.profile.children.pending', '확인 대기')}
                  </span>
                  <button
                    type="button"
                    className="admin-btn admin-btn-sm admin-btn-outline"
                    disabled={busy}
                    onClick={() => removePending(c.linkId, c.claimedName)}
                  >
                    {t('admin.common.delete', '삭제')}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="profile-children-add">
          <input
            type="text"
            className="admin-filter-input"
            placeholder={t('admin.profile.children.namePlaceholder', '자녀(원생) 이름')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
          <select
            className="admin-filter-select"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            disabled={busy}
          >
            <option value="" disabled>
              {t('admin.profile.children.yearPlaceholder', '입학년도')}
            </option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="admin-btn admin-btn-sm admin-btn-primary"
            disabled={busy || !name.trim() || !year}
            onClick={submitAdd}
          >
            {t('admin.profile.children.submit', '신청')}
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-sm admin-btn-outline"
            disabled={busy}
            onClick={() => setAdding(false)}
          >
            {t('admin.common.cancel', '취소')}
          </button>
        </div>
      ) : (
        children.length < MAX_CHILDREN && (
          <button
            type="button"
            className="admin-btn admin-btn-sm admin-btn-outline"
            disabled={busy}
            onClick={() => setAdding(true)}
          >
            + {t('admin.profile.children.add', '자녀 추가')}
          </button>
        )
      )}
    </section>
  );
}
