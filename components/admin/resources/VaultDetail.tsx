'use client';

/**
 * 자료함 상세 — 번호·QR · 비밀번호 · 파일 · 설정 · 접근 기록
 *
 * 업로드는 uploadImageFiles가 아니라 **uploadFilesDirect**를 쓴다. 그쪽은
 * 이름대로 사진용이고 50MB 상한(MAX_UPLOAD_FILE_BYTES)을 클라이언트에서
 * 강제하는데, 자료함은 100MB까지 받는다. 마무리(③)는 우리가 직접 부른다 —
 * 음원 길이를 함께 실어 보내야 하기 때문이기도 하다.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ShareQrCard from '@/components/share/ShareQrCard';
import { useT } from '@/lib/i18n/useT';
import { uploadFilesDirect, UploadError } from '@/lib/uploadClient';
import { generatePasscode, isValidPasscode } from '@/lib/resources/passcode';
import type { ResourceAccessEntry, ResourceItem } from '@/types/resources';

/** 화면이 다루는 자료함 — passcodeEnc는 이 경계를 넘어오지 않는다 */
interface SafeVault {
  id: number;
  code: string;
  title: string;
  note: string | null;
  eventId: number | null;
  allowDownload: boolean;
  allowEmail: boolean;
  active: boolean;
  expiresAt: string | null;
  linkEpoch: number;
  createdAt: string;
}

interface Props {
  vault: SafeVault;
  items: ResourceItem[];
  log: ResourceAccessEntry[];
  /** 복호된 비밀번호. AUTH_SECRET이 바뀌었으면 null */
  passcode: string | null;
}

const MAX_BYTES = 100 * 1024 * 1024;

