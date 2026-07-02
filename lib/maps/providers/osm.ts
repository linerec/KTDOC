/**
 * OpenStreetMap 제공자 — API 키 불필요
 *
 *  - 지오코딩: Photon (photon.komoot.io) — OSM 데이터 기반, 검색어 자동완성용으로 설계됨.
 *    (Nominatim은 정책상 자동완성 사용 금지라 Photon을 쓴다)
 *  - 지도 임베드: openstreetmap.org 공식 embed iframe (마커 + 팬·줌 지원)
 *  - 길찾기: Google Maps 범용 링크 — 표시 제공자와 무관하게 휴대폰에서 지도 앱이 열려
 *    실사용 편의가 가장 좋다. 제공자 교체 시 이 링크도 함께 바꿀 수 있도록 여기 둔다.
 */

import type { GeocodeResult, MapsProvider, EmbedOptions } from '../types';

const PHOTON_ENDPOINT = 'https://photon.komoot.io/api/';

/** Photon GeoJSON 응답의 properties 중 우리가 쓰는 필드 */
interface PhotonProperties {
  name?: string;
  housenumber?: string;
  street?: string;
  district?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: PhotonProperties;
}

/** Photon properties를 사람이 읽는 한 줄 주소로 조립 */
function formatPhotonAddress(p: PhotonProperties): string {
  const streetLine = [p.housenumber, p.street].filter(Boolean).join(' ');
  const parts = [
    streetLine || null,
    p.district && p.district !== p.city ? p.district : null,
    p.city || null,
    [p.state, p.postcode].filter(Boolean).join(' ') || null,
    p.country || null,
  ].filter(Boolean);
  return parts.join(', ');
}

/** 임베드 bbox 반경(도 단위) — zoom이 클수록 좁게 */
function bboxDelta(zoom: number): number {
  // OSM embed는 zoom 대신 bbox를 받는다. zoom 16 ≈ ±0.004도 근사.
  return 0.004 * Math.pow(2, 16 - zoom);
}

const DEFAULT_ZOOM = 16;

export const osmProvider: MapsProvider = {
  id: 'osm',

  attribution: {
    text: '© OpenStreetMap contributors',
    url: 'https://www.openstreetmap.org/copyright',
  },

  async geocode(query, opts) {
    const params = new URLSearchParams({
      q: query,
      limit: String(opts?.limit ?? 6),
    });
    const res = await fetch(`${PHOTON_ENDPOINT}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      // 자동완성 특성상 오래 기다릴 이유가 없다
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      throw new Error(`Photon 지오코딩 실패: HTTP ${res.status}`);
    }
    const data = (await res.json()) as { features?: PhotonFeature[] };

    const results: GeocodeResult[] = [];
    for (const f of data.features ?? []) {
      const coords = f.geometry?.coordinates;
      const props = f.properties ?? {};
      if (!coords || coords.length < 2) continue;
      const [lng, lat] = coords;
      const address = formatPhotonAddress(props);
      if (!address && !props.name) continue;
      results.push({
        name: props.name || null,
        address: address || props.name || '',
        lat,
        lng,
      });
    }
    return results;
  },

  embedUrl(lat, lng, opts?: EmbedOptions) {
    const d = bboxDelta(opts?.zoom ?? DEFAULT_ZOOM);
    const bbox = [lng - d, lat - d, lng + d, lat + d].join(',');
    const params = new URLSearchParams({
      bbox,
      layer: 'mapnik',
      marker: `${lat},${lng}`,
    });
    return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
  },

  externalMapUrl(lat, lng, opts?: EmbedOptions) {
    const zoom = opts?.zoom ?? DEFAULT_ZOOM;
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
  },

  directionsUrl(lat, lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  },
};
