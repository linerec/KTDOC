'use client';

/**
 * PermissionMatrix
 * 메뉴 × 역할 권한 매트릭스 편집 UI(관리자 전용).
 * - 행 = 메뉴(레지스트리), 열 = 역할. 셀 = 체크박스(허용).
 * - admin 열·고정(권한 관리) 행은 잠겨 있음(서버가 진짜 강제, UI는 보조).
 * - 행별 프리셋으로 흔한 시나리오를 한 번에 설정.
 * - 저장은 전체 매트릭스를 서버로 보내 덮어쓴다(서버가 admin 강제·고정 메뉴 보호).
 */

import { useMemo, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/useT';
import { useRouter } from 'next/navigation';
import type { MemberRole } from '@/types/members';
import type { ToolRow } from '@/types/permissions';

interface PermissionMatrixProps {
  rows: ToolRow[];
  orphans: string[];
  roles: MemberRole[];
  roleLabels: Record<MemberRole, string>;
}

type CellMap = Record<string, boolean>;

const cellId = (menuKey: string, role: MemberRole) => `${menuKey}::${role}`;

/**
 * 행 프리셋: 신분별 허용 집합.
 * 'adminOnly'는 아무 신분에도 주지 않는다는 뜻이다 — 관리 권한(플래그)을 가진
 * 사람은 매트릭스와 무관하게 통과하므로, 그 결과가 곧 "관리자만"이 된다.
 */
const PRESETS: { key: string; label: string; roles: MemberRole[] }[] = [
  { key: 'public', label: '공용(전체)', roles: ['user', 'student', 'parent', 'teacher'] },
  { key: 'studentParent', label: '학생+학부모', roles: ['student', 'parent'] },
  { key: 'studentOnly', label: '학생만', roles: ['student'] },
  { key: 'staff', label: '운영진(선생님)', roles: ['teacher'] },
  { key: 'adminOnly', label: '관리자만', roles: [] },
  // label은 한국어 폴백 — 화면에서는 admin.perm.preset.<key>로 번역한다
];

function buildInitial(rows: ToolRow[], roles: MemberRole[]): CellMap {
  const map: CellMap = {};
  for (const row of rows) {
    for (const role of roles) {
      map[cellId(row.key, role)] = row.cells[role]?.allowed ?? false;
    }
  }
  return map;
}

export default function PermissionMatrix({
  rows,
  orphans,
  roles,
  roleLabels,
}: PermissionMatrixProps) {
  const t = useT();
  const router = useRouter();
  const initialRef = useRef<CellMap>(buildInitial(rows, roles));
  const [cells, setCells] = useState<CellMap>(() => buildInitial(rows, roles));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const dirty = useMemo(() => {
    const init = initialRef.current;
    return Object.keys(cells).some((k) => cells[k] !== init[k]);
  }, [cells]);

  function isLocked(row: ToolRow, role: MemberRole): boolean {
    return row.cells[role]?.locked ?? false;
  }

  function toggle(row: ToolRow, role: MemberRole) {
    if (isLocked(row, role)) return;
    const id = cellId(row.key, role);
    setCells((prev) => ({ ...prev, [id]: !prev[id] }));
    setMessage(null);
  }

  function applyPreset(row: ToolRow, presetKey: string) {
    if (row.fixed || row.requireRole) return;
    const preset = PRESETS.find((p) => p.key === presetKey);
    if (!preset) return;
    setCells((prev) => {
      const next = { ...prev };
      for (const role of roles) {
        if (isLocked(row, role)) continue;
        next[cellId(row.key, role)] = preset.roles.includes(role);
      }
      return next;
    });
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const permissions: { menu_key: string; role: MemberRole; allowed: boolean }[] = [];
    for (const row of rows) {
      if (row.fixed || row.requireRole) continue;
      for (const role of roles) {
        permissions.push({
          menu_key: row.key,
          role,
          allowed: cells[cellId(row.key, role)] ?? false,
        });
      }
    }
    try {
      const res = await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', permissions }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setMessage({
          type: 'err',
          text: data.error || t('admin.common.saveFailed', '저장에 실패했습니다.'),
        });
        return;
      }
      initialRef.current = { ...cells };
      setMessage({
        type: 'ok',
        text: t('admin.perm.saved', '저장되었습니다. 변경된 권한은 즉시 적용됩니다.'),
      });
      router.refresh();
    } catch {
      setMessage({ type: 'err', text: t('admin.perm.saveError', '저장 중 오류가 발생했습니다.') });
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setCells({ ...initialRef.current });
    setMessage(null);
  }

  async function removeOrphan(key: string) {
    if (
      !window.confirm(
        t('admin.perm.removeOrphanConfirm', "사용하지 않는 메뉴 '{key}'의 권한 데이터를 삭제할까요?", {
          key,
        })
      )
    )
      return;
    try {
      const res = await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteOrphan', menuKey: key }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setMessage({
          type: 'err',
          text: data.error || t('admin.common.deleteFailed', '삭제에 실패했습니다.'),
        });
        return;
      }
      router.refresh();
    } catch {
      setMessage({ type: 'err', text: t('admin.perm.deleteError', '삭제 중 오류가 발생했습니다.') });
    }
  }

  return (
    <div className="perm-tool">
      <div className="perm-toolbar">
        <div className="perm-toolbar-info">
          {dirty ? (
            <span className="perm-dirty">
              {t('admin.perm.dirty', '저장하지 않은 변경사항이 있습니다.')}
            </span>
          ) : (
            <span className="admin-table-muted">
              {t('admin.perm.hint', '메뉴별로 접근 가능한 역할을 체크하세요.')}
            </span>
          )}
        </div>
        <div className="perm-toolbar-actions">
          {dirty && (
            <button type="button" className="admin-btn admin-btn-sm admin-btn-outline" onClick={reset} disabled={saving}>
              {t('admin.perm.revert', '되돌리기')}
            </button>
          )}
          <button type="button" className="admin-btn admin-btn-sm admin-btn-primary" onClick={save} disabled={!dirty || saving}>
            {saving
              ? t('admin.common.saving', '저장 중...')
              : t('admin.perm.save', '변경사항 저장')}
          </button>
        </div>
      </div>

      {message && (
        <div className={message.type === 'ok' ? 'admin-callout' : 'admin-inline-error'}>
          {message.text}
        </div>
      )}

      <div className="admin-table-wrapper">
        <table className="admin-table perm-table">
          <thead>
            <tr>
              <th className="perm-th-menu">{t('admin.perm.colMenu', '메뉴')}</th>
              {roles.map((role) => (
                <th key={role} className="perm-th-role">
                  {roleLabels[role]}
                </th>
              ))}
              <th className="perm-th-preset">{t('admin.perm.colPreset', '빠른 설정')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>
                  <div className={`perm-menu-name${row.sub ? ' is-sub' : ''}`}>
                    <span className="perm-menu-label">{row.label}</span>
                    {(row.fixed || row.requireRole) && (
                      <span className="perm-lock-tag">
                        {t('admin.perm.locked', '관리자 전용 · 잠김')}
                      </span>
                    )}
                  </div>
                </td>
                {roles.map((role) => {
                  const locked = isLocked(row, role);
                  const checked = cells[cellId(row.key, role)] ?? false;
                  return (
                    <td key={role} className="perm-cell">
                      <label className={`perm-check${locked ? ' is-locked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={locked || saving}
                          onChange={() => toggle(row, role)}
                          aria-label={`${row.label} - ${roleLabels[role]}`}
                        />
                        <span className="perm-check-box" aria-hidden="true" />
                      </label>
                    </td>
                  );
                })}
                <td className="perm-cell-preset">
                  <select
                    className="admin-filter-select perm-preset-select"
                    value=""
                    disabled={row.fixed || !!row.requireRole || saving}
                    onChange={(e) => {
                      applyPreset(row, e.target.value);
                      e.currentTarget.value = '';
                    }}
                  >
                    <option value="" disabled>
                      {t('admin.perm.presetPrompt', '프리셋...')}
                    </option>
                    {PRESETS.map((p) => (
                      <option key={p.key} value={p.key}>
                        {t(`admin.perm.preset.${p.key}`, p.label)}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {orphans.length > 0 && (
        <div className="perm-orphans">
          <h2 className="perm-orphans-title">{t('admin.perm.orphans', '사용하지 않는 메뉴')}</h2>
          <p className="admin-table-muted">
            {t(
              'admin.perm.orphansHelp',
              '코드에서 제거됐지만 권한 데이터가 남아있는 메뉴입니다. 접근에는 영향이 없으며 정리할 수 있습니다.'
            )}
          </p>
          <ul className="perm-orphans-list">
            {orphans.map((key) => (
              <li key={key}>
                <code>{key}</code>
                <button type="button" className="admin-btn admin-btn-sm admin-btn-outline" onClick={() => removeOrphan(key)}>
                  {t('admin.perm.cleanUp', '정리')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
