import type { Metadata, Sharp } from 'sharp';
import { decodeHeic, looksLikeHeic } from './decodeHeic.ts';

/**
 * sharp는 지연 로드한다 — 네이티브 바이너리라 배포 환경에서 로드가 실패할 수 있고
 * (실사례: Vercel 트레이싱에서 libvips 누락 → ERR_DLOPEN_FAILED), 그 실패가
 * lib/r2를 import하는 조회(GET) 라우트까지 죽여서는 안 된다. 로드 실패 시
 * 업로드는 원본 통과로 강등된다(파이프라인 도입 전과 동일한 동작).
 */
let sharpLoader: Promise<typeof import('sharp').default | null> | null = null;
function getSharp(): Promise<typeof import('sharp').default | null> {
  sharpLoader ??= import('sharp').then(
    (m) => m.default,
    (err) => {
      console.error('sharp 로드 실패 — 업로드 정규화 없이 원본 통과로 동작:', err?.message);
      return null;
    }
  );
  return sharpLoader;
}

/**
 * 업로드 직전 1회 정규화 — 이후로는 어떤 변환도 없이 그대로 서빙된다.
 * (2026-08 Vercel 이미지 변환 한도 402 사고 이후 next/image 최적화는 영구 off,
 *  무게 관리는 전부 이 지점에서 끝낸다. 규칙·근거:
 *  docs/superpowers/plans/2026-08-20-upload-image-pipeline.md)
 *
 * 규칙:
 * - JPEG → WebP q80 + EXIF(GPS) 제거 + 장변 ≤2000
 * - HEIC/HEIF(아이폰·삼성 폰 기본 형식) → 같은 길. sharp가 못 풀면 순수 JS 디코더로
 *   푼다(decodeHeic.ts). **이름이 .jpg여도 머리표로 알아본다.**
 * - 무거운 PNG(>500KB, 폰 사진일 가능성) → WebP q80 + 장변 ≤2000
 * - 그 외 PNG·WebP → 장변 초과 시에만 축소(포맷 유지; 작은 PNG 스크린샷은 무손실 보존)
 * - 이름이 내용을 속이면(.jpg 안의 WebP) 픽셀은 두고 이름·Content-Type만 내용에 맞춘다
 * - GIF·SVG → 원본 통과(브라우저가 그대로 그린다)
 * - 브라우저가 못 그리는 형식(TIFF 등) → WebP로 바꾼다
 * - **아무것도 못 읽는 파일 → decodable=false.** 표시용으로 등록하면 안 된다.
 *   예전에는 "원본 통과"였는데, 그 결과가 "올라갔는데 안 보이는 사진"이라 올리는 분에게는
 *   실패와 구분되지 않았다(2026-09 HEIC 27장). 못 읽으면 못 읽는다고 말해야 한다.
 *
 * scripts/migrateR2Images.mjs가 같은 규칙을 복제한다 — 임계값을 바꾸면 함께 바꿀 것.
 */

/** 표시용 최대 장변. 사이트 최대 표시 폭(전폭 히어로) 기준 — 이보다 큰 원본은 화면에 이득이 없다. */
export const MAX_LONG_EDGE = 2000;
const WEBP_QUALITY = 80;
/** 이보다 무거운 PNG는 스크린샷이 아니라 사진으로 보고 WebP로 재인코딩한다 */
export const HEAVY_PNG_BYTES = 500 * 1024;

/** 못 읽는 파일을 거절할 때 올리는 분에게 보이는 문장. 두 업로드 경로가 같은 말을 한다. */
export const UNDECODABLE_IMAGE_MESSAGE =
  '사진 파일을 읽지 못했습니다. 폰에서 JPEG로 저장해 다시 올려 주세요.';

/** 옛 경로(multipart)가 못 읽는 파일을 만났을 때 던진다 — readUploads가 받아 문장으로 바꾼다. */
export class UndecodableImageError extends Error {
  readonly filename: string;
  // 매개변수 프로퍼티(constructor(public x))는 Node 타입 스트리핑이 거부한다 — 시험이 여기를 직접 돈다
  constructor(filename: string) {
    super(`${UNDECODABLE_IMAGE_MESSAGE} (${filename})`);
    this.name = 'UndecodableImageError';
    this.filename = filename;
  }
}

