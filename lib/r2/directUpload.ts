/**
 * 브라우저 → R2 직행 업로드 (서버 쪽 두 걸음)
 *
 * 예전에는 파일이 Vercel 함수를 통과했다. 그런데 그 문이 **4.5MB**다(플랜을
 * 올려도 같다). 그래서 폰으로 찍은 사진 한 장, 또는 작은 사진 서너 장이 한
 * 요청에 묶이는 것만으로 413이 났고, 올리는 분에게는 이유를 알 수 없는 실패로
 * 보였다.
 *
 * 지금은 파일이 우리 서버를 지나지 않는다:
 *
 *   ① createTickets()  — "여기에 올려도 좋다"는 서명된 주소를 발급한다
 *   ② (브라우저가 R2로 직접 PUT)
 *   ③ finalizeTicket() — 올라온 것을 **실측으로 확인**하고, 표시용 사진을 만든다
 *
 * ③이 중요한 이유: 서명은 크기를 강제하지 못한다(S3 presigned PUT의 한계).
 * 그래서 다 올라온 뒤 실제 크기·형식을 재고, 규칙을 벗어나면 **지우고 거절한다.**
 * "화면이 통과시켰으니 괜찮겠지"로 두면 버킷이 아무 파일이나 받는 자리가 된다.
 */

import 'server-only';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from './client';
import { deleteFromR2 } from './upload';
import {
  buildObjectKey,
  derivativeKeyFor,
  originalKeyFor,
  signTicket,
  verifyTicket,
  type UploadTicketClaims,
} from './uploadTicket';
import type { UploadTarget } from './uploadTargets';
import { processForUpload } from '@/lib/images/processForUpload';

/** 서명 유효 시간. 사진 한 장을 올리기엔 넉넉하고, 흘러도 곧 죽을 만큼 짧게. */
const TICKET_TTL_MS = 30 * 60 * 1000;

/** 업로드 후 실측이 신고값보다 이만큼 커지면 거절 — 서명 시 신고를 믿지 않는다. */
const SIZE_TOLERANCE = 1.1;

export interface RequestedFile {
  name: string;
  type: string;
  size: number;
}

export interface UploadTicket {
  /** 브라우저가 PUT할 주소(서명됨) */
  uploadUrl: string;
  /** ③에서 되돌려 줄 허가증 */
  ticket: string;
  /** 화면 표시용 — 어떤 파일에 대한 티켓인지 짝을 맞춘다 */
  name: string;
  /** PUT할 때 반드시 이 Content-Type으로 보내야 한다(서명에 묶여 있다) */
  contentType: string;
}

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error('AUTH_SECRET 없음 — 업로드 티켓을 서명할 수 없습니다.');
  return value;
}

export type TicketError =
  | { ok: false; error: string };

/**
 * ① 올릴 자리를 정하고 서명한다.
 *
 * 키는 서버가 만든다 — 클라이언트가 경로를 정하면 남의 폴더에 쓸 수 있다.
 */
export function createTickets(
  target: UploadTarget,
  files: RequestedFile[],
  userId: string
): { ok: true; tickets: Promise<UploadTicket>[] } | TicketError {
  for (const file of files) {
    if (!file.name) return { ok: false, error: '파일 이름이 없습니다.' };
    if (target.imagesOnly && !file.type.startsWith('image/')) {
      return { ok: false, error: `이미지 파일만 올릴 수 있습니다: ${file.name}` };
    }
    if (!Number.isFinite(file.size) || file.size <= 0) {
      return { ok: false, error: `빈 파일입니다: ${file.name}` };
    }
    if (file.size > target.maxBytes) {
      return {
        ok: false,
        error: `${Math.round(target.maxBytes / 1024 / 1024)}MB를 넘는 파일은 올릴 수 없습니다: ${file.name}`,
      };
    }
  }

  const exp = Date.now() + TICKET_TTL_MS;
  const tickets = files.map(async (file): Promise<UploadTicket> => {
    const displayKey = buildObjectKey(target.folder, file.name);
    // 원본은 늘 originals/ 아래로 올라온다. 남길지는 ③에서 정한다 —
    // 남기지 않는 용도라도 일단 여기 눕혀야 파생본을 만들 수 있다.
    const key = originalKeyFor(displayKey);
    const contentType = file.type || 'application/octet-stream';

    const claims: UploadTicketClaims = {
      key,
      target: target.key,
      contentType,
      size: file.size,
      user: userId,
      exp,
    };

    const uploadUrl = await getSignedUrl(
      r2Client,
      new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType }),
      { expiresIn: Math.floor(TICKET_TTL_MS / 1000) }
    );

    return { uploadUrl, ticket: signTicket(claims, secret()), name: file.name, contentType };
  });

  return { ok: true, tickets };
}

/** ③의 결과 — lib/r2/upload.ts의 UploadResult와 같은 모양(라우트가 그대로 쓴다) */
export interface FinalizedUpload {
  key: string;
  url: string;
  size: number;
  contentType: string;
  width: number | null;
  height: number | null;
  /** 원본을 남긴 경우 그 키. 남기지 않았으면 null */
  originalKey: string | null;
  /** 올린 사람이 고른 파일 이름(표시·캡션용) */
  originalName: string;
}

