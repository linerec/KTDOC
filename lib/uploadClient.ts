/**
 * 이미지 업로드 클라이언트 공통 모듈 (브라우저 전용).
 *
 * 사이트의 모든 이미지 업로드는 이 모듈을 거친다 — 그래서 업로드가 지나는 길을
 * 바꿀 때 화면 9곳을 건드릴 필요가 없다. 서버 측 공통 지점은
 * lib/r2/readUploads.ts(라우트가 파일을 받는 입구)다.
 *
 * ## 파일은 더 이상 우리 서버를 지나지 않는다
 *
 * 예전에는 사진을 우리 API로 보내고, 그 API가 R2에 올렸다. 그런데 그 문이
 * **4.5MB**였다(Vercel 함수 요청 본문 한도. 유료 플랜도 같다). 폰 사진 한 장이
 * 그보다 크거나, 작은 사진 서너 장이 한 요청에 묶이는 것만으로 413이 났다.
 * 올리는 분에게는 "용량이 커서 못 받았다"는, 무엇을 어떻게 줄이라는지 알 수 없는
 * 실패로 보였다.
 *
 * 지금은 세 걸음이고, **화면에서는 아무것도 달라지지 않는다**:
 *
 *   ① 서명 받기   POST /api/uploads/sign  (파일 이름·크기만 오간다)
 *   ② R2로 직접 PUT (우리 서버를 지나지 않는다 → 크기 제한 없음)
 *   ③ 원래 라우트에 "올렸습니다"(JSON) → 서버가 확인하고 표시용으로 정규화
 *
 * 사진을 고르는 사람이 하는 일은 예전과 같다: 고르고, 기다린다.
 */

import { MAX_UPLOAD_FILE_BYTES, MAX_UPLOAD_FILE_MB } from '@/lib/uploadLimits';

export { MAX_UPLOAD_FILE_BYTES, MAX_UPLOAD_FILE_MB };

/**
 * ③(마무리)를 한 번에 몇 장씩 보낼지.
 *
 * 마무리 요청은 서버가 R2에서 원본을 당겨와 표시용으로 줄이는 일을 한다 —
 * 한 요청에 너무 많이 몰면 함수 시간이 길어진다. 파일 자체는 이미 ②에서
 * 올라갔으므로 여기서 나누는 것은 **처리량**이지 용량이 아니다.
 */
const FINALIZE_BATCH = 3;

/** ①(서명)을 한 번에 요청하는 최대 장수 — 서버 라우트의 상한과 맞춘다. */
const SIGN_BATCH = 40;

/** 업로드 실패. status에 HTTP 상태 코드를 보존한다(요청이 서버에 닿은 경우). */
export class UploadError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'UploadError';
    this.status = status;
  }
}

