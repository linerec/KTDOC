/**
 * 업로드 받기 — 라우트가 파일을 손에 넣는 단 하나의 입구
 *
 * 업로드 라우트가 8곳인데, 저마다 formData를 뜯어 크기를 재고 R2에 올리는 코드를
 * 복사해 갖고 있었다. 그 복사본들이 전부 **파일이 Vercel 함수를 지나간다**는
 * 전제 위에 서 있었고, 그 전제가 4.5MB에서 무너졌다.
 *
 * 이제 라우트는 "파일을 어떻게 받았는가"를 몰라도 된다:
 *
 *   - 새 경로: 브라우저가 R2에 직접 올리고 티켓만 보낸다(JSON) → 크기 제한 없음
 *   - 옛 경로: multipart로 파일이 그대로 온다(4.5MB 이하) → 예전처럼 처리
 *
 * 두 경우 모두 같은 모양(FinalizedUpload)으로 돌려준다. 라우트에서 바뀌는 것은
 * "formData()를 부르던 자리"뿐이고, DB에 쓰는 코드는 그대로다.
 *
 * 옛 경로를 남겨 두는 이유: 이 함수를 쓰는 라우트를 스크립트·외부 도구가 부르고
 * 있을 수 있고, 작은 파일에는 아무 문제가 없기 때문이다. 언젠가 지우더라도
 * 그건 이 파일 한 곳을 고치는 일이다.
 */

import 'server-only';
import { uploadToR2 } from './upload';
import { finalizeTicket, type FinalizedUpload } from './directUpload';
import type { UploadTarget } from './uploadTargets';

export interface UploadIntake {
  uploads: FinalizedUpload[];
  /** 파일과 함께 온 값(publishNow·eventId 등). multipart·JSON 어느 쪽이든 같게 읽는다. */
  field: (name: string) => string | null;
  /** 받은 것이 하나도 없을 때의 사유(라우트가 그대로 화면에 보여 준다) */
  error: string | null;
}

interface ReadOptions {
  target: UploadTarget;
  /** 로그인한 사람 — 티켓의 주인과 대조한다 */
  userId: string;
  /** 이 요청에서 받을 최대 장수 */
  maxFiles?: number;
  /** multipart에서 파일이 담긴 필드명(기본은 files와 file 둘 다 본다) */
  fieldName?: string;
}

const DEFAULT_MAX_FILES = 40;

export async function readUploads(
  request: Request,
  options: ReadOptions
): Promise<UploadIntake> {
  const contentType = request.headers.get('content-type') ?? '';
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;

  return contentType.includes('application/json')
    ? readFromTickets(request, options, maxFiles)
    : readFromMultipart(request, options, maxFiles);
}

/** 새 경로 — 파일은 이미 R2에 있고, 우리는 그것을 확인하고 다듬는다. */
async function readFromTickets(
  request: Request,
  options: ReadOptions,
  maxFiles: number
): Promise<UploadIntake> {
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const field = (name: string) => {
    const value = payload?.[name];
    if (value === undefined || value === null) return null;
    return typeof value === 'string' ? value : String(value);
  };

  const raw = Array.isArray(payload?.uploads) ? payload.uploads : [];
  if (!raw.length) return { uploads: [], field, error: '업로드할 사진이 없습니다.' };
  if (raw.length > maxFiles) {
    return { uploads: [], field, error: `한 번에 ${maxFiles}장까지 올릴 수 있습니다.` };
  }

  const uploads: FinalizedUpload[] = [];
  let firstError: string | null = null;

  for (const item of raw) {
    const entry = (item ?? {}) as Record<string, unknown>;
    const ticket = typeof entry.ticket === 'string' ? entry.ticket : '';
    const name = typeof entry.name === 'string' ? entry.name : '';
    if (!ticket) {
      firstError ??= '업로드 정보를 확인하지 못했습니다. 다시 시도해 주세요.';
      continue;
    }
    const result = await finalizeTicket(ticket, options.target, options.userId, name);
    if (result.ok) uploads.push(result.upload);
    else firstError ??= result.error;
  }

  // 한 장이라도 성공했으면 성공으로 본다 — 30장 중 1장이 깨졌다고 29장을
  // 되돌리면, 올리는 분은 무엇이 저장됐는지 모른 채 처음부터 다시 해야 한다.
  return { uploads, field, error: uploads.length ? null : firstError };
}

/** 옛 경로 — 파일이 함수를 통과해서 온다(4.5MB 이하에서만 성립). */
async function readFromMultipart(
  request: Request,
  options: ReadOptions,
  maxFiles: number
): Promise<UploadIntake> {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return { uploads: [], field: () => null, error: '업로드를 읽지 못했습니다.' };
  }

  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === 'string' ? value : null;
  };

  const names = options.fieldName ? [options.fieldName] : ['files', 'file'];
  const files = names
    .flatMap((name) => form.getAll(name))
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (!files.length) return { uploads: [], field, error: '업로드할 사진이 없습니다.' };
  if (files.length > maxFiles) {
    return { uploads: [], field, error: `한 번에 ${maxFiles}장까지 올릴 수 있습니다.` };
  }

  const uploads: FinalizedUpload[] = [];
  for (const file of files) {
    if (options.target.imagesOnly && !file.type.startsWith('image/')) continue;
    if (file.size > options.target.maxBytes) {
      return {
        uploads: [],
        field,
        error: `${Math.round(options.target.maxBytes / 1024 / 1024)}MB를 넘는 파일은 올릴 수 없습니다: ${file.name}`,
      };
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadToR2(buffer, file.name, options.target.folder);
    uploads.push({
      key: result.key,
      url: result.url,
      size: result.size,
      contentType: result.contentType,
      width: result.width,
      height: result.height,
      // 옛 경로는 정규화된 한 장만 남는다(원본이 서버를 지나가며 버려진다)
      originalKey: null,
      originalName: file.name,
    });
  }

  return {
    uploads,
    field,
    error: uploads.length ? null : '이미지 파일만 업로드할 수 있습니다.',
  };
}