const ACTION_LABEL: Record<string, string> = {
  unlock: '열림',
  unlock_fail: '실패',
  link_open: '링크로 열림',
  play: '재생',
  download: '내려받음',
  email_sent: '메일 보냄',
  passcode_view: '비밀번호 확인',
};

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 ** 2).toFixed(1)}MB`;
  return `${Math.max(1, Math.ceil(bytes / 1024))}KB`;
}

function formatWhen(iso: string): string {
  const at = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
  if (Number.isNaN(at.getTime())) return iso;
  return at.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
}

/** 음원 길이는 브라우저가 읽는다 — 서버는 오디오를 열지 않는다 */
function readDuration(file: File): Promise<number | null> {
  if (!file.type.startsWith('audio/')) return Promise.resolve(null);
  return new Promise((resolve) => {
    const el = document.createElement('audio');
    const url = URL.createObjectURL(file);
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    el.preload = 'metadata';
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? Math.round(el.duration) : null);
    el.onerror = () => done(null);
    el.src = url;
  });
}

export default function VaultDetail({ vault, items, log, passcode }: Props) {
  const t = useT();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement | null>(null);

  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const publicPath = `/${vault.code}`;

  const say = useCallback((ok: boolean, text: string) => setNote({ ok, text }), []);

  const call = useCallback(
    async (url: string, init: RequestInit): Promise<boolean> => {
      setBusy(true);
      setNote(null);
      try {
        const res = await fetch(url, init);
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          say(false, data?.error ?? t('admin.common.saveFailed', '저장하지 못했습니다.'));
          return false;
        }
        router.refresh();
        return true;
      } catch {
        say(false, t('admin.common.saveFailed', '저장하지 못했습니다.'));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [router, say, t]
  );

  const patchVault = useCallback(
    (body: Record<string, unknown>) =>
      call(`/api/admin/resources/${vault.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    [call, vault.id]
  );

  const upload = useCallback(
    async (files: File[]) => {
      if (!files.length) return;

      const tooBig = files.filter((f) => f.size > MAX_BYTES);
      if (tooBig.length) {
        say(
          false,
          t('admin.resources.tooBig', '100MB를 넘는 파일은 올릴 수 없습니다: {name}').replace(
            '{name}',
            tooBig[0].name
          )
        );
        return;
      }

      setBusy(true);
      setNote(null);
      try {
        const durations: Record<string, number> = {};
        for (const file of files) {
          const seconds = await readDuration(file);
          if (seconds !== null) durations[file.name] = seconds;
        }

        const refs = await uploadFilesDirect(
          `/api/admin/resources/${vault.id}/items`,
          files,
          (done, total) => setProgress(`${done} / ${total}`),
          (index, sent, total) => {
            const pct = total > 0 ? Math.round((sent / total) * 100) : 0;
            setProgress(`${files[index]?.name ?? ''} ${pct}%`);
          }
        );

        const res = await fetch(`/api/admin/resources/${vault.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploads: refs, durations: JSON.stringify(durations) }),
        });
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          say(false, data?.error ?? t('admin.resources.uploadFailed', '올리지 못했습니다.'));
          return;
        }
        say(true, t('admin.resources.uploaded', '올렸습니다.'));
        router.refresh();
      } catch (error) {
        const message =
          error instanceof UploadError
            ? error.message
            : t('admin.resources.uploadFailed', '올리지 못했습니다.');
        say(false, message);
      } finally {
        setProgress('');
        setBusy(false);
        if (fileInput.current) fileInput.current.value = '';
      }
    },
    [router, say, t, vault.id]
  );

  const move = useCallback(
    (index: number, delta: number) => {
      const next = [...items];
      const target = index + delta;
      if (target < 0 || target >= next.length) return;
      [next[index], next[target]] = [next[target], next[index]];
      void call(`/api/admin/resources/${vault.id}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: next.map((item) => item.id) }),
      });
    },
    [call, items, vault.id]
  );

  const rename = useCallback(
    async (itemId: number) => {
      const title = editingTitle.trim();
      if (!title) return;
      const ok = await call(`/api/admin/resources/${vault.id}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (ok) setEditingId(null);
    },
    [call, editingTitle, vault.id]
  );

  const removeItem = useCallback(
    (item: ResourceItem) => {
      if (!window.confirm(`「${item.title}」을(를) 지울까요? 되돌릴 수 없습니다.`)) return;
      void call(`/api/admin/resources/${vault.id}/items/${item.id}`, { method: 'DELETE' });
    },
    [call, vault.id]
  );

  const totalBytes = useMemo(
    () => items.reduce((sum, item) => sum + item.sizeBytes, 0),
    [items]
  );

  return (
    <div className="rvd">
      {note ? (
        <p className={`rvd-note${note.ok ? ' is-ok' : ' is-bad'}`} role="status">
          {note.text}
        </p>
      ) : null}

      {/* ── 번호와 QR: 이 화면을 여는 첫 번째 이유 ── */}
      <section className="rvd-card rvd-card--head">
        <div className="rvd-head__left">
          <p className="rvd-head__label">{t('admin.resources.code', '번호')}</p>
          <p className="rvd-head__code">{vault.code}</p>
          <p className="rvd-head__url">ktdoc.org/{vault.code}</p>

          <div className="rvd-pass">
            <span className="rvd-pass__label">{t('admin.resources.passcode', '비밀번호')}</span>
            {passcode === null ? (
              <span className="rvd-pass__broken">
                {t('admin.resources.passcodeBroken', '읽을 수 없습니다 — 다시 설정해 주세요.')}
              </span>
            ) : (
              <>
                <span className="rvd-pass__value">{showPass ? passcode : '••••••'}</span>
                <button
                  type="button"
                  className="admin-btn admin-btn-outline rvd-pass__btn"
                  onClick={() => setShowPass((v) => !v)}
                >
                  {showPass ? t('admin.common.hide', '가리기') : t('admin.common.show', '보기')}
                </button>
              </>
            )}
            <button
              type="button"
              className="admin-btn admin-btn-outline rvd-pass__btn"
              disabled={busy}
              onClick={() => {
                const next = generatePasscode();
                if (!isValidPasscode(next)) return;
                if (
                  !window.confirm(
                    '비밀번호를 새로 만들면 이미 알려 드린 분들은 들어올 수 없습니다. 계속할까요?'
                  )
                )
                  return;
                void patchVault({ passcode: next });
              }}
            >
              {t('admin.resources.regen', '새로 뽑기')}
            </button>
          </div>
        </div>

        <div className="rvd-head__qr">
          <ShareQrCard
            title={vault.title}
            path={publicPath}
            size={170}
            hint={t('admin.resources.qrHint', '공연장에서 이 QR을 스캔하면 열립니다.')}
          />
        </div>
      </section>

      {/* ── 파일 ── */}
      <section className="rvd-card">
        <div className="rvd-card__head">
          <h2 className="rvd-card__title">
            {t('admin.resources.files', '파일')} ({items.length})
          </h2>
          <span className="rvd-card__meta">{formatBytes(totalBytes)}</span>
        </div>

        {items.length === 0 ? (
          <p className="rvd-empty">
            {t('admin.resources.noFiles', '아직 파일이 없습니다. 음원을 올려 주세요.')}
          </p>
        ) : (
          <ol className="rvd-items">
            {items.map((item, index) => (
              <li className="rvd-item" key={item.id}>
                <span className="rvd-item__no">{index + 1}</span>
                <span className="rvd-item__body">
                  {editingId === item.id ? (
                    <span className="rvd-item__edit">
                      <input
                        className="rva-field__input"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void rename(item.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="admin-btn admin-btn-primary"
                        onClick={() => rename(item.id)}
                        disabled={busy}
                      >
                        {t('admin.common.save', '저장')}
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="rvd-item__title"
                      onClick={() => {
                        setEditingId(item.id);
                        setEditingTitle(item.title);
                      }}
                      title={t('admin.resources.renameHint', '눌러서 이름 바꾸기')}
                    >
                      {item.title}
                    </button>
                  )}
                  <span className="rvd-item__meta">
                    {item.fileName} · {formatBytes(item.sizeBytes)}
                    {item.durationSeconds
                      ? ` · ${Math.floor(item.durationSeconds / 60)}:${String(item.durationSeconds % 60).padStart(2, '0')}`
                      : ''}
                  </span>
                </span>
                <span className="rvd-item__acts">
                  <button
                    type="button"
                    className="rvd-mini"
                    onClick={() => move(index, -1)}
                    disabled={busy || index === 0}
                    aria-label={t('admin.resources.moveUp', '위로')}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="rvd-mini"
                    onClick={() => move(index, 1)}
                    disabled={busy || index === items.length - 1}
                    aria-label={t('admin.resources.moveDown', '아래로')}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="rvd-mini rvd-mini--danger"
                    onClick={() => removeItem(item)}
                    disabled={busy}
                    aria-label={t('admin.common.delete', '삭제')}
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ol>
        )}

        <div className="rvd-upload">
          <input
            ref={fileInput}
            type="file"
            multiple
            accept="audio/*,image/*,application/pdf"
            className="rvd-upload__input"
            disabled={busy}
            onChange={(e) => upload(Array.from(e.target.files ?? []))}
          />
          <p className="rvd-upload__hint">
            {t(
              'admin.resources.uploadHint',
              '음원·PDF·이미지를 올릴 수 있습니다. 한 개당 100MB까지.'
            )}
          </p>
          {progress ? <p className="rvd-upload__progress">{progress}</p> : null}
        </div>
      </section>

      {/* ── 설정 ── */}
      <section className="rvd-card">
        <h2 className="rvd-card__title">{t('admin.resources.settings', '설정')}</h2>

        <label className="rva-check">
          <input
            type="checkbox"
            checked={vault.active}
            disabled={busy}
            onChange={(e) => patchVault({ active: e.target.checked })}
          />
          <span>{t('admin.resources.activeLabel', '열어 두기 (끄면 즉시 막힙니다)')}</span>
        </label>

        <label className="rva-check">
          <input
            type="checkbox"
            checked={vault.allowDownload}
            disabled={busy}
            onChange={(e) => patchVault({ allowDownload: e.target.checked })}
          />
          <span>{t('admin.resources.allowDownload', '내려받기 허용')}</span>
        </label>

        <label className="rva-check">
          <input
            type="checkbox"
            checked={vault.allowEmail}
            disabled={busy}
            onChange={(e) => patchVault({ allowEmail: e.target.checked })}
          />
          <span>{t('admin.resources.allowEmail', '이메일로 받기 허용')}</span>
        </label>

        <div className="rvd-revoke">
          <button
            type="button"
            className="admin-btn admin-btn-outline"
            disabled={busy}
            onClick={() => {
              if (
                !window.confirm(
                  '이미 메일로 보낸 받기 링크가 전부 죽습니다. 번호와 비밀번호는 그대로입니다. 계속할까요?'
                )
              )
                return;
              void patchVault({ revokeLinks: true });
            }}
          >
            {t('admin.resources.revokeLinks', '받기 링크 모두 무효화')}
          </button>
          <p className="rvd-upload__hint">
            {t(
              'admin.resources.revokeHint',
              '메일로 나간 링크만 죽습니다. 번호와 비밀번호로는 계속 열 수 있습니다.'
            )}
          </p>
        </div>
      </section>

      {/* ── 접근 기록 ── */}
      <section className="rvd-card">
        <h2 className="rvd-card__title">{t('admin.resources.log', '접근 기록')}</h2>
        {log.length === 0 ? (
          <p className="rvd-empty">{t('admin.resources.noLog', '아직 기록이 없습니다.')}</p>
        ) : (
          <table className="rvd-log">
            <thead>
              <tr>
                <th>{t('admin.resources.logWhen', '시각')}</th>
                <th>{t('admin.resources.logWhat', '무엇')}</th>
                <th>{t('admin.resources.logWho', '누구(지문)')}</th>
                <th>{t('admin.resources.logDetail', '내용')}</th>
              </tr>
            </thead>
            <tbody>
              {log.map((row) => (
                <tr key={row.id}>
                  <td>{formatWhen(row.createdAt)}</td>
                  <td>{ACTION_LABEL[row.action] ?? row.action}</td>
                  <td className="rvd-log__ip">{row.ipHash?.slice(0, 8) ?? '—'}</td>
                  <td className="rvd-log__detail">{row.detail ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
