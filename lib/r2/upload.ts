import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from './client';
import { processForUpload } from '@/lib/images/processForUpload';

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
  /** 정규화 후 픽셀 크기. 처리 없이 통과한 파일(GIF·SVG 등)은 null */
  width: number | null;
  height: number | null;
}

/**
 * R2에 파일 업로드 — 모든 업로드 라우트가 지나는 단일 관문.
 * 저장 전에 processForUpload로 1회 정규화(리사이즈·WebP·EXIF 제거)하므로
 * 이 함수를 거친 객체는 추가 변환 없이 그대로 서빙해도 된다.
 */
export async function uploadToR2(
  buffer: Buffer,
  filename: string,
  folder: string = 'images'
): Promise<UploadResult> {
  const processed = await processForUpload(buffer, filename);

  const timestamp = Date.now();
  const sanitizedFilename = processed.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  // 같은 밀리초에 같은 이름의 파일이 올라와도 키가 겹치지 않도록 난수 접미사를 붙인다
  // (키가 겹치면 앞 객체를 덮어써, 서로 다른 사진 레코드가 한 객체를 공유하게 된다)
  const unique = Math.random().toString(36).slice(2, 8);
  const key = `${folder}/${timestamp}-${unique}-${sanitizedFilename}`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: processed.buffer,
      ContentType: processed.contentType,
      // 키가 유일(timestamp+난수)하므로 내용이 바뀔 일이 없다 — immutable이 정확하다
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  return {
    key,
    url: `${R2_PUBLIC_URL}/${key}`,
    size: processed.buffer.length,
    contentType: processed.contentType,
    width: processed.width,
    height: processed.height,
  };
}

/**
 * R2에서 파일 삭제
 */
export async function deleteFromR2(key: string): Promise<void> {
  if (!key) return;

  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    })
  );
}
