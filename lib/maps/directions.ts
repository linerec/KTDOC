/**
 * 길찾기 링크 — 좌표가 없어도 만든다
 *
 * MapsProvider.directionsUrl(lat, lng)는 좌표를 요구한다. 그런데 실제 데이터에는
 * **좌표 없이 주소만 있는 행사가 많다** — 미국 관공서·캠퍼스 주소는 지오코더가
 * 못 찾는 경우가 흔해서, LocationPicker가 확인되지 않은 주소를 좌표 없이 저장하기
 * 때문이다(lib/maps/index.ts 주석 참고). 그 행사들에는 길찾기 버튼이 아예 안 붙었다.
 *
 * 구글 지도의 공식 범용 URL은 목적지로 좌표뿐 아니라 주소 문자열도 받는다.
 * 그래서 있는 것 중 가장 정확한 것을 골라 넘긴다. 모바일에서는 이 주소가
 * 구글 지도 앱으로 넘어가고, 앱이 없으면 웹으로 열린다.
 *
 * 순수 함수 — 서버·클라이언트 어디서든 부를 수 있다.
 */

// 확장자를 붙인다 — 이 모듈은 node --test로도 돌아가는데(directions.test.ts),
// 그쪽 해석기는 확장자 없는 상대 경로를 찾지 못한다. tsconfig의
// allowImportingTsExtensions가 켜져 있어 번들러 쪽은 그대로 통과한다.
import { isValidLatLng } from './types.ts';

export interface DirectionsTarget {
  /** 장소 이름 (예: "Bergen County Administration Building") */
  location?: string | null;
  /** 전체 주소 (예: "1 Bergen County Plaza, Hackensack, NJ 07601") */
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** 운영자가 직접 넣은 지도 링크. 있으면 그것을 존중한다. */
  locationUrl?: string | null;
}

const GOOGLE_DIR = 'https://www.google.com/maps/dir/?api=1&destination=';

/**
 * 길찾기 목적지 문자열. 갈 곳을 특정할 수 없으면 null.
 *
 * 좌표 > 이름+주소 > 주소 > 이름 순. 좌표가 가장 정확하고, 이름과 주소가 모두
 * 있으면 함께 넘기는 편이 낫다 — 큰 건물은 주소만으로 입구가 어긋나기도 한다.
 */
export function directionsDestination(target: DirectionsTarget): string | null {
  const { location, address, lat, lng } = target;

  if (isValidLatLng(lat, lng)) return `${lat},${lng}`;

  const name = location?.trim() || '';
  const addr = address?.trim() || '';

  // 주소에 이미 이름이 들어 있으면 겹쳐 쓰지 않는다.
  if (name && addr) {
    return addr.toLowerCase().includes(name.toLowerCase()) ? addr : `${name}, ${addr}`;
  }
  return addr || name || null;
}

/** 구글 지도 길찾기 링크. 갈 곳을 특정할 수 없으면 null(버튼을 아예 걸지 않는다). */
export function directionsHref(target: DirectionsTarget): string | null {
  // 운영자가 지도 링크를 직접 넣었다면 그 의도가 우선이다(상세 페이지와 같은 규칙).
  const explicit = target.locationUrl?.trim();
  if (explicit) return explicit;

  const destination = directionsDestination(target);
  return destination ? GOOGLE_DIR + encodeURIComponent(destination) : null;
}
