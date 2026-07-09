'use client';

/**
 * ProfileForm
 * 내 프로필 기본 정보 — 이름(수정 가능) + 이메일·권한·가입일(읽기 전용).
 * 저장 시 세션(update)과 레이아웃(router.refresh)에 새 이름을 즉시 반영한다.
 */

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { MEMBER_ROLE_LABELS, type MemberRole } from '@/types/members';
import { uploadImageFile } from '@/lib/uploadClient';

interface ProfileFormProps {
  initialName: string;
  email: string;
  role: MemberRole;
  joinedAt: string | null;
  /** 공개 수강생 페이지 노출 동의(학생만 의미 있음) */
  initialConsent: boolean;
  /** 프로필 사진 R2 공개 URL (없으면 이니셜 아바타) */
  initialPhotoUrl: string | null;
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  const d = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`;
}

export default function ProfileForm({
  initialName,
  email,
  role,
  joinedAt,
  initialConsent,
  initialPhotoUrl,
}: ProfileFormProps) {
  const { update } = useSession();
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [consent, setConsent] = useState(initialConsent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialPhotoUrl);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 사진은 폼 저장과 독립적으로, 선택/제거 즉시 서버에 반영한다
  const handlePhotoSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 재선택도 change가 발생하도록 초기화
    if (!file) return;

    setError('');
    setSuccess('');
    setPhotoBusy(true);
    try {
      const data = await uploadImageFile<{ success: boolean; url: string }>(
        '/api/admin/profile/photo',
        file,
        { failMessage: '사진 업로드에 실패했습니다.' }
      );
      setPhotoUrl(data.url);
      setSuccess('프로필 사진이 저장되었습니다.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '사진 업로드 중 오류가 발생했습니다.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const handlePhotoRemove = async () => {
    setError('');
    setSuccess('');
    setPhotoBusy(true);
    try {
      const res = await fetch('/api/admin/profile/photo', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || '사진 제거에 실패했습니다.');
        return;
      }
      setPhotoUrl(null);
      setSuccess('프로필 사진을 제거했습니다.');
      router.refresh();
    } catch {
      setError('사진 제거 중 오류가 발생했습니다.');
    } finally {
      setPhotoBusy(false);
    }
  };

  // 동의 토글은 학생에게만 노출(공개 수강생 페이지가 원생만 나열)
  const showConsent = role === 'student';
  const dirty =
    name.trim() !== initialName.trim() || (showConsent && consent !== initialConsent);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimmed = name.trim();
    if (!trimmed) {
      setError('이름을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          showConsent ? { name: trimmed, publicArchiveConsent: consent } : { name: trimmed }
        ),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || '변경에 실패했습니다.');
        return;
      }

      // 세션 토큰과 사이드바(서버 렌더)에 새 이름 반영
      await update({ name: trimmed });
      router.refresh();
      setSuccess(data.message || '저장되었습니다.');
    } catch {
      setError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="admin-form-section admin-account-card" onSubmit={handleSubmit}>
      <h2 className="admin-form-section-title">기본 정보</h2>
      <p className="admin-form-help">
        이름은 관리자 화면에 표시됩니다. 이메일(로그인 아이디)과 권한은 변경할 수 없습니다.
      </p>

      <div className="admin-form-group">
        <span className="admin-form-label">프로필 사진</span>
        <div className="admin-avatar-row">
          <span className="admin-avatar" aria-hidden="true">
            {photoUrl ? (
              <Image src={photoUrl} alt="" width={72} height={72} className="admin-avatar-img" />
            ) : (
              <span className="admin-avatar-initial">
                {(name.trim() || email)[0]?.toUpperCase() ?? '?'}
              </span>
            )}
          </span>
          <div className="admin-avatar-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoSelect}
              hidden
            />
            <button
              type="button"
              className="admin-btn admin-btn-outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={photoBusy}
            >
              {photoBusy ? '처리 중...' : photoUrl ? '사진 변경' : '사진 업로드'}
            </button>
            {photoUrl && (
              <button
                type="button"
                className="admin-btn admin-btn-outline admin-btn-danger"
                onClick={handlePhotoRemove}
                disabled={photoBusy}
              >
                사진 제거
              </button>
            )}
            <p className="admin-avatar-help">
              JPEG·PNG·WebP, 4MB 이하. 공개 수강생 페이지에는 공개 표시에 동의한 원생의
              사진만 표시됩니다.
            </p>
          </div>
        </div>
      </div>

      <div className="admin-form-group">
        <label className="admin-form-label" htmlFor="profile-name">
          이름 <span className="required">*</span>
        </label>
        <input
          id="profile-name"
          type="text"
          className="admin-form-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          disabled={saving}
          autoComplete="name"
        />
      </div>

      <div className="admin-form-group">
        <label className="admin-form-label" htmlFor="profile-email">
          이메일
        </label>
        <input id="profile-email" type="email" className="admin-form-input" value={email} disabled readOnly />
      </div>

      <div className="admin-profile-meta">
        <span>
          권한 <strong>{MEMBER_ROLE_LABELS[role]}</strong>
        </span>
        <span>
          가입일 <strong>{formatDate(joinedAt)}</strong>
        </span>
      </div>

      {showConsent && (
        <label className="admin-consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            disabled={saving}
          />
          <span className="admin-consent-text">
            <strong>공개 수강생 페이지에 내 이름 표시 동의</strong>
            <span className="admin-consent-help">
              동의하면 누구나 볼 수 있는 ‘수강생 아카이브’ 페이지에 프로필 사진·이름·입학년도·참여
              횟수가 표시됩니다. 동의를 해제하면 즉시 제외됩니다.
            </span>
          </span>
        </label>
      )}

      {error && (
        <p className="admin-account-feedback admin-account-feedback--error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="admin-account-feedback admin-account-feedback--success" role="status">
          {success}
        </p>
      )}

      <div className="admin-domain-actions">
        <button type="submit" className="admin-btn admin-btn-primary" disabled={saving || !dirty}>
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </form>
  );
}
