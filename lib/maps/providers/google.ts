/**
 * Google Geocoding — 주소 검색 전용 제공자 (지도 표시는 OSM 그대로)
 *
 * 왜 필요한가: 기존 Photon(OSM)은 주소 파서가 아니라 지명 유사어 검색이라,
 * "1 Bergen County Plaza, Hackensack, NJ 07601"을 넣으면 토큰이 겹치는 엉뚱한
 * 장소(카운티 법원·구치소 등)를 **확신 있게** 돌려줬다. 못 찾았다는 말을 하지 않는
 * 것이 가장 나쁜 성질이었다. 게다가 같은 OSM 데이터를 구조화 지오코더(Nominatim)로
 * 조회해도 그 주소는 0건이었다 — 데이터 자체가 없어서 OSM 안에서는 해결되지 않는다.
 *
 * 키는 **서버 전용**(GOOGLE_MAPS_API_KEY)이다. NEXT_PUBLIC_이 아니므로 번들에
 * 들어가지 않고, 이 모듈은 /api/admin/geocode에서만 불린다.
 *
 * 콘솔에서 키를 만들 때: 'Geocoding API'만 사용 설정하고, 키 제한은
 * 'API 제한 = Geocoding API'로 두면 된다. 서버에서만 부르므로 HTTP 리퍼러 제한은
 * 걸지 말 것(리퍼러가 없어 거부된다). 필요하면 서버 고정 IP 제한을 쓴다.
 */

import type { GeocodeResult, Geocoder } from '../types';

const ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

interface GoogleComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GoogleResult {
  formatted_address?: string;
  partial_match?: boolean;
  address_components?: GoogleComponent[];
  geometry?: { location?: { lat?: number; lng?: number } };
}

interface GoogleResponse {
  status?: string;
  error_message?: string;
  results?: GoogleResult[];
}

/**
 * 건물·장소 이름. Geocoding API는 POI 이름을 잘 주지 않으므로 있을 때만 쓴다
 * (없으면 null → 화면은 주소만 보여 준다).
 */
function pickName(r: GoogleResult): string | null {
  const comps = r.address_components ?? [];
  const named = comps.find(
    (c) => c.types.includes('point_of_interest') || c.types.includes('premise') || c.types.includes('establishment')
  );
  return named?.long_name ?? null;
}

export const googleGeocoder: Geocoder = {
  id: 'google',

  async geocode(query, opts) {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) {
      throw new Error(
        'GOOGLE_MAPS_API_KEY가 없습니다. .env.local(및 배포 환경)에 서버 전용 키를 넣어 주세요.'
      );
    }

    const params = new URLSearchParams({
      address: query,
      key,
      // 공연장이 전부 미국이라 미국 해석을 우선한다. 다른 나라 주소도 못 찾는 건 아니다.
      region: 'us',
      // 주소는 현지 표기가 정답이다. 한국어로 번역하면 '미국 뉴저지주…'처럼 나와
      // 지도 앱이나 내비게이션에 붙여넣을 수 없다.
      language: 'en',
    });

    const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      throw new Error(`Google 지오코딩 실패: HTTP ${res.status}`);
    }

    const data = (await res.json()) as GoogleResponse;

    // ZERO_RESULTS는 오류가 아니라 "그런 주소 없음"이다 — 빈 배열로 솔직하게 알린다.
    if (data.status === 'ZERO_RESULTS') return [];
    if (data.status !== 'OK') {
      throw new Error(
        `Google 지오코딩 실패: ${data.status ?? 'UNKNOWN'}${data.error_message ? ` — ${data.error_message}` : ''}`
      );
    }

    const limit = opts?.limit ?? 6;
    const out: GeocodeResult[] = [];
    for (const r of data.results ?? []) {
      const lat = r.geometry?.location?.lat;
      const lng = r.geometry?.location?.lng;
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;
      const address = r.formatted_address?.trim();
      if (!address) continue;
      out.push({
        name: pickName(r),
        address, // 구글이 정규화한 주소 — 이 값을 그대로 저장하면 표기가 통일된다
        lat,
        lng,
        approximate: r.partial_match === true,
      });
      if (out.length >= limit) break;
    }
    return out;
  },
};
