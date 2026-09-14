/**
 * HEIC 디코드 — 폰이 찍은 그대로 올라온 사진을 우리가 풀어 준다
 *
 * 아이폰과 삼성 폰은 사진을 HEIC로 저장한다. 그 파일이 .heic 이름으로도, 때로는
 * **.jpg 이름으로도** 올라온다(메신저·갤러리 공유가 이름만 바꾼다). sharp의 prebuilt
 * libvips는 libheif는 있지만 HEVC 코덱(libde265)이 없어 메타데이터까지만 읽고 픽셀은
 * 못 푼다 — Vercel도 같은 바이너리다. 2026-09에 그 실패가 "원본 통과"로 처리돼
 * HEIC 27장이 표시용으로 등록됐고, 안드로이드 크롬은 HEIC를 못 그려 깨진 칸이 됐다.
 *
 * 여기서는 순수 JS(libheif WASM) 디코더로 RGBA를 얻는다. 실측 1440×1440 한 장에
 * 약 100ms. 12MP 사진이면 RGBA 48MB가 잠깐 잡히지만 마무리 요청은 3장씩이라 괜찮다.
 *
 * 형식 판정은 이름이 아니라 **머리표(ftyp 브랜드)**로 한다 — 이름은 거짓말을 한다.
 */

type HeicDecoder = (input: { buffer: Uint8Array }) => Promise<{
  width: number;
  height: number;
  data: Uint8ClampedArray;
}>;

/** ISO BMFF 브랜드 중 HEIF 계열. heic-decode의 판정과 같은 집합이다. */
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1']);

/** 머리표만 보고 HEIC/HEIF인지 — 순수 함수. 이름·Content-Type은 보지 않는다. */
export function looksLikeHeic(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  if (buffer.toString('latin1', 4, 8) !== 'ftyp') return false;
  const brand = buffer.toString('latin1', 8, 12).replace(/\0/g, ' ').trim();
  return HEIC_BRANDS.has(brand);
}

let decoderLoader: Promise<HeicDecoder | null> | null = null;
function getDecoder(): Promise<HeicDecoder | null> {
  // sharp와 같은 이유로 지연 로드한다 — WASM 번들(8MB)을 조회 라우트까지 끌어오지 않는다.
  decoderLoader ??= import('heic-decode').then(
    (m) => (m.default ?? m) as unknown as HeicDecoder,
    (err) => {
      console.error('heic-decode 로드 실패 — HEIC는 읽지 못하는 파일로 처리됩니다:', err?.message);
      return null;
    }
  );
  return decoderLoader;
}

/** HEIC를 RGBA 픽셀로. HEIC가 아니거나 못 풀면 null. */
export async function decodeHeic(
  buffer: Buffer
): Promise<{ width: number; height: number; data: Uint8ClampedArray } | null> {
  if (!looksLikeHeic(buffer)) return null;
  const decode = await getDecoder();
  if (!decode) return null;
  try {
    return await decode({
      buffer: new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength),
    });
  } catch (err) {
    console.warn('HEIC 디코드 실패:', (err as Error)?.message);
    return null;
  }
}