/** 사람이 읽을 파일 크기 표기 */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${Math.max(1, Math.ceil(bytes / 1024))}KB`;
}

/** 서버 업로드 API 공통 응답 봉투 */
export interface UploadResponse<TData = unknown> {
  success: boolean;
  data?: TData;
  error?: string;
}

export interface UploadOptions {
  /** 파일을 담을 필드명. 새 경로에서는 쓰이지 않는다(호환을 위해 남긴다). */
  fieldName?: string;
  /** 파일과 함께 보낼 추가 필드 (나눠 보낼 때 매 요청에 함께 실린다) */
  fields?: Record<string, string>;
  /** 서버가 error 메시지 없이 실패를 알릴 때 쓸 기본 메시지 */
  failMessage?: string;
  /** 진행 콜백 — (완료 장수, 전체 장수) */
  onProgress?: (uploadedFiles: number, totalFiles: number) => void;
}

/** FileList/배열에서 이미지 파일만 추려낸다 */
export function pickImageFiles(files: FileList | File[] | null): File[] {
  if (!files) return [];
  return Array.from(files).filter((file) => file.type.startsWith('image/'));
}

/** 업로드 전 파일별 용량 검사 — 초과 파일을 이름·크기와 함께 알려 미리 조치하게 한다 */
function assertFileSizes(files: File[]): void {
  const tooBig = files.filter((file) => file.size > MAX_UPLOAD_FILE_BYTES);
  if (tooBig.length === 0) return;

  const listed = tooBig
    .slice(0, 3)
    .map((file) => `${file.name} (${formatFileSize(file.size)})`)
    .join(', ');
  const rest = tooBig.length > 3 ? ` 외 ${tooBig.length - 3}장` : '';
  throw new UploadError(
    `${MAX_UPLOAD_FILE_MB}MB를 넘는 사진은 올릴 수 없습니다: ${listed}${rest}. ` +
      '사진 크기를 줄인 뒤 다시 시도해주세요.'
  );
}

interface Ticket {
  uploadUrl: string;
  ticket: string;
  name: string;
  contentType: string;
}

/** ① 서명 받기 — 파일은 보내지 않는다(이름·형식·크기만). */
async function requestTickets(target: string, files: File[]): Promise<Ticket[]> {
  const res = await fetch('/api/uploads/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target,
      files: files.map((f) => ({
        name: f.name,
        type: f.type || 'application/octet-stream',
        size: f.size,
      })),
    }),
  });
  const data = (await res.json().catch(() => null)) as UploadResponse<{
    tickets: Ticket[];
  }> | null;

  if (!res.ok || !data?.success || !data.data?.tickets) {
    throw new UploadError(data?.error || '업로드를 시작하지 못했습니다.', res.status);
  }
  return data.data.tickets;
}

/**
 * ② R2로 직접 올린다.
 *
 * fetch 대신 XHR을 쓰는 이유는 진행률 때문이다 — 큰 사진 한 장을 올릴 때
 * 화면이 멈춘 것처럼 보이면 사람은 새로고침을 누른다.
 */
function putToR2(
  file: File,
  ticket: Ticket,
  onBytes?: (sent: number, total: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', ticket.uploadUrl, true);
    // 서명에 묶인 값과 정확히 같아야 한다 — 다르면 R2가 403으로 거절한다
    xhr.setRequestHeader('Content-Type', ticket.contentType);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onBytes?.(e.loaded, e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else
        reject(
          new UploadError(
            `사진을 저장소에 올리지 못했습니다 (오류 ${xhr.status}). 잠시 후 다시 시도해주세요.`,
            xhr.status
          )
        );
    };
    xhr.onerror = () =>
      reject(new UploadError('연결이 끊어져 사진을 올리지 못했습니다. 다시 시도해주세요.'));
    xhr.onabort = () => reject(new UploadError('업로드가 중단되었습니다.'));
    xhr.send(file);
  });
}

/** ③ 마무리 — 올린 사실을 원래 라우트에 알린다(파일이 아니라 티켓만 간다). */
async function finalize<T>(
  endpoint: string,
  batch: { ticket: string; name: string }[],
  fields: Record<string, string> | undefined,
  failMessage: string
): Promise<T> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploads: batch, ...(fields ?? {}) }),
  });
  const data = await res.json().catch(() => null);
  if (!data) {
    throw new UploadError(
      `업로드 마무리에 실패했습니다 (오류 ${res.status}). 잠시 후 다시 시도해주세요.`,
      res.status
    );
  }
  if (!data.success) throw new UploadError(data.error || failMessage, res.status);
  return data as T;
}

/** 마무리 요청에 실어 보낼 한 건 — "이 파일을 올렸습니다" */
export interface UploadedRef {
  ticket: string;
  name: string;
}

/**
 * ①②만 한다 — 서명받아 R2로 올리고, 티켓을 돌려준다.
 *
 * 마무리(③)를 직접 만들어야 하는 자리를 위한 것이다. 예를 들어 메일 보내기는
 * 첨부만 따로 마무리할 수 없다 — 제목·본문·받는 사람과 **한 번에** 가야
 * "보냈다"가 성립한다.
 */
export async function uploadFilesDirect(
  target: string,
  files: File[],
  onProgress?: (done: number, total: number) => void,
  /**
   * 지금 올라가는 파일 한 건의 바이트 진행. 100MB짜리 음원 하나를 올릴 때
   * "1/1"만 보이면 화면이 멈춘 것처럼 보이고, 사람은 새로고침을 누른다.
   */
  onBytes?: (index: number, sent: number, total: number) => void
): Promise<UploadedRef[]> {
  if (!files.length) return [];

  const tickets: Ticket[] = [];
  for (let i = 0; i < files.length; i += SIGN_BATCH) {
    tickets.push(...(await requestTickets(target, files.slice(i, i + SIGN_BATCH))));
  }
  if (tickets.length !== files.length) {
    throw new UploadError('업로드를 시작하지 못했습니다. 다시 시도해주세요.');
  }

  const refs: UploadedRef[] = [];
  for (let i = 0; i < files.length; i++) {
    await putToR2(
      files[i],
      tickets[i],
      onBytes ? (sent, total) => onBytes(i, sent, total) : undefined
    );
    refs.push({ ticket: tickets[i].ticket, name: files[i].name });
    onProgress?.(i + 1, files.length);
  }
  return refs;
}

/**
 * 다중 이미지 업로드.
 * 반환값은 마무리 요청 단위 응답의 배열 — 호출부는 flatMap/reduce로 합쳐 쓴다.
 */
export async function uploadImageFiles<T = UploadResponse>(
  endpoint: string,
  files: File[],
  options: UploadOptions = {}
): Promise<T[]> {
  const { fields, failMessage = '업로드에 실패했습니다.', onProgress } = options;

  assertFileSizes(files);
  if (!files.length) return [];

  onProgress?.(0, files.length);

  // ① 서명 — 장수가 많으면 나눠 받는다
  const tickets: Ticket[] = [];
  for (let i = 0; i < files.length; i += SIGN_BATCH) {
    const slice = files.slice(i, i + SIGN_BATCH);
    tickets.push(...(await requestTickets(endpoint, slice)));
  }
  if (tickets.length !== files.length) {
    throw new UploadError('업로드를 시작하지 못했습니다. 다시 시도해주세요.');
  }

  // ② R2로 직접 — 한 장씩 순서대로(폰 회선에서 동시에 여러 장을 밀면 더 느리다)
  const uploaded: { ticket: string; name: string }[] = [];
  const results: T[] = [];
  let done = 0;

  for (let i = 0; i < files.length; i++) {
    await putToR2(files[i], tickets[i]);
    uploaded.push({ ticket: tickets[i].ticket, name: files[i].name });
    done += 1;
    onProgress?.(done, files.length);

    // ③ 몇 장 모이면 마무리 — 마지막 장이면 남은 것을 모두
    const last = i === files.length - 1;
    if (uploaded.length >= FINALIZE_BATCH || last) {
      const batch = uploaded.splice(0, uploaded.length);
      try {
        results.push(await finalize<T>(endpoint, batch, fields, failMessage));
      } catch (err) {
        if (results.length > 0 && err instanceof UploadError) {
          // 앞선 묶음은 이미 저장됐다 — 몇 장까지 됐는지 함께 알린다
          throw new UploadError(
            `${done - batch.length}장은 저장됐지만 이후가 실패했습니다 — ${err.message}`,
            err.status
          );
        }
        throw err;
      }
    }
  }

  return results;
}

/** 단일 이미지 업로드 */
export async function uploadImageFile<T = UploadResponse>(
  endpoint: string,
  file: File,
  options: UploadOptions = {}
): Promise<T> {
  const results = await uploadImageFiles<T>(endpoint, [file], options);
  return results[0];
}