export interface ProcessedUpload {
  buffer: Buffer;
  filename: string;
  contentType: string;
  width: number | null;
  height: number | null;
  /** 표시용 파생본을 새로 만들었는가(픽셀·이름·형식 중 무엇이든 바뀌었으면 true) */
  processed: boolean;
  /**
   * 브라우저가 이 파일을 그릴 수 있다고 믿어도 되는가.
   * false면 표시용으로 등록하지 말고 거절해야 한다(UNDECODABLE_IMAGE_MESSAGE).
   */
  decodable: boolean;
}

const EXT_CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
};

/** sharp가 알려 주는 format → Content-Type. 이름이 아니라 내용이 기준이다. */
const FORMAT_CONTENT_TYPES: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
};

/** 브라우저가 그대로 그릴 수 있는 형식. 이 밖(tiff 등)은 WebP로 바꾼다. */
const WEB_SAFE_FORMATS = new Set(['png', 'webp', 'gif', 'svg', 'avif']);

function extOf(filename: string): string {
  return filename.toLowerCase().split('.').pop() ?? '';
}

function baseOf(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}

function passthrough(
  buffer: Buffer,
  filename: string,
  opts: { decodable: boolean; contentType?: string; width?: number | null; height?: number | null }
): ProcessedUpload {
  return {
    buffer,
    filename,
    contentType: opts.contentType ?? EXT_CONTENT_TYPES[extOf(filename)] ?? 'application/octet-stream',
    width: opts.width ?? null,
    height: opts.height ?? null,
    processed: false,
    decodable: opts.decodable,
  };
}

function fitInside(img: Sharp, width: number, height: number): Sharp {
  return Math.max(width, height) > MAX_LONG_EDGE
    ? img.resize({ width: MAX_LONG_EDGE, height: MAX_LONG_EDGE, fit: 'inside', withoutEnlargement: true })
    : img;
}

/**
 * HEIC/HEIF → WebP.
 * 먼저 sharp에게 맡긴다(코덱이 있는 빌드거나 AVIF면 여기서 끝난다). 못 풀면 순수 JS
 * 디코더로 RGBA를 얻어 같은 규칙(장변 2000·q80)으로 인코딩한다. 그래도 못 풀면
 * 못 읽는 파일이다.
 */
