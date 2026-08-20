import sharp, { type Metadata, type Sharp } from 'sharp';

/**
 * 업로드 직전 1회 정규화 — 이후로는 어떤 변환도 없이 그대로 서빙된다.
 * (2026-08 Vercel 이미지 변환 한도 402 사고 이후 next/image 최적화는 영구 off,
 *  무게 관리는 전부 이 지점에서 끝낸다. 규칙·근거:
 *  docs/superpowers/plans/2026-08-20-upload-image-pipeline.md)
 *
 * 규칙:
 * - JPEG(디코드 가능한 HEIC 포함) → WebP q80 + EXIF(GPS) 제거 + 장변 ≤2000
 * - PNG·WebP → 장변 초과 시에만 축소(포맷 유지; 작은 PNG 스크린샷은 무손실 보존)
 * - GIF·SVG·디코드 불가(코덱 없는 HEIC 등) → 원본 통과(종전 동작과 동일)
 *
 * scripts/migrateR2Images.mjs가 같은 규칙을 복제한다 — 임계값을 바꾸면 함께 바꿀 것.
 */

/** 표시용 최대 장변. 사이트 최대 표시 폭(전폭 히어로) 기준 — 이보다 큰 원본은 화면에 이득이 없다. */
export const MAX_LONG_EDGE = 2000;
const WEBP_QUALITY = 80;

export interface ProcessedUpload {
  buffer: Buffer;
  filename: string;
  contentType: string;
  width: number | null;
  height: number | null;
  processed: boolean;
}

const EXT_CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

function extOf(filename: string): string {
  return filename.toLowerCase().split('.').pop() ?? '';
}

function passthrough(buffer: Buffer, filename: string): ProcessedUpload {
  return {
    buffer,
    filename,
    contentType: EXT_CONTENT_TYPES[extOf(filename)] ?? 'application/octet-stream',
    width: null,
    height: null,
    processed: false,
  };
}

export async function processForUpload(buffer: Buffer, filename: string): Promise<ProcessedUpload> {
  const ext = extOf(filename);
  // GIF는 애니메이션 보존, SVG는 래스터화 무의미 — 둘 다 손대지 않는다
  if (ext === 'svg' || ext === 'gif') return passthrough(buffer, filename);

  let meta: Metadata;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    return passthrough(buffer, filename);
  }

  const format = meta.format;
  // EXIF 방향이 90°계(5~8)면 실표시 가로세로가 뒤집힌다
  const sideways = (meta.orientation ?? 1) >= 5;
  const w = (sideways ? meta.height : meta.width) ?? 0;
  const h = (sideways ? meta.width : meta.height) ?? 0;
  const needsResize = Math.max(w, h) > MAX_LONG_EDGE;

  const base = filename.replace(/\.[^.]+$/, '');
  const resized = (img: Sharp) =>
    needsResize
      ? img.resize({ width: MAX_LONG_EDGE, height: MAX_LONG_EDGE, fit: 'inside', withoutEnlargement: true })
      : img;

  if (format === 'jpeg' || format === 'heif') {
    // .rotate() 인자 없음 = EXIF 방향을 픽셀에 굽는다; 재인코딩이 메타데이터를 소거한다
    const out = await resized(sharp(buffer).rotate())
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
    return {
      buffer: out.data,
      filename: `${base}.webp`,
      contentType: 'image/webp',
      width: out.info.width,
      height: out.info.height,
      processed: true,
    };
  }

  if ((format === 'png' || format === 'webp') && needsResize) {
    const img = resized(sharp(buffer).rotate());
    const out =
      format === 'png'
        ? await img.png().toBuffer({ resolveWithObject: true })
        : await img.webp({ quality: WEBP_QUALITY }).toBuffer({ resolveWithObject: true });
    return {
      buffer: out.data,
      filename,
      contentType: `image/${format}`,
      width: out.info.width,
      height: out.info.height,
      processed: true,
    };
  }

  return passthrough(buffer, filename);
}
