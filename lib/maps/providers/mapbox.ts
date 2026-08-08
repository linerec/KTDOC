/**
 * Mapbox Geocoding v6 — 주소 검색 전용 제공자 (지도 표시는 OSM 그대로)
 *
 * 왜 필요한가: 기존 Photon(OSM)은 주소 파서가 아니라 지명 유사어 검색이라
 * "1 Bergen County Plaza, Hackensack, NJ 07601"에 엉뚱한 장소를 **확신 있게**
 * 돌려줬다. 게다가 같은 OSM 데이터를 구조화 지오코더로 조회해도 그 주소는 0건이라
 * OSM 안에서는 해결되지 않는다(자세한 근거는 docs/operations/geocoding-setup.md).
 *
 * 구글 대신 Mapbox를 고른 이유는 하나다 — **결제 수단 등록 없이 월 10만 건 무료**.
 * 미국 주소 품질은 구글보다 조금 아래지만 OSM보다는 확실히 낫다.
 *
 * 토큰은 **서버 전용**(MAPBOX_ACCESS_TOKEN)이다. NEXT_PUBLIC_이 아니므로 번들에
 * 들어가지 않고, 이 모듈은 /api/admin/geocode에서만 불린다.
 */

import type { GeocodeResult, Geocoder } from '../types';

const ENDPOINT = 'https://api.mapbox.com/search/geocode/v6/forward';

/**
 * 검색 결과를 학원 근처로 살짝 기울인다(뉴저지 Palisades Park).
 * country=us 같은 '필터'가 아니라 '가중치'라서, 미국 밖 주소도 여전히 찾을 수 있다.
 */
const PROXIMITY = '-73.9973,40.8482';

/** v6는 exact > high > medium > low 순. medium 아래는 "질의를 온전히 못 맞췄다"는 뜻. */
const PRECISE_CONFIDENCE = new Set(['exact', 'high']);

interface MapboxProperties {
  name?: string;
  name_preferred?: string;
  full_address?: string;
  place_formatted?: string;
  feature_type?: string;
  coordinates?: { longitude?: number; latitude?: number };
  match_code?: { confidence?: string };
}

interface MapboxFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: MapboxProperties;
}

interface MapboxResponse {
  features?: MapboxFeature[];
  message?: string;
}

/**
 * 표시용 이름. 주소형 결과의 name은 "1 Bergen County Plaza"처럼 주소 앞부분이라
 * 장소명으로 쓰면 중복이 된다. 건물·장소형일 때만 이름으로 인정한다.
 */
function pickName(p: MapboxProperties): string | null {
  const t = p.feature_type;
  if (t === 'address' || t === 'street' || t === 'postcode') return null;
  return p.name_preferred || p.name || null;
}

export const mapboxGeocoder: Geocoder = {
  id: 'mapbox',

  async geocode(query, opts) {
    const token = process.env.MAPBOX_ACCESS_TOKEN;
    if (!token) {
      throw new Error(
        'MAPBOX_ACCESS_TOKEN이 없습니다. .env.local(및 배포 환경)에 서버 전용 토큰을 넣어 주세요.'
      );
    }

    const params = new URLSearchParams({
      q: query,
      access_token: token,
      limit: String(Math.min(opts?.limit ?? 6, 10)), // v6 상한 10
      proximity: PROXIMITY,
      // 주소는 현지 표기가 정답이다. 한국어로 번역하면 지도 앱에 붙여넣을 수 없다.
      language: 'en',
    });

    const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      // 401·403은 토큰 문제 — 조용히 빈 결과로 넘기면 원인을 못 찾는다
      let detail = '';
      try {
        const body = (await res.json()) as MapboxResponse;
        if (body?.message) detail = ` — ${body.message}`;
      } catch {
        /* 본문이 JSON이 아니면 상태 코드만으로 충분하다 */
      }
      throw new Error(`Mapbox 지오코딩 실패: HTTP ${res.status}${detail}`);
    }

    const data = (await res.json()) as MapboxResponse;

    const out: GeocodeResult[] = [];
    for (const f of data.features ?? []) {
      const p = f.properties ?? {};
      // 좌표는 properties.coordinates가 정확하고, geometry는 보조 경로다
      const lat = p.coordinates?.latitude ?? f.geometry?.coordinates?.[1];
      const lng = p.coordinates?.longitude ?? f.geometry?.coordinates?.[0];
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;

      // full_address가 정규화된 한 줄 주소. 없으면 name + place_formatted로 조립.
      const address =
        p.full_address?.trim() ||
        [p.name, p.place_formatted].filter(Boolean).join(', ').trim();
      if (!address) continue;

      const confidence = p.match_code?.confidence;
      out.push({
        name: pickName(p),
        address,
        lat,
        lng,
        // confidence가 없는 결과(주소가 아닌 지역 등)는 근사치로 보지 않는다 —
        // '동네'를 고른 것은 틀린 게 아니라 그 수준의 답이다.
        approximate: confidence ? !PRECISE_CONFIDENCE.has(confidence) : false,
      });
    }
    return out;
  },
};
