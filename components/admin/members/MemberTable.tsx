'use client';

/**
 * MemberTable
 * 관리자용 회원 목록. 현재는 조회 전용(이메일 보내기 mailto).
 * 향후 권한 변경·삭제 등 액션을 '작업' 칼럼에 추가해 확장한다.
 */

import type { Member } from '@/types/members';
import { MEMBER_ROLE_LABELS } from '@/types/members';

interface MemberTableProps {
  members: Member[];
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  const d = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
}

export default function MemberTable({ members }: MemberTableProps) {
  if (members.length === 0) {
    return (
      <div className="admin-empty-state">
        <p>조건에 맞는 회원이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="admin-table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            <th>회원</th>
            <th style={{ width: '120px' }}>권한</th>
            <th style={{ width: '150px' }}>이메일 인증</th>
            <th style={{ width: '120px' }}>가입일</th>
            <th style={{ width: '140px' }}>작업</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const displayName = member.name || member.email.split('@')[0];
            const isAdminRole = member.role === 'admin';
            return (
              <tr key={member.id}>
                <td>
                  <div className="admin-table-link">
                    <span className="admin-table-title">{displayName}</span>
                    <a
                      href={`mailto:${member.email}`}
                      className="admin-table-link-inline admin-table-subtitle"
                    >
                      {member.email}
                    </a>
                  </div>
                </td>
                <td>
                  <span
                    className={`admin-badge ${isAdminRole ? 'admin-badge-role' : 'admin-badge-muted'}`}
                  >
                    {MEMBER_ROLE_LABELS[member.role]}
                  </span>
                </td>
                <td>
                  {member.email_verified ? (
                    <span className="admin-badge admin-badge-success">
                      인증됨 · {formatDate(member.email_verified)}
                    </span>
                  ) : (
                    <span className="admin-table-muted">미인증</span>
                  )}
                </td>
                <td>{formatDate(member.created_at)}</td>
                <td>
                  <div className="admin-table-actions">
                    <a href={`mailto:${member.email}`} className="admin-btn admin-btn-sm">
                      이메일 보내기
                    </a>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
