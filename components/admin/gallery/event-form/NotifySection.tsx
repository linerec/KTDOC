'use client';

/**
 * 저장할 때 회원에게 푸시 알림을 보낼지 정하는 섹션
 *
 * 발송은 '공개 공연'일 때만 일어난다(useEventForm). 비공개로 저장하면 체크가 켜져 있어도
 * 보내지 않으므로, 그 조건을 화면에서 미리 알려 준다 — 보냈다고 착각하는 것이 가장 나쁘다.
 * 미리보기는 실제 발송 문구와 같은 규칙으로 만든다.
 */

import type { MemberRole } from '@/types/members';
import { useT } from '@/lib/i18n/useT';
import { roleLabel } from '@/lib/i18n/memberLabels';
import type { EventFormData } from './types';

const NOTIFY_ROLES: MemberRole[] = ['student', 'parent', 'teacher', 'admin'];

interface NotifySectionProps {
  formData: EventFormData;
  isNew: boolean;
  notify: boolean;
  onNotifyChange: (v: boolean) => void;
  notifyTarget: 'all' | 'role';
  onTargetChange: (v: 'all' | 'role') => void;
  notifyRoles: MemberRole[];
  onToggleRole: (r: MemberRole) => void;
}

export default function NotifySection({
  formData,
  isNew,
  notify,
  onNotifyChange,
  notifyTarget,
  onTargetChange,
  notifyRoles,
  onToggleRole,
}: NotifySectionProps) {
  const t = useT();

  const previewPrefix = isNew
    ? t('admin.events.pushNew', '[새 일정] ')
    : t('admin.events.pushChanged', '[일정 변경] ');
  const previewWhen =
    [formData.event_date, formData.start_time].filter(Boolean).join(' ') ||
    t('admin.events.previewDate', '(날짜)');

  return (
    <div className="admin-form-section">
      <h3 className="admin-form-section-title">
        {t('admin.events.notifySection', '회원에게 알림')}
      </h3>
      <p className="admin-form-help">
        {t(
          'admin.events.notifyHelp',
          '저장할 때 원생·학부모·선생님에게 푸시 알림을 보낼 수 있습니다. 알림을 탭하면 이 공연으로 이동해 각자 캘린더에 추가할 수 있습니다.'
        )}
      </p>

      <div className="admin-form-checkbox">
        <input
          type="checkbox"
          id="notify"
          checked={notify}
          onChange={(e) => onNotifyChange(e.target.checked)}
        />
        <label htmlFor="notify">
          {t('admin.events.notifyToggle', '저장 시 회원에게 알림 보내기')}
        </label>
      </div>

      {!formData.is_published && (
        <p
          className="admin-form-help"
          style={{ marginTop: 8, borderBottom: 'none', paddingBottom: 0 }}
        >
          {t(
            'admin.events.notifyPublicOnly',
            '알림은 공개 공연일 때만 발송됩니다 — 비공개로 저장하면 발송되지 않고, ‘저장 및 공개’로 저장하면 발송됩니다.'
          )}
        </p>
      )}

      {notify && (
        <div className="admin-form-group" style={{ marginTop: 14 }}>
          <span className="admin-form-label">{t('admin.events.notifyTarget', '보낼 대상')}</span>
          <div className="notify-target-tabs">
            {(
              [
                ['all', t('admin.events.targetAll', '전체')],
                ['role', t('admin.events.targetRole', '역할별')],
              ] as ['all' | 'role', string][]
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                className={`notify-tab${notifyTarget === val ? ' is-active' : ''}`}
                onClick={() => onTargetChange(val)}
              >
                {label}
              </button>
            ))}
          </div>

          {notifyTarget === 'role' && (
            <div className="notify-roles" style={{ marginTop: 10 }}>
              {NOTIFY_ROLES.map((r) => (
                <label key={r} className="notify-role-check">
                  <input
                    type="checkbox"
                    checked={notifyRoles.includes(r)}
                    onChange={() => onToggleRole(r)}
                  />
                  <span>{roleLabel(t, r)}</span>
                </label>
              ))}
            </div>
          )}

          <p
            className="admin-form-help"
            style={{ marginTop: 12, borderBottom: 'none', paddingBottom: 0 }}
          >
            {t('admin.events.previewLabel', '미리보기:')}{' '}
            <strong>
              {previewPrefix}
              {formData.title_ko || t('admin.events.previewTitle', '(제목)')}
            </strong>
            {' — '}
            {previewWhen}
            {formData.location ? ` · ${formData.location}` : ''}
          </p>
        </div>
      )}
    </div>
  );
}
