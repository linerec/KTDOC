/**
 * heic-decode 타입 선언 — 패키지가 타입을 싣지 않는다.
 * 순수 JS(libheif WASM) HEIC 디코더. sharp의 prebuilt libvips에는 HEVC 코덱이 없어
 * 폰이 주는 HEIC를 풀지 못하므로 이 디코더가 그 자리를 메운다(lib/images/decodeHeic.ts).
 */
declare module 'heic-decode' {
  interface HeicDecoded {
    width: number;
    height: number;
    /** RGBA 8비트, 행 우선 */
    data: Uint8ClampedArray;
  }
  function decode(input: { buffer: Uint8Array }): Promise<HeicDecoded>;
  namespace decode {
    function all(input: {
      buffer: Uint8Array;
    }): Promise<Array<{ width: number; height: number; decode(): Promise<HeicDecoded> }>>;
  }
  export = decode;
}
