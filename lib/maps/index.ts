/**
 * 지도 제공자 선택 — 앱 코드의 유일한 진입점
 *
 * 사용처는 항상 getMapsProvider()만 부른다(구현 모듈 직접 import 금지).
 * 제공자 교체 절차:
 *   1) lib/maps/providers/<new>.ts 에 MapsProvider 구현 추가
 *   2) 아래 PROVIDERS에 등록
 *   3) 환경변수 NEXT_PUBLIC_MAPS_PROVIDER=<id> 로 전환 (기본 'osm')
 * NEXT_PUBLIC_* 인 이유: embedUrl 등 순수 URL 빌더는 클라이언트(관리자 폼 미리보기)에서도
 * 쓰이므로 선택값이 양쪽에서 같아야 한다. API 키가 필요한 제공자는 geocode()만
 * 서버 전용 키를 쓰고, 그 키는 NEXT_PUBLIC 없이 서버 env로 관리하면 된다.
 */

import type { Geocoder, MapsProvider } from './types';
import { osmProvider } from './providers/osm';
import { googleGeocoder } from './providers/google';
import { mapboxGeocoder } from './providers/mapbox';

export type { MapsProvider, Geocoder, GeocodeResult, EmbedOptions } from './types';
export { isValidLatLng } from './types';

const PROVIDERS: Record<string, MapsProvider> = {
  [osmProvider.id]: osmProvider,
};

const DEFAULT_PROVIDER_ID = osmProvider.id;

export function getMapsProvider(): MapsProvider {
  const id = process.env.NEXT_PUBLIC_MAPS_PROVIDER || DEFAULT_PROVIDER_ID;
  const provider = PROVIDERS[id];
  if (!provider) {
    console.warn(`알 수 없는 지도 제공자 '${id}' — 기본값 '${DEFAULT_PROVIDER_ID}' 사용`);
    return PROVIDERS[DEFAULT_PROVIDER_ID];
  }
  return provider;
}

/**
 * 주소 검색 제공자 — 지도 '표시'와 따로 고른다.
 *
 * 표시는 무료 OSM 임베드로 충분하지만, 주소 검색은 OSM으로 안 된다. 미국 관공서·
 * 캠퍼스 주소가 OSM 데이터에 아예 없는 경우가 많아서, 어떤 도구를 써도 못 찾는다.
 * 그래서 검색만 GEOCODE_PROVIDER로 갈아끼운다(서버 전용 환경변수 — 키가 필요한
 * 제공자를 써도 번들에 들어가지 않는다).
 *
 *   GEOCODE_PROVIDER=mapbox + MAPBOX_ACCESS_TOKEN=...   (현재 선택 — 결제수단 불필요)
 *   GEOCODE_PROVIDER=google + GOOGLE_MAPS_API_KEY=...   (품질은 가장 좋음, 결제 등록 필요)
 *   미설정 시 표시 제공자의 geocode(=OSM Photon)로 떨어진다.
 */
const GEOCODERS: Record<string, Geocoder> = {
  [osmProvider.id]: osmProvider,
  [googleGeocoder.id]: googleGeocoder,
  [mapboxGeocoder.id]: mapboxGeocoder,
};

export function getGeocoder(): Geocoder {
  const id = process.env.GEOCODE_PROVIDER || process.env.NEXT_PUBLIC_MAPS_PROVIDER || DEFAULT_PROVIDER_ID;
  const geocoder = GEOCODERS[id];
  if (!geocoder) {
    console.warn(`알 수 없는 지오코더 '${id}' — 기본값 '${DEFAULT_PROVIDER_ID}' 사용`);
    return GEOCODERS[DEFAULT_PROVIDER_ID];
  }
  return geocoder;
}
