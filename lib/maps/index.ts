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

import type { MapsProvider } from './types';
import { osmProvider } from './providers/osm';

export type { MapsProvider, GeocodeResult, EmbedOptions } from './types';
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
