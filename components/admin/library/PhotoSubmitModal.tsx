'use client';

/**
 * PhotoSubmitModal — 이벤트/수업 상세에서 사진을 제출하는 모달
 *
 * 버튼을 누르면 모달이 열리고, 사진을 골라 POST /api/library/photos로 제출한다.
 * eventId 또는 programId 중 하나를 전달하면 해당 항목에 연결되며, 제출 사진은 항상 비공개로
 * 보관함에 들어가 운영진 검토 후 공개된다(서버에서 강제).
 */

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadImageFiles, MAX_UPLOAD_FILE_MB, type UploadResponse } from '@/lib/uploadClient';

interface PhotoSubmitModalProps {
  eventId?: number;
  programId?: number;
  buttonLabel?: string;
}

export default function PhotoSubmitModal({
  eventId,
  programId,
  buttonLabel = '사진 올리기',
}: PhotoSubmitModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneCount, setDoneCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  function close() {
    if (busy) return;
    setOpen(false);
  }

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const fields: Record<string, string> = {};
      if (eventId) fields.eventId = String(eventId);
      if (programId) fields.programId = String(programId);

      const results = await uploadImageFiles<UploadResponse<{ count?: number }>>(
        '/api/library/photos',
        Array.from(files),
        { fields, failMessage: '사진 제출에 실패했습니다.' }
      );
      setDoneCount((n) => n + results.reduce((sum, r) => sum + (r.data?.count ?? 0), 0));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '사진 제출에 실패했습니다.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <>
      <button
        type="button"
        className="admin-btn admin-btn-primary"
        onClick={() => {
          setOpen(true);
          setDoneCount(0);
          setError(null);
        }}
      >
        📷 {buttonLabel}
      </button>

      {open && (
        <div className="photo-modal-scrim" onClick={close}>
          <div
            className="photo-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="사진 제출"
          >
            <div className="photo-modal-head">
              <h3>사진 올리기</h3>
              <button type="button" className="photo-modal-close" onClick={close} aria-label="닫기">
                ✕
              </button>
            </div>
            <p className="admin-form-help">
              여기서 찍은 사진을 올리면 운영진 검토 후 공개됩니다. 한 번에 여러 장 선택할 수
              있어요. (장당 최대 {MAX_UPLOAD_FILE_MB}MB)
            </p>

            {error && <div className="admin-alert admin-alert-error admin-alert-sm">{error}</div>}
            {doneCount > 0 && (
              <div className="admin-alert admin-alert-success admin-alert-sm">
                {doneCount}장이 제출되었습니다. 운영진 검토 후 공개됩니다.
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => upload(e.target.files)}
            />
            <button
              type="button"
              className="photo-modal-drop"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              {busy ? '올리는 중…' : '클릭해서 사진 선택'}
            </button>

            <div className="photo-modal-actions">
              <button
                type="button"
                className="admin-btn admin-btn-outline"
                onClick={close}
                disabled={busy}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
