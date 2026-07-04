'use client';

/**
 * CommentSection
 * 수업·이벤트 상세의 회원 댓글·대댓글 + 선생님 공지.
 * 작성/삭제 후 router.refresh()로 서버(상세 페이지)를 재조회해 목록을 갱신한다.
 */

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { CommentTargetType, CommentThread, CommentWithAuthor } from '@/types/comments';

interface Props {
  targetType: CommentTargetType;
  targetId: number;
  currentUserId: string;
  currentUserName: string;
  canAnnounce: boolean; // 운영진(선생님·관리자)
  threads: CommentThread[];
}

function formatWhen(iso: string): string {
  // D1 datetime('now')는 UTC "YYYY-MM-DD HH:MM:SS". 로컬 시간으로 표시.
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Avatar({ name, photo }: { name: string | null; photo: string | null }) {
  if (photo) {
    return <Image src={photo} alt="" width={36} height={36} className="comment-avatar-img" />;
  }
  return <span className="comment-avatar-initial">{(name || '?').trim()[0]?.toUpperCase() ?? '?'}</span>;
}

export default function CommentSection({
  targetType,
  targetId,
  currentUserId,
  currentUserName,
  canAnnounce,
  threads,
}: Props) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [asAnnouncement, setAsAnnouncement] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const totalCount = threads.reduce((n, t) => n + 1 + t.replies.length, 0);

  const submit = async (text: string, parentId: number | null, announce: boolean) => {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_type: targetType,
        target_id: targetId,
        parent_id: parentId,
        body: text,
        is_announcement: announce,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || '작성에 실패했습니다.');
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setPosting(true);
    setError(null);
    try {
      await submit(text, null, asAnnouncement && canAnnounce);
      setBody('');
      setAsAnnouncement(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '작성에 실패했습니다.');
    } finally {
      setPosting(false);
    }
  };

  const handleReply = async (parentId: number) => {
    const text = replyBody.trim();
    if (!text) return;
    setBusyId(parentId);
    setError(null);
    try {
      await submit(text, parentId, false);
      setReplyBody('');
      setReplyTo(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '작성에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('이 댓글을 삭제하시겠습니까? 답글도 함께 삭제됩니다.')) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '삭제에 실패했습니다.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  const canDelete = (c: CommentWithAuthor) => c.user_id === currentUserId || canAnnounce;

  const renderComment = (c: CommentWithAuthor, isReply: boolean) => (
    <div
      key={c.id}
      id={`comment-${c.id}`}
      className={`comment-item${isReply ? ' comment-reply' : ''}${c.is_announcement ? ' comment-announcement' : ''}`}
    >
      <span className="comment-avatar" aria-hidden="true">
        <Avatar name={c.author_name} photo={c.author_photo} />
      </span>
      <div className="comment-main">
        <div className="comment-head">
          <span className="comment-author">{c.author_name || '회원'}</span>
          {c.is_announcement && <span className="comment-badge">공지</span>}
          <span className="comment-time">{formatWhen(c.created_at)}</span>
        </div>
        <p className="comment-body">{c.body}</p>
        <div className="comment-actions">
          {!isReply && (
            <button
              type="button"
              className="comment-action-btn"
              onClick={() => {
                setReplyTo(replyTo === c.id ? null : c.id);
                setReplyBody('');
              }}
            >
              답글
            </button>
          )}
          {canDelete(c) && (
            <button
              type="button"
              className="comment-action-btn comment-action-danger"
              onClick={() => handleDelete(c.id)}
              disabled={busyId === c.id}
            >
              삭제
            </button>
          )}
        </div>

        {!isReply && replyTo === c.id && (
          <div className="comment-reply-form">
            <textarea
              className="comment-textarea"
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              rows={2}
              placeholder="답글을 입력하세요"
            />
            <div className="comment-form-actions">
              <button
                type="button"
                className="admin-btn admin-btn-sm admin-btn-outline"
                onClick={() => setReplyTo(null)}
              >
                취소
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-sm admin-btn-primary"
                onClick={() => handleReply(c.id)}
                disabled={busyId === c.id || !replyBody.trim()}
              >
                {busyId === c.id ? '...' : '답글 달기'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <section className="comment-section">
      <h2 className="comment-section-title">
        댓글 <span className="comment-count">{totalCount}</span>
      </h2>

      {error && <div className="admin-alert admin-alert-error">{error}</div>}

      <form onSubmit={handlePost} className="comment-form">
        <span className="comment-avatar" aria-hidden="true">
          <Avatar name={currentUserName} photo={null} />
        </span>
        <div className="comment-form-main">
          <textarea
            className="comment-textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder={canAnnounce ? '댓글 또는 공지를 남기세요' : '댓글을 남기세요'}
          />
          <div className="comment-form-actions">
            {canAnnounce && (
              <label className="comment-announce-toggle">
                <input
                  type="checkbox"
                  checked={asAnnouncement}
                  onChange={(e) => setAsAnnouncement(e.target.checked)}
                />
                공지로 등록
              </label>
            )}
            <button
              type="submit"
              className="admin-btn admin-btn-sm admin-btn-primary"
              disabled={posting || !body.trim()}
            >
              {posting ? '등록 중...' : '등록'}
            </button>
          </div>
        </div>
      </form>

      {threads.length === 0 ? (
        <p className="comment-empty">아직 댓글이 없습니다. 첫 댓글을 남겨보세요.</p>
      ) : (
        <div className="comment-list">
          {threads.map((t) => (
            <div key={t.id} className="comment-thread">
              {renderComment(t, false)}
              {t.replies.length > 0 && (
                <div className="comment-replies">
                  {t.replies.map((r) => renderComment(r, true))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
