'use client';

/**
 * NotifyComposer — 푸시 알림 작성·발송 폼(운영진).
 * 대상: 전체 / 역할별(체크) / 개인(선택). /api/push/send 로 POST.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MEMBER_ROLE_LABELS, type MemberRole } from '@/types/members';

interface MemberOption {
  id: string;
  name: string | null;
  email: string;
  role: MemberRole;
}

interface NotificationLog {
  id: number;
  title: string;
  body: string;
  url: string | null;
  target_type: 'all' | 'role' | 'user';
  target_value: string | null;
  sent_count: number;
  fail_count: number;
  created_at: string;
  sender_name: string | null;
}

type TargetType = 'all' | 'role' | 'user';

const ROLE_CHOICES: MemberRole[] = ['student', 'parent', 'teacher', 'admin'];

// 고정 타임존(Asia/Seoul)으로 서버·클라 렌더를 일치시켜 하이드레이션 불일치를 피한다.
function formatWhen(value: string): string {
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

export default function NotifyComposer({
  members,
  recent,
  subscriberCount,
}: {
  members: MemberOption[];
  recent: NotificationLog[];
  subscriberCount: number;
}) {
  const router = useRouter();

  const [targetType, setTargetType] = useState<TargetType>('all');
  const [roles, setRoles] = useState<MemberRole[]>(['student', 'parent']);
  const [userId, setUserId] = useState<string>(members[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const toggleRole = (r: MemberRole) => {
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  };

  const handleSend = async () => {
    setError('');
    setResult('');
    if (!title.trim() || !body.trim()) {
      setError('제목과 내용을 입력해 주세요.');
      return;
    }
    if (targetType === 'role' && roles.length === 0) {
      setError('역할을 1개 이상 선택해 주세요.');
      return;
    }
    if (targetType === 'user' && !userId) {
      setError('대상 회원을 선택해 주세요.');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          url: url.trim() || undefined,
          target: {
            type: targetType,
            roles: targetType === 'role' ? roles : undefined,
            userId: targetType === 'user' ? userId : undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || '발송에 실패했습니다.');
        return;
      }
      setResult(data.message || '발송했습니다.');
      setTitle('');
      setBody('');
      setUrl('');
      router.refresh();
    } catch {
      setError('서버 오류가 발생했습니다.');
    } finally {
      setSending(false);
    }
  };

  const targetLabel = (n: NotificationLog): string => {
    if (n.target_type === 'all') return '전체';
    if (n.target_type === 'role') {
      return (n.target_value || '')
        .split(',')
        .filter(Boolean)
        .map((r) => MEMBER_ROLE_LABELS[r as MemberRole] ?? r)
        .join('·');
    }
    const m = members.find((x) => x.id === n.target_value);
    return m ? `개인: ${m.name || m.email}` : '개인';
  };

  return (
    <div className="notify-grid">
      <section className="admin-form-section admin-account-card">
        <h2 className="admin-form-section-title">새 알림</h2>
        <p className="admin-form-help">
          알림을 켠 기기로만 전송됩니다(현재 {subscriberCount}대). 제목·내용은 휴대폰 알림에 그대로 표시됩니다.
        </p>

        {/* 대상 */}
        <div className="admin-form-group">
          <span className="admin-form-label">보낼 대상</span>
          <div className="notify-target-tabs">
            {([
              ['all', '전체'],
              ['role', '역할별'],
              ['user', '개인'],
            ] as [TargetType, string][]).map(([val, label]) => (
              <button
                key={val}
                type="button"
                className={`notify-tab${targetType === val ? ' is-active' : ''}`}
                onClick={() => setTargetType(val)}
                disabled={sending}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {targetType === 'role' && (
          <div className="admin-form-group">
            <div className="notify-roles">
              {ROLE_CHOICES.map((r) => (
                <label key={r} className="notify-role-check">
                  <input
                    type="checkbox"
                    checked={roles.includes(r)}
                    onChange={() => toggleRole(r)}
                    disabled={sending}
                  />
                  <span>{MEMBER_ROLE_LABELS[r]}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {targetType === 'user' && (
          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="notify-user">대상 회원</label>
            <select
              id="notify-user"
              className="admin-form-input"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              disabled={sending}
            >
              {members.length === 0 && <option value="">정회원이 없습니다</option>}
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {(m.name || m.email)} · {MEMBER_ROLE_LABELS[m.role]} ({m.email})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 내용 */}
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="notify-title">
            제목 <span className="required">*</span>
          </label>
          <input
            id="notify-title"
            type="text"
            className="admin-form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="예: 토요일 정기 공연 안내"
            disabled={sending}
          />
        </div>

        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="notify-body">
            내용 <span className="required">*</span>
          </label>
          <textarea
            id="notify-body"
            className="admin-form-input"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            rows={4}
            placeholder="예: 이번 주 토요일 오후 2시, 한국문화원 대공연장에서 공연이 있습니다."
            disabled={sending}
          />
        </div>

        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="notify-url">
            클릭 시 이동(선택)
          </label>
          <input
            id="notify-url"
            type="text"
            className="admin-form-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/admin/schedule (비우면 홈)"
            disabled={sending}
          />
        </div>

        {error && (
          <p className="admin-account-feedback admin-account-feedback--error" role="alert">{error}</p>
        )}
        {result && (
          <p className="admin-account-feedback admin-account-feedback--success" role="status">{result}</p>
        )}

        <div className="admin-domain-actions">
          <button
            type="button"
            className="admin-btn admin-btn-gold"
            onClick={handleSend}
            disabled={sending}
          >
            {sending ? '보내는 중…' : '알림 보내기'}
          </button>
        </div>
      </section>

      {/* 최근 발송 */}
      <section className="admin-form-section admin-account-card">
        <h2 className="admin-form-section-title">최근 발송</h2>
        {recent.length === 0 ? (
          <p className="admin-form-help">아직 보낸 알림이 없습니다.</p>
        ) : (
          <ul className="notify-history">
            {recent.map((n) => (
              <li key={n.id} className="notify-history-item">
                <div className="notify-history-top">
                  <span className="notify-history-title">{n.title}</span>
                  <span className="notify-history-when">{formatWhen(n.created_at)}</span>
                </div>
                <p className="notify-history-body">{n.body}</p>
                <div className="notify-history-meta">
                  <span className="notify-chip">{targetLabel(n)}</span>
                  <span>도달 {n.sent_count}{n.fail_count ? ` · 실패 ${n.fail_count}` : ''}</span>
                  {n.sender_name && <span>· {n.sender_name}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
