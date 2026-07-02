/**
 * 지도 제공자 추상화 — 공통 타입
 *
 * 제공자(OSM, 향후 Google/Mapbox 등)를 교체해도 앱 코드는 이 인터페이스만 본다.
 * 규칙:
 *  - geocode()는 서버 전용(/api/admin/geocode에서만 호출) — API 키가 필요한
 *    제공자로 바꿔도 키가 클라이언트에 노출되지 않는다.
 *  - embedUrl/externalMapUrl/directionsUrl은 순수 함수 — 서버·클라이언트 어디서든 호출 가능.
 * 새 제공자 추가: lib/maps/providers/에 MapsProvider 구현 모듈을 만들고
 * lib/maps/index.ts의 스위치에 등록한 뒤 NEXT_PUBLIC_MAPS_PROVIDER로 선택한다.
 */

/** 지오코딩(주소 검색) 결과 한 건 */
export interface GeocodeResult {
  /** 장소·건물 이름 (제공자가 알 때만, 예: "Bergen Performing Arts Center") */
  name: string | null;
  /** 표시용 전체 주소 */
  address: string;
  lat: number;
  lng: number;
}

export interface EmbedOptions {
  /** 지도 확대 수준 (제공자 기본값 있음) */
  zoom?: number;
}

export interface MapsProvider {
  /** 제공자 식별자 (예: 'osm') */
  id: string;
  /** 지도 하단 저작자 표시 — 임베드 밖에 별도 표기가 필요한 제공자용 */
  attribution: { text: string; url: string };
  /** 주소·장소 텍스트 검색. 서버 전용 — 클라이언트에서 직접 호출하지 말 것. */
  geocode(query: string, opts?: { limit?: number }): Promise<GeocodeResult[]>;
  /** 상세 페이지·폼 미리보기에 넣을 iframe 지도 URL */
  embedUrl(lat: number, lng: number, opts?: EmbedOptions): string;
  /** 제공자 사이트에서 크게 보기 링크 */
  externalMapUrl(lat: number, lng: number, opts?: EmbedOptions): string;
  /** 길찾기(내비게이션) 링크 */
  directionsUrl(lat: number, lng: number, label?: string | null): string;
}

/** 좌표 유효성 — 저장·API 검증 공용 */
export function isValidLatLng(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}