async function convertHeif(
  sharp: typeof import('sharp').default,
  buffer: Buffer,
  filename: string
): Promise<ProcessedUpload> {
  const base = baseOf(filename);
  try {
    const out = await sharp(buffer, { failOn: 'none' })
      .rotate()
      .resize({ width: MAX_LONG_EDGE, height: MAX_LONG_EDGE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
    return {
      buffer: out.data,
      filename: `${base}.webp`,
      contentType: 'image/webp',
      width: out.info.width,
      height: out.info.height,
      processed: true,
      decodable: true,
    };
  } catch {
    // HEVC 코덱이 없다 — 아래에서 순수 JS로 푼다
  }

  const raw = await decodeHeic(buffer);
  if (!raw) return passthrough(buffer, filename, { decodable: false });

  try {
    // libheif가 회전(irot)·자르기를 이미 적용해 준다 — 여기서는 크기와 인코딩만.
    const pixels = Buffer.from(raw.data.buffer, raw.data.byteOffset, raw.data.byteLength);
    const img = sharp(pixels, { raw: { width: raw.width, height: raw.height, channels: 4 } });
    const out = await fitInside(img, raw.width, raw.height)
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
    return {
      buffer: out.data,
      filename: `${base}.webp`,
      contentType: 'image/webp',
      width: out.info.width,
      height: out.info.height,
      processed: true,
      decodable: true,
    };
  } catch {
    return passthrough(buffer, filename, { decodable: false });
  }
}

export async function processForUpload(buffer: Buffer, filename: string): Promise<ProcessedUpload> {
  const ext = extOf(filename);
  // GIF는 애니메이션 보존, SVG는 래스터화 무의미 — 둘 다 손대지 않는다
  if (ext === 'svg' || ext === 'gif') return passthrough(buffer, filename, { decodable: true });

  const sharp = await getSharp();
  // 인프라 강등(네이티브 로드 실패) — 업로드를 막지 않고 종전처럼 원본을 통과시킨다
  if (!sharp) return passthrough(buffer, filename, { decodable: true });

  let meta: Metadata | null = null;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    meta = null;
  }

  // HEIC/HEIF: sharp가 메타데이터는 읽어도 픽셀은 못 풀 수 있고, 아예 못 읽는 빌드도
  // 있다. 어느 쪽이든 머리표로 알아보고 같은 길로 보낸다 — 이름이 .jpg여도.
  if (meta?.format === 'heif' || (!meta && looksLikeHeic(buffer))) {
    return convertHeif(sharp, buffer, filename);
  }
  if (!meta?.format) return passthrough(buffer, filename, { decodable: false });

  const format = meta.format;
  // EXIF 방향이 90°계(5~8)면 실표시 가로세로가 뒤집힌다
  const sideways = (meta.orientation ?? 1) >= 5;
  const w = (sideways ? meta.height : meta.width) ?? 0;
  const h = (sideways ? meta.width : meta.height) ?? 0;
  const needsResize = Math.max(w, h) > MAX_LONG_EDGE;

  const base = baseOf(filename);
  const resized = (img: Sharp) => fitInside(img, w, h);

  const heavyPng = format === 'png' && buffer.length > HEAVY_PNG_BYTES;

  // failOn:'none' — 잘린 JPEG 등 부분 손상 파일도 가능한 만큼 살려서 변환한다
  const tolerant = () => sharp(buffer, { failOn: 'none' });

  try {
    if (format === 'jpeg' || heavyPng || !WEB_SAFE_FORMATS.has(format)) {
      // .rotate() 인자 없음 = EXIF 방향을 픽셀에 굽는다; 재인코딩이 메타데이터를 소거한다
      const out = await resized(tolerant().rotate())
        .webp({ quality: WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true });
      return {
        buffer: out.data,
        filename: `${base}.webp`,
        contentType: 'image/webp',
        width: out.info.width,
        height: out.info.height,
        processed: true,
        decodable: true,
      };
    }

    if ((format === 'png' || format === 'webp') && needsResize) {
      const img = resized(tolerant().rotate());
      const out =
        format === 'png'
          ? await img.png().toBuffer({ resolveWithObject: true })
          : await img.webp({ quality: WEBP_QUALITY }).toBuffer({ resolveWithObject: true });
      return {
        buffer: out.data,
        filename: `${base}.${format}`,
        contentType: `image/${format}`,
        width: out.info.width,
        height: out.info.height,
        processed: true,
        decodable: true,
      };
    }
  } catch {
    // 메타데이터는 읽혔는데 픽셀을 못 푼다 — 브라우저도 대개 못 그린다. 등록하지 않는다.
    return passthrough(buffer, filename, { decodable: false });
  }

  // 여기 오는 것은 브라우저가 그대로 그리는 작은 PNG·WebP·GIF·AVIF다.
  const contentType = FORMAT_CONTENT_TYPES[format] ?? `image/${format}`;
  if (EXT_CONTENT_TYPES[ext] !== contentType) {
    // 이름이 내용을 속인다(.jpg 안의 WebP). 픽셀은 그대로, 이름·형식만 내용에 맞춘다 —
    // 확장자만 믿고 image/jpeg로 올리면 헤더가 거짓말을 한다.
    return {
      buffer,
      filename: `${base}.${format}`,
      contentType,
      width: w || null,
      height: h || null,
      processed: true,
      decodable: true,
    };
  }
  return passthrough(buffer, filename, { decodable: true, contentType, width: w || null, height: h || null });
}
