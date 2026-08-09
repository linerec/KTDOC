'use client';

/**
 * TestAccountsPanel — 역할별 점검용 고정 계정 게시판(관리자에게만 노출)
 *
 * 계정 목록의 단일 출처는 lib/testAccounts.json이고, 여기서는 그대로 보여주기만 한다.
 * 비밀번호가 평문으로 보이는 것은 의도다(점검용 계정 — lib/testAccounts.ts 참고).
 */

import T from '@/components/common/T';
import { useT } from '@/lib/i18n/useT';
import { roleLabel } from '@/lib/i18n/memberLabels';
import { TEST_ACCOUNTS } from '@/lib/testAccounts';

export default function TestAccountsPanel() {
  const t = useT();

  return (
    <details className="admin-test-accounts">
      <summary>
        {t('admin.members.testAccounts', '테스트 계정')}{' '}
        <span className="admin-test-accounts-count">{TEST_ACCOUNTS.length}</span>
        <span className="admin-test-accounts-hint">
          {t(
            'admin.members.testAccountsHint',
            '각 역할의 관리 콘솔을 점검하기 위한 고정 계정입니다. 비밀번호는 관리자에게만 표시됩니다.'
          )}
        </span>
      </summary>
      <div className="admin-test-accounts-body">
        <table>
          <thead>
            <tr>
              <th>{t('admin.members.colRole', '역할')}</th>
              <th>{t('admin.members.colName', '이름')}</th>
              <th>{t('admin.members.colEmail', '이메일')}</th>
              <th>{t('admin.members.colPassword', '비밀번호')}</th>
            </tr>
          </thead>
          <tbody>
            {TEST_ACCOUNTS.map((acc) => (
              <tr key={acc.email}>
                <td>{roleLabel(t, acc.role)}</td>
                <td>{acc.name}</td>
                <td>
                  <code>{acc.email}</code>
                </td>
                <td>
                  <code>{acc.password}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="admin-test-accounts-note">
          {/* 명령어는 <code>로 남겨야 해서 문자열이 아니라 <T>의 자리표시자로 끼운다 */}
          <T k="admin.members.testAccountsNote" params={{ cmd: <code>npm run seed:test</code> }}>
            {'계정을 생성하거나 비밀번호를 위 값으로 초기화하려면 {cmd}를 실행합니다.'}
          </T>
        </p>
      </div>
    </details>
  );
}
