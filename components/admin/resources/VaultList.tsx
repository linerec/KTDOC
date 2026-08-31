'use client';

/**
 * 자료함 목록 + 새로 만들기
 *
 * 목록에서 가장 큰 글자는 **번호**다. 운영진이 이 화면에서 하는 일의 절반은
 * "그 자료함 번호가 뭐였지"를 확인하고 전화로 불러 주는 것이기 때문이다.
 *
 * 비밀번호는 여기서 보여 주지 않는다 — 목록 질의가 아예 가져오지 않는다
 * (lib/d1/resources.ts). 확인은 상세에서 '보기'를 눌러야 한다.
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useT } from '@/lib/i18n/useT';
import { generatePasscode, isValidPasscode } from '@/lib/resources/passcode';
import type { ResourceVaultSummary } from '@/types/resources';

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 ** 3).toFixed(1)}GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 ** 2).toFixed(1)}MB`;
  if (bytes > 0) return `${Math.max(1, Math.ceil(bytes / 1024))}KB`;
  return '—';
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  const at = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
  if (Number.isNaN(at.getTime())) return '—';
  return at.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
}

function statusOf(v: ResourceVaultSummary): { label: string; tone: string } {
  if (!v.active) return { label: '꺼짐', tone: 'off' };
  if (v.expiresAt && Date.parse(v.expiresAt) <= Date.now()) {
    return { label: '기간 지남', tone: 'off' };
  }
  return { label: '열림', tone: 'on' };
}

export default function VaultList({ initialVaults }: { initialVaults: ResourceVaultSummary[] }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [passcode, setPasscode] = useState(() => generatePasscode());
  const [allowDownload, setAllowDownload] = useState(true);
  const [allowEmail, setAllowEmail] = useState(true);

  const copyCode = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      // 클립보드를 막아 둔 브라우저 — 번호는 화면에 크게 떠 있으니 눈으로 읽으면 된다
    }
  }, []);

  const create = useCallback(async () => {
    if (!title.trim()) {
      setError(t('admin.resources.needTitle', '제목을 입력해 주세요.'));
      return;
    }
    if (!isValidPasscode(passcode)) {
      setError(t('admin.resources.needPasscode', '비밀번호는 숫자 4~8자리로 정해 주세요.'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), passcode, allowDownload, allowEmail }),
      });
      const data = (await res.json().catch(() => null)) as {
        data?: { vault?: { id: number } };
        error?: string;
      } | null;
      if (!res.ok || !data?.data?.vault) {
        setError(data?.error ?? t('admin.resources.createFailed', '만들지 못했습니다.'));
        return;
      }
      router.push(`/admin/resources/${data.data.vault.id}`);
    } catch {
      setError(t('admin.resources.createFailed', '만들지 못했습니다.'));
    } finally {
      setBusy(false);
    }
  }, [title, passcode, allowDownload, allowEmail, router, t]);

  return (
    <div className="rva">
      <div className="rva__bar">
        <button type="button" className="admin-btn admin-btn-primary" onClick={() => setOpen(true)}>
          {t('admin.resources.new', '+ 새 자료함')}
        </button>
      </div>

      {initialVaults.length === 0 ? (
        <p className="rva__empty">
          {t(
            'admin.resources.empty',
            '아직 자료함이 없습니다. 공연에 쓸 음원을 담을 자료함을 하나 만들어 보세요.'
          )}
        </p>
      ) : (
        <ul className="rva__list">
          {initialVaults.map((vault) => {
            const status = statusOf(vault);
            return (
              <li className="rva-card" key={vault.id}>
                <div className="rva-card__code">
                  <button
                    type="button"
                    className="rva-card__codeBtn"
                    onClick={() => copyCode(vault.code)}
                    title={t('admin.resources.copyCode', '번호 복사')}
                  >
                    {vault.code}
                  </button>
                  <span className="rva-card__copied">
                    {copied === vault.code ? t('admin.resources.copied', '복사됨') : ''}
                  </span>
                </div>

                <div className="rva-card__body">
                  <Link className="rva-card__title" href={`/admin/resources/${vault.id}`}>
                    {vault.title}
                  </Link>
                  <p className="rva-card__meta">
                    {t('admin.resources.fileCount', '파일 {n}개').replace(
                      '{n}',
                      String(vault.itemCount)
                    )}
                    {' · '}
                    {formatBytes(vault.totalBytes)}
                    {vault.eventTitle ? ` · ${vault.eventTitle}` : ''}
                  </p>
                  <p className="rva-card__meta rva-card__meta--dim">
                    {t('admin.resources.lastOpened', '마지막 열람')}: {formatWhen(vault.lastOpenedAt)}
                  </p>
                </div>

                <div className="rva-card__side">
                  <span className={`rva-chip rva-chip--${status.tone}`}>{status.label}</span>
                  {vault.recentFailCount >= 5 ? (
                    <span className="rva-chip rva-chip--warn">
                      {t('admin.resources.failWarn', '실패 {n}회').replace(
                        '{n}',
                        String(vault.recentFailCount)
                      )}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {open ? (
        <div className="rva-modal" role="dialog" aria-modal="true" aria-labelledby="rva-new-title">
          <div className="rva-modal__panel">
            <h2 className="rva-modal__title" id="rva-new-title">
              {t('admin.resources.new', '+ 새 자료함')}
            </h2>

            <label className="rva-field">
              <span className="rva-field__label">{t('admin.resources.title', '제목')}</span>
              <input
                className="rva-field__input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('admin.resources.titlePh', '예) 2026 가을 공연 음원')}
                autoFocus
              />
            </label>

            <div className="rva-field">
              <span className="rva-field__label">{t('admin.resources.passcode', '비밀번호')}</span>
              <div className="rva-field__row">
                <input
                  className="rva-field__input rva-field__input--code"
                  value={passcode}
                  inputMode="numeric"
                  maxLength={8}
                  onChange={(e) => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                />
                <button
                  type="button"
                  className="admin-btn admin-btn-outline"
                  onClick={() => setPasscode(generatePasscode())}
                >
                  {t('admin.resources.regen', '새로 뽑기')}
                </button>
              </div>
              {/* 저작권 자료를 여는 열쇠다. 계정 암호를 재활용하면 한쪽이 새면 둘 다 샌다 */}
              <p className="rva-field__hint">
                {t('admin.resources.passcodeHint', '계정 비밀번호와 다른 번호를 쓰세요.')}
              </p>
            </div>

            <label className="rva-check">
              <input
                type="checkbox"
                checked={allowDownload}
                onChange={(e) => setAllowDownload(e.target.checked)}
              />
              <span>{t('admin.resources.allowDownload', '내려받기 허용')}</span>
            </label>

            <label className="rva-check">
              <input
                type="checkbox"
                checked={allowEmail}
                onChange={(e) => setAllowEmail(e.target.checked)}
              />
              <span>{t('admin.resources.allowEmail', '이메일로 받기 허용')}</span>
            </label>

            {error ? <p className="rva-modal__error">{error}</p> : null}

            <div className="rva-modal__acts">
              <button
                type="button"
                className="admin-btn admin-btn-outline"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                {t('admin.common.cancel', '취소')}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={create}
                disabled={busy}
              >
                {busy ? t('admin.common.saving', '저장 중…') : t('admin.common.create', '만들기')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
