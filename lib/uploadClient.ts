/**
 * 이미지 업로드 클라이언트 공통 모듈 (브라우저 전용).
 *
 * 사이트의 모든 이미지 업로드는 이 모듈을 거친다 — 전처리(리사이즈·재인코딩),
 * 전송 방식(청크 분할·재시도), 에러 처리를 바꿀 때 이 파일만 수정하면
 * 전체 업로드 UI에 일괄 적용된다. 서버 측 공통 지점은 lib/r2/upload.ts(uploadToR2).
 * 향후 파이프라인 계획: docs/operations/image-optimization-strategy.md §3-1
 */

import { MAX_UPLOAD_FILE_BYTES, MAX_UPLOAD_FILE_MB } from '@/lib/uploadLimits';

export { MAX_UPLOAD_FILE_BYTES, MAX_UPLOAD_FILE_MB };

/** 요청 1건에 담는 파일 용량 합계 상한 (바디 한도 대응 청크 분할 기준) */
const MAX_REQUEST_BYTES = MAX_UPLOAD_FILE_BYTES;

/** 요청 1건에 담는 최대 장수 (서버 벌크 라우트의 요청당 장수 제한과 정합) */
const MAX_FILES_PER_REQUEST = 20;

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
  /** 파일을 담을 FormData 필드명 (다중 기본 'files', 단일 기본 'file') */
  fieldName?: string;
  /** 파일과 함께 보낼 추가 필드 (청크 분할 시 매 요청에 함께 실린다) */
  fields?: Record<string, string>;
  /** 서버가 error 메시지 없이 실패를 알릴 때 쓸 기본 메시지 */
  failMessage?: string;
  /** 진행 콜백 — (완료 장수, 전체 장수). 청크 경계마다 호출된다 */
  onProgress?: (uploadedFiles: number, totalFiles: number) => void;
}

/** FileList/배열에서 이미지 파일만 추려낸다 */
export function pickImageFiles(files: FileList | File[] | null): File[] {
  if (!files) return [];
  return Array.from(files).filter((file) => file.type.startsWith('image/'));
}

/**
 * 업로드 전 이미지 전처리 훅 — 지금은 원본을 그대로 통과시킨다.
 * 클라이언트 리사이즈·재인코딩·HEIC 변환은 반드시 이 함수 안에서만 구현한다
 * (전략 문서 §3-1: 장변 2560px 프리스케일 + JPEG q0.9, HEIC 폴백 등).
 */
async function prepareImageFile(file: File): Promise<File> {
  return file;
}

async function postFormData<T>(
  endpoint: string,
  formData: FormData,
  failMessage: string
): Promise<T> {
  const res = await fetch(endpoint, { method: 'POST', body: formData });

  // 요청 자체가 서버에 닿지 못하면(용량 초과 등) 응답이 JSON이 아닐 수 있다
  const data = await res.json().catch(() => null);

  if (!data) {
    throw new UploadError(
      res.status === 413
        ? '사진 용량이 너무 커서 서버가 받지 못했습니다. 장수를 나누거나 사진 크기를 줄여 다시 올려주세요.'
        : `업로드 요청이 실패했습니다 (오류 ${res.status}). 잠시 후 다시 시도해주세요.`,
      res.status
    );
  }
  if (!data.success) {
    throw new UploadError(data.error || failMessage, res.status);
  }
  return data as T;
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

/** 파일들을 요청 단위(용량 합계·장수 상한)로 묶는다 */
function packChunks(files: File[]): File[][] {
  const chunks: File[][] = [];
  let current: File[] = [];
  let currentBytes = 0;

  for (const file of files) {
    const overSize = currentBytes + file.size > MAX_REQUEST_BYTES;
    const overCount = current.length >= MAX_FILES_PER_REQUEST;
    if (current.length > 0 && (overSize || overCount)) {
      chunks.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(file);
    currentBytes += file.size;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/**
 * 다중 이미지 업로드.
 * 파일별 용량을 먼저 검사하고, 합계가 요청 한도를 넘으면 여러 요청으로 나눠 보낸다.
 * 반환값은 요청 단위 응답의 배열 — 호출부는 flatMap/reduce로 합쳐 쓴다.
 */
export async function uploadImageFiles<T = UploadResponse>(
  endpoint: string,
  files: File[],
  options: UploadOptions = {}
): Promise<T[]> {
  const { fieldName = 'files', fields, failMessage = '업로드에 실패했습니다.', onProgress } = options;

  const prepared: File[] = [];
  for (const file of files) {
    prepared.push(await prepareImageFile(file));
  }
  assertFileSizes(prepared);

  const chunks = packChunks(prepared);
  const results: T[] = [];
  let uploaded = 0;
  onProgress?.(0, prepared.length);

  for (const chunk of chunks) {
    const formData = new FormData();
    for (const file of chunk) {
      formData.append(fieldName, file);
    }
    if (fields) {
      for (const [key, value] of Object.entries(fields)) {
        formData.append(key, value);
      }
    }

    try {
      results.push(await postFormData<T>(endpoint, formData, failMessage));
    } catch (err) {
      // 앞선 청크는 이미 서버에 반영됐으므로, 몇 장까지 올라갔는지 함께 알린다
      if (uploaded > 0 && err instanceof UploadError) {
        throw new UploadError(
          `${uploaded}장은 올라갔지만 이후 업로드가 실패했습니다 — ${err.message}`,
          err.status
        );
      }
      throw err;
    }
    uploaded += chunk.length;
    onProgress?.(uploaded, prepared.length);
  }

  return results;
}

/** 단일 이미지 업로드 (기본 필드명 'file') */
export async function uploadImageFile<T = UploadResponse>(
  endpoint: string,
  file: File,
  options: UploadOptions = {}
): Promise<T> {
  const results = await uploadImageFiles<T>(endpoint, [file], {
    fieldName: 'file',
    ...options,
  });
  return results[0];
}
