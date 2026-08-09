'use client';

/**
 * AiEventFill — 포스터/텍스트에서 AI로 공연 정보를 추출해 폼을 채우는 패널.
 *
 * 사진+텍스트, 사진만, 텍스트만 — 어느 조합이든 동작한다. 추출 결과는
 * onApply로 부모(EventForm)에 전달되어 폼에 채워지고, 관리자가 검토·수정한 뒤
 * 저장한다(추출값은 초안일 뿐 저장이 아니다).
 *
 * 이미지는 전송 전 캔버스로 긴 변 1600px JPEG로 축소한다 — 토큰 비용과
 * 요청 크기를 줄이고, 포스터 텍스트 인식에는 충분한 해상도다.
 */

import { useRef, useState } from 'react';
import { useT } from '@/lib/i18n/useT';
import type { EventCategory, ExtractedEventInfo } from '@/types/gallery';

interface AiEventFillProps {
  categories: EventCategory[];
  onApply: (data: ExtractedEventInfo) => void;
  /**
   * 포스터 파일·"공연 사진으로도 등록" 체크 상태가 바뀔 때마다 부모에 보고.
   * 체크된 경우 부모(EventForm)가 저장 시 원본 파일을 공연 사진으로 업로드한다.
   */
  onPosterChange?: (file: File | null, attach: boolean) => void;
}

const MAX_EDGE = 1600;

/** 파일 → 축소된 JPEG base64. 디코드 실패(HEIC 등) 시 원본 그대로 시도한다. */
async function fileToBase64(file: File): Promise<{ dataBase64: string; mimeType: string }> {
  const readAsBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
      reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));  // 내부 오류 — 화면에는 아래 문구로 나간다
      reader.readAsDataURL(blob);
    });

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 미지원');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    );
    if (!blob) throw new Error('이미지 변환 실패');
    return { dataBase64: await readAsBase64(blob), mimeType: 'image/jpeg' };
  } catch {
    // 브라우저가 디코드하지 못하는 형식은 원본을 그대로 보낸다(서버 크기 검사 있음)
    return { dataBase64: await readAsBase64(file), mimeType: file.type || 'image/jpeg' };
  }
}