export type FinalizeResult =
  | { ok: true; upload: FinalizedUpload }
  | { ok: false; error: string };

/**
 * ③ 올라온 것을 확인하고 표시용 사진을 만든다.
 *
 * 정규화(장변 2000·WebP·EXIF 제거)는 예전과 같은 함수를 쓴다 — 업로드 경로가
 * 바뀌었을 뿐, "무엇을 서빙하는가"의 규칙은 한 곳(processForUpload)에 남는다.
 */
export async function finalizeTicket(
  token: string,
  target: UploadTarget,
  userId: string,
  originalName: string
): Promise<FinalizeResult> {
  const verified = verifyTicket(token, {
    secret: secret(),
    user: userId,
    target: target.key,
  });
  if (!verified.ok) {
    const message =
      verified.reason === 'expired'
        ? '업로드 시간이 너무 오래 지났습니다. 다시 올려 주세요.'
        : '업로드 정보를 확인하지 못했습니다. 다시 시도해 주세요.';
    return { ok: false, error: message };
  }
  const { key } = verified.claims;

  // ── 실제로 올라왔는가, 그리고 약속한 크기인가
  let head;
  try {
    head = await r2Client.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  } catch {
    return { ok: false, error: '업로드가 끝나지 않았습니다. 다시 시도해 주세요.' };
  }

  const actualSize = Number(head.ContentLength ?? 0);
  const contentType = head.ContentType || verified.claims.contentType;

  if (actualSize <= 0) {
    await discard(key);
    return { ok: false, error: '빈 파일입니다.' };
  }
  if (
    actualSize > target.maxBytes ||
    actualSize > verified.claims.size * SIZE_TOLERANCE
  ) {
    // 서명 때 신고한 것보다 훨씬 큰 파일이 올라왔다 — 받지 않고 지운다
    await discard(key);
    return {
      ok: false,
      error: `${Math.round(target.maxBytes / 1024 / 1024)}MB를 넘는 파일은 올릴 수 없습니다.`,
    };
  }
  if (target.imagesOnly && !contentType.startsWith('image/')) {
    await discard(key);
    return { ok: false, error: '이미지 파일만 올릴 수 있습니다.' };
  }

  const displayKey = key.replace(/^originals\//, '');

  // 손대지 않는 용도(메일 첨부 등)는 올라온 그대로가 결과다
  if (!target.processImage) {
    return {
      ok: true,
      upload: {
        key,
        url: `${R2_PUBLIC_URL}/${key}`,
        size: actualSize,
        contentType,
        width: null,
        height: null,
        originalKey: null,
        originalName,
      },
    };
  }

  // ── 표시용으로 정규화
  const buffer = await readR2Object(key);
  if (!buffer) {
    return { ok: false, error: '올라온 사진을 읽지 못했습니다. 다시 시도해 주세요.' };
  }

  const processed = await processForUpload(buffer, originalName || displayKey.split('/').pop()!);

  // 정규화가 손대지 않은 파일(GIF·SVG·작은 PNG 등)은 사본을 하나 더 만들지 않는다.
  // 올라온 객체를 그대로 표시본으로 쓴다 — 같은 파일을 두 번 저장할 이유가 없다.
  if (!processed.processed) {
    return {
      ok: true,
      upload: {
        key,
        url: `${R2_PUBLIC_URL}/${key}`,
        size: actualSize,
        contentType,
        width: processed.width,
        height: processed.height,
        originalKey: null,
        originalName,
      },
    };
  }

  const derivedKey = derivativeKeyFor(displayKey, processed.filename);
  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: derivedKey,
      Body: processed.buffer,
      ContentType: processed.contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  // 원본을 남기지 않는 용도라면 여기서 정리한다(뉴스 썸네일 뒤에 5MB가 쌓이지 않게)
  let originalKey: string | null = key;
  if (!target.keepOriginal) {
    await discard(key);
    originalKey = null;
  }

  return {
    ok: true,
    upload: {
      key: derivedKey,
      url: `${R2_PUBLIC_URL}/${derivedKey}`,
      size: processed.buffer.length,
      contentType: processed.contentType,
      width: processed.width,
      height: processed.height,
      originalKey,
      originalName,
    },
  };
}

/**
 * R2에서 객체를 통째로 읽는다.
 *
 * 함수 **밖으로** 나가는 응답에는 4.5MB 한도가 있지만, 함수가 R2에서 당겨오는
 * 것에는 없다. 그래서 큰 사진도 서버가 다시 읽어 다듬을 수 있다.
 */
export async function readR2Object(key: string): Promise<Buffer | null> {
  try {
    const res = await r2Client.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    const bytes = await res.Body?.transformToByteArray();
    return bytes ? Buffer.from(bytes) : null;
  } catch (error) {
    console.error('[upload] 원본 읽기 실패:', key, error);
    return null;
  }
}

/** 받지 않기로 한 객체는 남겨 두지 않는다. 실패해도 흐름을 깨지 않는다. */
async function discard(key: string): Promise<void> {
  await deleteFromR2(key).catch((error) => {
    console.warn('[upload] 버리려던 객체를 지우지 못했습니다:', key, error);
  });
}