export default function AiEventFill({ categories, onApply, onPosterChange }: AiEventFillProps) {
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [text, setText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  // 실패 원인 원문(모델·종료 사유·토큰·응답 앞부분). 기본은 접혀 있고 '자세히'로 펼친다.
  const [errorDetail, setErrorDetail] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  // 포스터를 공연 사진으로도 등록할지 (기본 해제 — 저장 시 부모가 업로드)
  const [attachAsPhoto, setAttachAsPhoto] = useState(false);

  const pickFile = (f: File | null) => {
    setFile(f);
    setDone(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : '');
    // 파일이 없어지면 등록 체크도 무의미 — 해제하고 부모에 보고
    const nextAttach = f ? attachAsPhoto : false;
    if (!f) setAttachAsPhoto(false);
    onPosterChange?.(f, nextAttach);
  };

  const toggleAttach = (checked: boolean) => {
    setAttachAsPhoto(checked);
    onPosterChange?.(file, checked);
  };

  const handleExtract = async () => {
    if (!file && !text.trim()) {
      setError(
        t('admin.aiFill.needInput', '포스터 이미지 또는 안내 텍스트 중 하나 이상을 입력해 주세요.')
      );
      return;
    }
    setExtracting(true);
    setError('');
    setErrorDetail('');
    setWarnings([]);
    setDone(false);
    try {
      const image = file ? await fileToBase64(file) : null;
      const res = await fetch('/api/admin/ai/extract-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: image?.dataBase64,
          mimeType: image?.mimeType,
          text: text.trim() || undefined,
          categories: categories.map((c) => ({ id: c.id, name: `${c.name_ko} / ${c.name_en}` })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // 서버가 진단 정보를 보냈으면 접이식으로 보여줄 수 있게 보관한다
        if (data.detail) {
          setErrorDetail(
            typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail, null, 2)
          );
        }
        throw new Error(data.error || t('admin.aiFill.failed', '추출에 실패했습니다.'));
      }
      onApply(data.data as ExtractedEventInfo);
      setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.aiFill.failed', '추출에 실패했습니다.'));
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="admin-form-section ai-fill">
      <h3 className="admin-form-section-title">{t('admin.aiFill.title', 'AI로 정보 채우기')}</h3>
      <p className="admin-form-help">
        {t(
          'admin.aiFill.help',
          '공연 포스터 이미지나 안내 텍스트를 넣으면 아래 폼에 제목·날짜·장소·소개(한/영)를 자동으로 채웁니다. 이미지와 텍스트 중 하나만 있어도 됩니다. 채워진 값은 초안이니 검토 후 수정해서 저장하세요.'
        )}
      </p>

      <div className="ai-fill-grid">
        {/* 포스터 이미지 + 사진 등록 옵션 */}
        <div className="ai-fill-left">
        <div
          className="ai-fill-drop"
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const dropped = e.dataTransfer.files?.[0];
            if (dropped && dropped.type.startsWith('image/')) pickFile(dropped);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          {previewUrl ? (
            <>
              {/* 로컬 미리보기(objectURL)라 next/image 최적화 대상이 아니다 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={t('admin.aiFill.previewAlt', '포스터 미리보기')}
                className="ai-fill-preview"
              />
              <button
                type="button"
                className="ai-fill-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  pickFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                {t('admin.aiFill.removeImage', '이미지 제거')}
              </button>
            </>
          ) : (
            <span className="ai-fill-drop-hint">
              {t('admin.aiFill.pickPoster', '포스터 이미지 선택')}
              <small>{t('admin.aiFill.pickHint', '클릭하거나 파일을 끌어다 놓으세요')}</small>
            </span>
          )}
        </div>

        {file && (
          <label className="ai-fill-attach">
            <input
              type="checkbox"
              checked={attachAsPhoto}
              onChange={(e) => toggleAttach(e.target.checked)}
            />
            <span>
              {t(
                'admin.aiFill.attachPoster',
                '이 포스터를 공연 사진으로도 등록 (저장 시 원본이 업로드됩니다)'
              )}
            </span>
          </label>
        )}
        </div>

        {/* 안내 텍스트 */}
        <textarea
          className="admin-form-input ai-fill-text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setDone(false);
          }}
          placeholder={
            t(
              'admin.aiFill.textPlaceholder',
              '안내 텍스트 붙여넣기 (선택)\n\n공지 문자·이메일·웹페이지 등에서 복사한 공연 안내문을 그대로 붙여 넣으면 함께 분석합니다.'
            )
          }
          rows={8}
        />
      </div>

      <div className="ai-fill-actions">
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          disabled={extracting}
          onClick={handleExtract}
        >
          {extracting
            ? t('admin.aiFill.extracting', 'AI 분석 중... (수십 초 걸릴 수 있음)')
            : t('admin.aiFill.extract', 'AI로 정보 추출')}
        </button>
        {done && !error && (
          <span className="ai-fill-done">
            {t('admin.aiFill.done', '아래 폼에 채웠습니다 — 검토 후 저장하세요.')}
          </span>
        )}
      </div>

      {error && (
        <div className="admin-inline-error ai-fill-feedback">
          <span>{error}</span>
          {/* 원인 원문은 기본으로 감춘다 — 필요할 때만 펼쳐서 디버깅에 쓴다 */}
          {errorDetail && (
            <details className="ai-fill-detail">
              <summary>{t('admin.aiFill.detail', '자세히 (기술 정보)')}</summary>
              <pre>{errorDetail}</pre>
            </details>
          )}
        </div>
      )}
      {warnings.length > 0 && (
        <ul className="ai-fill-warnings">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
